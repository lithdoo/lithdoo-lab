import type { PromptpileReactOptions } from './cli';
import type { ReactPromptTexts } from './load-react-prompts';
import {
  CoreReactProcess,
  FinalReactProcess,
  ObserveReactProcess,
  type ReactProcessContext
} from './react-processes';
import type { IReactRuntime, ReactRuntimeStopReason } from './runtime';
import { getPromptpileSpawnConfig, type PromptpileSpawnConfig } from './promptpile-invoker';

/**
 * - `currentStep`：已成功完成的 ReAct 轮次数（每轮 `nextStep` = thought + observe 均成功后 +1），从 0 开始。
 * - `maxStep`：最多允许的上述成功轮数；`Infinity` 表示 CLI 未设上限（入口侧通常只跑一轮，见 `index.ts`）。
 * - `inputMode`：仅影响 **`index.ts`** 外层是否在终端读入并写 user 文件；读盘写文件用 **`promptpile`** 包内 `file-handler`，**不**注入子进程 argv。
 * - `continueMode`：`reactThoughtProcess` / `reactObserveProcess` / `reactFinalAnswerProcess` 内拼 argv 时可附加 `-c`；主流程 `buildForwardedPromptpileArgs` 的 argv **不含** `-c`。
 *
 * 各 ReAct 子进程阶段实现见 **`react-processes.ts`**（`CoreReactProcess` / `ObserveReactProcess` / `FinalReactProcess`）。
 */
export class PromptpileReactRuntime implements IReactRuntime {
  maxStep: number;
  currentStep = 0;
  stopReason: ReactRuntimeStopReason = 'running';

  private readonly options: PromptpileReactOptions;
  private readonly forwardedArgs: string[];
  private readonly prompts: ReactPromptTexts;
  private readonly spawn: PromptpileSpawnConfig;
  private readonly quiet: boolean;

  constructor(options: PromptpileReactOptions, forwardedArgs: string[], prompts: ReactPromptTexts) {
    this.options = options;
    this.maxStep = options.maxStep ?? Number.POSITIVE_INFINITY;
    this.forwardedArgs = forwardedArgs;
    this.prompts = prompts;
    this.spawn = getPromptpileSpawnConfig();
    this.quiet = Boolean(options.quiet);
  }

  /**
   * 一轮：先 `reactThoughtProcess`，再 `reactObserveProcess`。
   * 二者任一侧子进程或 observe 读盘解析失败 → **`PromptpileReactInvocationError`**（本方法 **catch** 后 `stopReason = 'error'`）；
   * observe 正常返回 `false` → `stopReason = 'final'`。
   */
  async nextStep(): Promise<void> {
    if (this.stopReason !== 'running') {
      return;
    }
    if (Number.isFinite(this.maxStep) && this.currentStep >= this.maxStep) {
      this.stopReason = 'max_step';
      return;
    }

    try {
      await this.reactThoughtProcess();
      const continueOuter = await this.reactObserveProcess();
      this.currentStep += 1;
      if (!continueOuter) {
        this.stopReason = 'final';
        return;
      }
      if (Number.isFinite(this.maxStep) && this.currentStep >= this.maxStep) {
        this.stopReason = 'max_step';
      }
    } catch {
      this.stopReason = 'error';
    }
  }

  async finalAnswer(): Promise<void> {
    await this.reactFinalAnswerProcess();
  }

  /**
   * ReAct「思考阶段」：单独一次 `promptpile` 调用，用临时文件 + `--system-inject-file` 注入 `prompts.core`；
   * 若 `continueMode` 则在 argv 拷贝上追加 `-c`。子进程失败时 **`throw PromptpileReactInvocationError`**。
   *
   * **不修改** `currentStep` / `stopReason`（由 `nextStep` 的 try/catch 或外层调用方处理异常）。
   */
  async reactThoughtProcess(): Promise<void> {
    await new CoreReactProcess(this.reactProcessCtx(), this.prompts.core).run();
  }

  /**
   * ReAct「观察阶段」：临时 `--tools-file`（含 `react_observe_decision`）、临时 `-o`、去掉 `--after-hook-path`；
   * 可选 `--system-inject-file` 注入 `observe`；成功后读 **`{basename}.calls.jsonl`**。
   *
   * @returns `true` 表示应继续外层循环；`false` 表示观察判定停止（**不抛异常**）。
   * 子进程失败或 calls 读盘/解析非法 → **`throw PromptpileReactInvocationError`**。
   * 仅删除本轮 `.calls.jsonl` 与临时 tools/inject；**保留** `-o` 主输出。不修改 `currentStep` / `stopReason`。
   */
  async reactObserveProcess(): Promise<boolean> {
    return new ObserveReactProcess(this.reactProcessCtx(), this.prompts.observe).run();
  }

  /**
   * ReAct「收尾阶段」：单独一次 `promptpile`，用临时文件 + `--system-inject-file` 注入 `prompts.final`；
   * 若 `continueMode` 则在 argv 拷贝上追加 `-c`。`prompts.final` 仅空白时 **no-op**（不调子进程）。
   * 不修改 `currentStep` / `stopReason`。
   */
  async reactFinalAnswerProcess(): Promise<void> {
    await new FinalReactProcess(this.reactProcessCtx(), this.prompts.final).run();
  }

  private reactProcessCtx(): ReactProcessContext {
    return {
      spawn: this.spawn,
      cwd: process.cwd(),
      quiet: this.quiet,
      continueMode: this.options.continueMode,
      forwardedArgs: this.forwardedArgs
    };
  }
}
