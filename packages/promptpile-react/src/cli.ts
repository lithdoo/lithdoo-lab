import { Command } from 'commander';

export interface PromptpileReactOptions {
  directory?: string;
  model?: string;
  apiKey?: string;
  apiBaseUrl?: string;
  quiet?: boolean;
  toolsFile?: string;
  afterHookPath?: string;
  /** Local: terminal user message (not forwarded as `promptpile -i`). */
  inputMode: boolean;
  /** Local: append assistant reply (not forwarded as `promptpile -c`). */
  continueMode: boolean;
  /** Local: max agent loop iterations; not forwarded to `promptpile`. */
  maxStep?: number;
}

const program = new Command();

program
  .name('promptpile-react')
  .description('Agent loop around the `promptpile` CLI (React-style orchestration; subprocess only)')
  .version('1.0.0')
  .option('-d, --directory <path>', 'Directory to scan for message files (forwarded to `promptpile`)')
  .option('-m, --model <model>', 'Model ID (forwarded to `promptpile`)')
  .option('-k, --api-key <key>', 'API key (forwarded to `promptpile`)')
  .option('-b, --api-base-url <url>', 'API base URL (forwarded to `promptpile`)')
  .option('-q, --quiet', 'Quiet: less stdout from `promptpile` (forwarded)')
  .option('-i, --input', 'Terminal user message → next user file (this package; not sent as `promptpile -i`)')
  .option('-c, --continue', 'Append assistant reply to message files (this package; not sent as `promptpile -c`)')
  .option(
    '--tools-file <path>',
    'Load tools from this file only (forwarded; relative paths resolve from cwd for `promptpile`)'
  )
  .option(
    '--after-hook-path <path>',
    'Run script after success (forwarded; relative paths resolve from cwd for `promptpile`)'
  )
  .option(
    '--max-step <n>',
    'Max agent loop iterations (this package only; not forwarded to `promptpile`)'
  );

const trimmed = (v: unknown): string | undefined => {
  if (typeof v !== 'string') {
    return undefined;
  }
  const s = v.trim();
  return s === '' ? undefined : s;
};

const parseMaxStep = (raw: unknown): number | undefined => {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const s = String(raw).trim();
  if (s === '') {
    return undefined;
  }
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1) {
    console.error('Error: --max-step must be a positive integer');
    process.exit(1);
  }
  return n;
};

/**
 * argv fragment for the `promptpile` executable. Never includes `-i` / `-c`.
 */
export function buildForwardedPromptpileArgs(options: PromptpileReactOptions): string[] {
  const args: string[] = [];
  const d = options.directory;
  const m = options.model;
  const k = options.apiKey;
  const b = options.apiBaseUrl;
  const t = options.toolsFile;
  const a = options.afterHookPath;
  if (d !== undefined) {
    args.push('-d', d);
  }
  if (m !== undefined) {
    args.push('-m', m);
  }
  if (k !== undefined) {
    args.push('-k', k);
  }
  if (b !== undefined) {
    args.push('-b', b);
  }
  if (options.quiet) {
    args.push('-q');
  }
  if (t !== undefined) {
    args.push('--tools-file', t);
  }
  if (a !== undefined) {
    args.push('--after-hook-path', a);
  }
  return args;
}

export function getPromptpileReactOptions(): PromptpileReactOptions {
  const o = program.opts() as {
    directory?: string;
    model?: string;
    apiKey?: string;
    apiBaseUrl?: string;
    quiet?: boolean;
    toolsFile?: string;
    afterHookPath?: string;
    input?: boolean;
    continue?: boolean;
    maxStep?: string;
  };
  return {
    directory: trimmed(o.directory),
    model: trimmed(o.model),
    apiKey: trimmed(o.apiKey),
    apiBaseUrl: trimmed(o.apiBaseUrl),
    quiet: Boolean(o.quiet),
    toolsFile: trimmed(o.toolsFile),
    afterHookPath: trimmed(o.afterHookPath),
    inputMode: Boolean(o.input),
    continueMode: Boolean(o.continue),
    maxStep: parseMaxStep(o.maxStep)
  };
}

export function parseCli(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    program.help({ error: true });
  }
  program.parse(process.argv);
}
