import { spawn, type ChildProcess } from 'child_process';

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
}

export function runProcess(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv; quiet?: boolean }): Promise<RunResult> {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { const text = chunk.toString(); stdout += text; if (!options.quiet) process.stdout.write(text); });
    child.stderr?.on('data', chunk => { const text = chunk.toString(); stderr += text; if (!options.quiet) process.stderr.write(text); });
    child.on('error', error => resolve({ status: null, stdout, stderr, error }));
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

export function stopChild(child: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 3000);
    child.once('close', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}
