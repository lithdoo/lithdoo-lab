import { randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { stripObserveRelevantFlags } from './argv-strip';
import { OBSERVE_DECISION_TOOL_NAME, writeObserveToolsJsonl } from './observe-decision-tool';
import { callsPathForMainOutput, parseObserveDecisionFromCallsFileStrict } from './parse-observe-calls';
import { invokePromptpileSync, type PromptpileInvokeResult } from './promptpile-invoker';
import { PromptpileReactInvocationError } from './react-errors';

/** 子进程阶段共享依赖（不持有 {@link PromptpileReactRuntime} 引用）。 */
export type ReactProcessContext = {
  command: string;
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

  protected assertPromptpileSuccess(argv: string[], phase: 'thought' | 'observe'): void {
    const r = invokePromptpileSync(this.ctx.command, argv, this.ctx.cwd);

    if (r.error) {
      this.logSpawnError(r);
      throw new PromptpileReactInvocationError(
        phase,
        r.error.message || '无法启动 promptpile'
      );
    }

    this.emitSubprocessStreams(r);

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
  protected completePromptpileInvokeSoft(argv: string[]): boolean {
    const r = invokePromptpileSync(this.ctx.command, argv, this.ctx.cwd);

    if (r.error) {
      this.logSpawnError(r);
      return false;
    }

    this.emitSubprocessStreams(r);

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

  private emitSubprocessStreams(r: PromptpileInvokeResult): void {
    if (r.stdout && !this.ctx.quiet) {
      process.stdout.write(r.stdout);
    }
    if (r.stderr && !this.ctx.quiet) {
      process.stderr.write(r.stderr);
    }
  }

  private logSpawnError(r: PromptpileInvokeResult): void {
    if (!r.error) {
      return;
    }
    if (r.error.code === 'ENOENT') {
      if (!this.ctx.quiet) {
        console.error(
          `Error: 找不到命令 "${this.ctx.command}"。请安装 promptpile 并加入 PATH，或设置环境变量 PROMPTPILE_BIN 指向可执行文件。`
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

  run(): void {
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
      this.assertPromptpileSuccess(argv, 'thought');
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

  run(): boolean {
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

      this.assertPromptpileSuccess(argv, 'observe');

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

  run(): void {
    if (this.finalBody.trim() === '') {
      return;
    }

    const argv = [...this.ctx.forwardedArgs];
    this.appendContinueIfNeeded(argv);

    let tempPath: string | undefined;
    try {
      tempPath = path.join(
        os.tmpdir(),
        `promptpile-react-final-${Date.now()}-${randomBytes(8).toString('hex')}.md`
      );
      fs.writeFileSync(tempPath, this.finalBody, 'utf8');
      argv.push('--system-inject-file', path.resolve(tempPath));
      void this.completePromptpileInvokeSoft(argv);
    } finally {
      this.unlinkQuiet(tempPath);
    }
  }
}
