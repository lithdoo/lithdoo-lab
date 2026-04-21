import type { PromptpileInvoker } from './promptpile-invoker';
import type { ToolExecutor } from './tool-executor';
import type { TurnController } from './turn-controller';
import type { ReactRuntimeConfig, ReactRuntimeResult } from './types';

/**
 * ReAct 会话门面：编排配置、可选工具、invoker、单轮控制器（实现待定）。
 */
export class ReactRuntime {
  constructor(
    private readonly config: ReactRuntimeConfig,
    private readonly tools?: ToolExecutor,
    private readonly invoker?: PromptpileInvoker,
    private readonly turns?: TurnController
  ) {}

  async run(): Promise<ReactRuntimeResult> {
    void this.config;
    void this.tools;
    void this.invoker;
    void this.turns;
    throw new Error('not implemented');
  }
}

export const createReactRuntime = (
  config: ReactRuntimeConfig,
  tools?: ToolExecutor,
  invoker?: PromptpileInvoker,
  turns?: TurnController
): ReactRuntime => new ReactRuntime(config, tools, invoker, turns);
