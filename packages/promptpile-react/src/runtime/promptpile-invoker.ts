export interface PromptpileInvokeRequest {
  argv: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface PromptpileInvokeResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

/** 封装对 `promptpile` 子进程的一次调用（实现待定）。 */
export interface PromptpileInvoker {
  invoke(req: PromptpileInvokeRequest): PromptpileInvokeResult;
}

/** 测试或渐进开发用占位实现。 */
export class StubPromptpileInvoker implements PromptpileInvoker {
  invoke(_req: PromptpileInvokeRequest): PromptpileInvokeResult {
    void _req;
    throw new Error('not implemented');
  }
}
