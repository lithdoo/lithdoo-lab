import type { TurnContext, TurnOutcome } from './types';

/** 单轮：准备目录 / 调 invoker / 解析 / 工具（实现待定）。 */
export interface TurnController {
  runTurn(ctx: TurnContext): Promise<TurnOutcome>;
}

/** 测试或渐进开发用占位实现。 */
export class StubTurnController implements TurnController {
  runTurn(_ctx: TurnContext): Promise<TurnOutcome> {
    void _ctx;
    return Promise.reject(new Error('not implemented'));
  }
}
