import { randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { stripFinalForwardedArgs, stripObserveRelevantFlags } from './argv-strip';
import { OBSERVE_DECISION_TOOL_NAME, writeObserveToolsJsonl } from './observe-decision-tool';
import { callsPathForMainOutput, parseObserveDecisionFromCallsFileStrict } from './parse-observe-calls';
import {
  invokePromptpileAsync,
  type PromptpileInvokeResult,
  type PromptpileSpawnConfig
} from './promptpile-invoker';
import { reactDebugLog } from './react-debug-log';
import { PromptpileReactInvocationError } from './react-errors';

/** 子进程阶段共享依赖（不持有 {@link PromptpileReactRuntime} 引用）。 */
export type ReactProcessContext = {
  spawn: PromptpileSpawnConfig;
  cwd: string;
  quiet: boolean;
  continueMode: boolean;
  forwardedArgs: readonly string[];
};

export abstract class ReactProcess {
  protected constructor(protected readonly ctx: ReactProcessContext) {}

  protected appendContinueIfNeeded(argv: string[]): void {
    if (this.ctx.continueMode) {
      argv.push('-c');
    }
  }

  protected async assertPromptpileSuccess(
    argv: string[],
    phase: 'thought' | 'observe'
  ): Promise<void> {
    const r = await invokePromptpileAsync(this.ctx.spawn, argv, {
      cwd: this.ctx.cwd,
      quiet: this.ctx.quiet
    });

    if (r.error) {
      this.logSpawnError(r);
      throw new PromptpileReactInvocationError(
        phase,
        r.error.message || '无法启动 promptpile'
      );
    }

    if (r.status !== 0) {
      const tail = r.stderr.trim().slice(-500);
      const extra = tail !== '' ? `: ${tail}` : '';
      throw new PromptpileReactInvocationError(
        phase,
        `promptpile 退出码 ${r.status ?? 'null'}${extra}`
      );
    }
  }

  /** 不抛异常、不写 `stopReason`；供收尾阶段使用。 */
  protected async completePromptpileInvokeSoft(argv: string[]): Promise<boolean> {
    const r = await invokePromptpileAsync(this.ctx.spawn, argv, {
      cwd: this.ctx.cwd,
      quiet: this.ctx.quiet
    });

    if (r.error) {
      this.logSpawnError(r);
      return false;
    }

    if (r.status !== 0) {
      return false;
    }

    return true;
  }

  protected unlinkQuiet(p: string | undefined): void {
    if (p === undefined) {
      return;
    }
    try {
      fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }

  private logSpawnError(r: PromptpileInvokeResult): void {
    if (!r.error) {
      return;
    }
    if (r.error.code === 'ENOENT') {
      if (!this.ctx.quiet) {
        console.error(
          `Error: 找不到命令或脚本 "${this.ctx.spawn.displayName}"。请确认依赖包 promptpile 已 npm install 且已构建 dist，或将 promptpile 加入 PATH；也可设置 PROMPTPILE_BIN 覆盖。`
        );
      }
    } else if (!this.ctx.quiet) {
      console.error(`Error: 无法启动 promptpile: ${r.error.message}`);
    }
  }
}

/** ReAct「思考」：`prompts.core` 注入 + 子进程（失败抛 {@link PromptpileReactInvocationError}）。 */
export class CoreReactProcess extends ReactProcess {
  constructor(ctx: ReactProcessContext, private readonly coreBody: string) {
    super(ctx);
  }

  async run(): Promise<void> {
    const argv = [...this.ctx.forwardedArgs];
    this.appendContinueIfNeeded(argv);

    const core = this.coreBody.trim();
    let tempPath: string | undefined;
    try {
      if (core !== '') {
        tempPath = path.join(
          os.tmpdir(),
          `promptpile-react-core-${Date.now()}-${randomBytes(8).toString('hex')}.md`
        );
        fs.writeFileSync(tempPath, this.coreBody, 'utf8');
        argv.push('--system-inject-file', path.resolve(tempPath));
      }
      reactDebugLog('phase=thought');
      await this.assertPromptpileSuccess(argv, 'thought');
    } finally {
      this.unlinkQuiet(tempPath);
    }
  }
}

/** ReAct「观察」：临时 tools + `-o` + 读 `.calls.jsonl`（技术失败抛错；否则返回是否继续）。 */
export class ObserveReactProcess extends ReactProcess {
  constructor(ctx: ReactProcessContext, private readonly observeBody: string) {
    super(ctx);
  }

  async run(): Promise<boolean> {
    const baseId = `${Date.now()}-${randomBytes(8).toString('hex')}`;
    let toolsPath: string | undefined;
    let injectPath: string | undefined;
    const outPath = path.join(os.tmpdir(), `promptpile-react-observe-out-${baseId}.md`);
    const resolvedOut = path.resolve(outPath);

    try {
      const argv = stripObserveRelevantFlags([...this.ctx.forwardedArgs]);
      toolsPath = path.join(os.tmpdir(), `promptpile-react-observe-tools-${baseId}.jsonl`);
      writeObserveToolsJsonl(path.resolve(toolsPath));
      argv.push('--tools-file', path.resolve(toolsPath));
      argv.push('-o', resolvedOut);

      if (this.observeBody.trim() !== '') {
        injectPath = path.join(os.tmpdir(), `promptpile-react-observe-inject-${baseId}.md`);
        fs.writeFileSync(injectPath, this.observeBody, 'utf8');
        argv.push('--system-inject-file', path.resolve(injectPath));
      }
      this.appendContinueIfNeeded(argv);

      await this.assertPromptpileSuccess(argv, 'observe');

      const callsPath = callsPathForMainOutput(resolvedOut);
      let cont: boolean;
      try {
        cont = parseObserveDecisionFromCallsFileStrict(callsPath, OBSERVE_DECISION_TOOL_NAME);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new PromptpileReactInvocationError('observe', msg);
      }
      try {
        if (fs.existsSync(callsPath)) {
          fs.unlinkSync(callsPath);
        }
      } catch {
        // ignore
      }
      reactDebugLog(`phase=observe continue=${cont}`);
      return cont;
    } finally {
      this.unlinkQuiet(toolsPath);
      this.unlinkQuiet(injectPath);
    }
  }
}

/** ReAct「收尾」：`prompts.final` 注入；子进程失败不抛。 */
export class FinalReactProcess extends ReactProcess {
  constructor(ctx: ReactProcessContext, private readonly finalBody: string) {
    super(ctx);
  }

  async run(): Promise<void> {
    if (this.finalBody.trim() === '') {
      reactDebugLog('phase=final skip');
      return;
    }

    reactDebugLog('phase=final');
    const argv = stripFinalForwardedArgs([...this.ctx.forwardedArgs]);
    this.appendContinueIfNeeded(argv);

    let tempPath: string | undefined;
    try {
      tempPath = path.join(
        os.tmpdir(),
        `promptpile-react-final-${Date.now()}-${randomBytes(8).toString('hex')}.md`
      );
      fs.writeFileSync(tempPath, this.finalBody, 'utf8');
      argv.push('--system-inject-file', path.resolve(tempPath));
      argv.push('--disable-tool');
      await this.completePromptpileInvokeSoft(argv);
    } finally {
      this.unlinkQuiet(tempPath);
    }
  }
}
