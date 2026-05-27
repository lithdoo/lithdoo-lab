import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { InitSession } from './types';

const STDERR_CAP = 32 * 1024;

export type PromptpileSpawnConfig = {
  command: string;
  argvPrefix: string[];
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
      displayName: `node "${bundled}"`,
    };
  }
  return { command: 'promptpile', argvPrefix: [], displayName: 'promptpile' };
}

export type PromptpileRunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
};

export async function runPromptpile(
  session: InitSession,
  cliArgs: string[],
  options: { quiet?: boolean } = {}
): Promise<PromptpileRunResult> {
  const spawnConfig = getPromptpileSpawnConfig();
  const cwd = session.root;
  const argv = [...spawnConfig.argvPrefix, ...cliArgs];
  const quiet = options.quiet ?? true;
  let stderr = '';

  return new Promise(resolve => {
    const child = spawn(spawnConfig.command, argv, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      stdout += s;
      if (!quiet) {
        process.stdout.write(s);
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      stderr += s;
      if (stderr.length > STDERR_CAP) {
        stderr = stderr.slice(-STDERR_CAP);
      }
      if (!quiet) {
        process.stderr.write(s);
      }
    });

    child.on('error', error => {
      resolve({ status: null, stdout, stderr, error });
    });

    child.on('close', status => {
      resolve({ status, stdout, stderr });
    });
  });
}

export function assertPromptpileOk(
  result: PromptpileRunResult,
  context: string
): void {
  if (result.error) {
    throw new Error(
      `${context}: failed to start promptpile (${result.error.message}). ` +
        `Check ${getPromptpileSpawnConfig().displayName} is available.`
    );
  }
  if (result.status !== 0) {
    const tail = result.stderr.trim().slice(-500);
    throw new Error(
      `${context}: promptpile exited with code ${result.status}${tail ? `: ${tail}` : ''}`
    );
  }
}
