import type { PromptpileForwardCliOpts } from '../forward-cli';
import type { ReactDotPrompts } from '../react-dot-prompts';

/** 一次 ReAct 会话的不可变配置。 */
export interface ReactRuntimeConfig {
  /** 消息目录根（`-d`），与 `loadReactDotPrompts` 一致。 */
  directory: string;
  /** 解析相对路径时的工作目录，默认 `process.cwd()`。 */
  cwd: string;
  maxSteps: number;
  /** 转发给 `promptpile` 子进程的选项（不含输出路径）。 */
  promptpile: PromptpileForwardCliOpts;
  /** 可选：由 Runtime 为每轮生成 `-o` 时的父目录等。 */
  outputDir?: string;
}

/** 会话可变状态（占位，供后续循环更新）。 */
export interface ReactRuntimeState {
  step: number;
  lastExitCode?: number;
  lastError?: string;
}

/** 单轮解析后的占位结构（不做真实解析）。 */
export interface ParsedTurnOutput {
  assistantText?: string;
  toolCalls?: unknown[];
}

export type TurnOutcome = 'continue' | 'done' | 'abort';

/** 单轮控制器只读上下文。 */
export interface TurnContext {
  config: ReactRuntimeConfig;
  state: ReactRuntimeState;
  dotPrompts: ReactDotPrompts;
}

/** `ReactRuntime.run` 的返回占位。 */
export interface ReactRuntimeResult {
  ok: boolean;
  steps: number;
  lastAssistantText?: string;
  lastToolCalls?: unknown[];
  exitCode?: number;
  error?: string;
}
