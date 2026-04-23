import { spawnSync } from 'child_process';

const MAX_BUFFER = 16 * 1024 * 1024;

export type PromptpileInvokeResult = {
  status: number | null;
  error?: NodeJS.ErrnoException;
  stdout: string;
  stderr: string;
};

/**
 * 同步调用 `promptpile` 可执行文件（与 `IReactRuntime` 的同步 `nextStep` 对齐）。
 */
export function invokePromptpileSync(
  command: string,
  argv: string[],
  cwd?: string
): PromptpileInvokeResult {
  const r = spawnSync(command, argv, {
    cwd: cwd ?? process.cwd(),
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    windowsHide: true
  });

  const out = typeof r.stdout === 'string' ? r.stdout : '';
  const err = typeof r.stderr === 'string' ? r.stderr : '';

  if (r.error) {
    return {
      status: null,
      error: r.error as NodeJS.ErrnoException,
      stdout: out,
      stderr: err
    };
  }

  return {
    status: typeof r.status === 'number' ? r.status : null,
    stdout: out,
    stderr: err
  };
}
