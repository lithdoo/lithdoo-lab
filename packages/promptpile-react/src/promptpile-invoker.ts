import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const MAX_BUFFER = 16 * 1024 * 1024;

export type PromptpileInvokeResult = {
  status: number | null;
  error?: NodeJS.ErrnoException;
  stdout: string;
  stderr: string;
};

/** 如何启动 promptpile 子进程（可能为全局命令或 node + 内置脚本）。 */
export type PromptpileSpawnConfig = {
  command: string;
  /** 插在 CLI 参数之前的 argv 片段（例如 `[bundled/dist/index.js]`）。 */
  argvPrefix: string[];
  /** 面向用户的简短描述（错误提示用）。 */
  displayName: string;
};

function tryResolveBundledPromptpileScript(): string | null {
  try {
    const pkgJson = require.resolve('promptpile/package.json');
    const script = path.join(path.dirname(pkgJson), 'dist', 'index.js');
    return fs.existsSync(script) ? script : null;
  } catch {
    return null;
  }
}

/**
 * 解析 promptpile 子进程启动方式：
 * 1. `PROMPTPILE_BIN` 非空 → 沿用（覆盖内置）
 * 2. 否则若依赖中存在已构建的 `promptpile/dist/index.js` → `node` + 该脚本（本仓库默认）
 * 3. 否则回退到 PATH 上的 `promptpile`
 */
export function getPromptpileSpawnConfig(): PromptpileSpawnConfig {
  const bin = process.env.PROMPTPILE_BIN?.trim();
  if (bin) {
    return { command: bin, argvPrefix: [], displayName: bin };
  }
  const bundled = tryResolveBundledPromptpileScript();
  if (bundled) {
    return {
      command: process.execPath,
      argvPrefix: [bundled],
      displayName: `node "${bundled}"`
    };
  }
  return { command: 'promptpile', argvPrefix: [], displayName: 'promptpile' };
}

/**
 * 同步调用 promptpile CLI（与 `IReactRuntime` 的同步 `nextStep` 对齐）。
 */
export function invokePromptpileSync(
  spawn: PromptpileSpawnConfig,
  cliArgs: string[],
  cwd?: string
): PromptpileInvokeResult {
  const argv = [...spawn.argvPrefix, ...cliArgs];
  const r = spawnSync(spawn.command, argv, {
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
