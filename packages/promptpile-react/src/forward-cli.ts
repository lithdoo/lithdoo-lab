import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import { Command } from 'commander';
import { PROMPTPILE_REACT_VERSION } from './version';

/**
 * CLI options mirrored from `promptpile`, excluding any output path (`-o` / `OUTPUT_FILE`).
 * Forwarded as argv to the `promptpile` child process.
 */
export interface PromptpileForwardCliOpts {
  directory?: string;
  model?: string;
  apiKey?: string;
  apiBaseUrl?: string;
  quiet?: boolean;
  format: string;
  input?: boolean;
  continue?: boolean;
  toolsFile?: string;
  afterHookPath?: string;
  /** OpenAI `tool_choice` raw string; forwarded as `--tool-choice` when set. */
  toolChoice?: string;
}

/** Same flags as `packages/promptpile/src/cli.ts` except `-o` / `--output`. */
export const createForwardCommand = (): Command => {
  const program = new Command();
  program
    .name('promptpile-react')
    .description(
      'ReAct orchestration on top of promptpile. Forwards all promptpile options except output; does not set OUTPUT_FILE for the child.'
    )
    .version(PROMPTPILE_REACT_VERSION)
    .option('-d, --directory <path>', 'Directory to scan for files')
    .option('-m, --model <model>', 'AI model to use')
    .option('-k, --api-key <key>', 'AI API key')
    .option('-b, --api-base-url <url>', 'AI API base URL')
    .option('-q, --quiet', 'Disable normal stdout logs and response output')
    .option('-f, --format <format>', 'Output format (text or json)', 'text')
    .option('-i, --input', 'Read user input from terminal and append as next user message')
    .option('-c, --continue', 'Append assistant reply to next message file')
    .option(
      '--tools-file <path>',
      'Load tools from this file only (.jsonl or .toml; relative paths resolve from cwd)'
    )
    .option(
      '--after-hook-path <path>',
      'Run this script file after success (relative paths resolve from cwd)'
    )
    .option(
      '--tool-choice <value>',
      'OpenAI tool_choice when tools are sent: none | auto | required | function:<name> (see promptpile README)'
    );
  return program;
};

const trim = (s: string | undefined): string | undefined => {
  if (s === undefined) {
    return undefined;
  }
  const t = s.trim();
  return t === '' ? undefined : t;
};

/** Build argv fragments for `node <promptpile> ...` (no `node`, no script path). */
export const buildPromptpileForwardArgs = (opts: PromptpileForwardCliOpts): string[] => {
  const args: string[] = [];
  const d = trim(opts.directory);
  if (d) {
    args.push('-d', d);
  }
  const m = trim(opts.model);
  if (m) {
    args.push('-m', m);
  }
  const k = trim(opts.apiKey);
  if (k) {
    args.push('-k', k);
  }
  const b = trim(opts.apiBaseUrl);
  if (b) {
    args.push('-b', b);
  }
  if (opts.quiet) {
    args.push('-q');
  }
  const fmt = trim(opts.format) ?? 'text';
  args.push('-f', fmt);
  if (opts.input) {
    args.push('-i');
  }
  if (opts.continue) {
    args.push('-c');
  }
  const tf = trim(opts.toolsFile);
  if (tf) {
    args.push('--tools-file', tf);
  }
  const hook = trim(opts.afterHookPath);
  if (hook) {
    args.push('--after-hook-path', hook);
  }
  const tc = trim(opts.toolChoice);
  if (tc) {
    args.push('--tool-choice', tc);
  }
  return args;
};

export const resolvePromptpileEntry = (): string => {
  const require = createRequire(__filename);
  const pkgJson = require.resolve('promptpile/package.json') as string;
  return path.join(path.dirname(pkgJson), 'dist', 'index.js');
};

/**
 * Child env: copy of `process.env` with `OUTPUT_FILE` removed so the child does not pick up
 * an implicit output path (react owns output later).
 */
export const childEnvWithoutOutputFile = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.OUTPUT_FILE;
  return env;
};

/**
 * Parse `argv` (default `process.argv`), then run `promptpile` once with forwarded options.
 * @returns exit code to propagate (0 = success).
 */
export const runPromptpileForward = (argv: string[] = process.argv): number => {
  const program = createForwardCommand();
  program.parse(argv);
  const raw = program.opts() as Record<string, unknown>;
  const opts: PromptpileForwardCliOpts = {
    directory: raw.directory as string | undefined,
    model: raw.model as string | undefined,
    apiKey: raw.apiKey as string | undefined,
    apiBaseUrl: raw.apiBaseUrl as string | undefined,
    quiet: Boolean(raw.quiet),
    format: typeof raw.format === 'string' ? raw.format : 'text',
    input: Boolean(raw.input),
    continue: Boolean(raw.continue),
    toolsFile: raw.toolsFile as string | undefined,
    afterHookPath: raw.afterHookPath as string | undefined,
    toolChoice: raw.toolChoice as string | undefined
  };

  const forwardArgs = buildPromptpileForwardArgs(opts);
  let entry: string;
  try {
    entry = resolvePromptpileEntry();
  } catch (e) {
    console.error(
      'promptpile-react: could not resolve the `promptpile` package. Install dependencies (e.g. npm install).',
      e instanceof Error ? e.message : e
    );
    return 1;
  }

  const result = spawnSync(process.execPath, [entry, ...forwardArgs], {
    stdio: 'inherit',
    env: childEnvWithoutOutputFile(),
    windowsHide: true
  });

  if (result.error) {
    console.error('promptpile-react: failed to spawn promptpile:', result.error.message);
    return 1;
  }
  if (result.signal) {
    console.error(`promptpile-react: promptpile exited on signal ${result.signal}`);
    return 1;
  }
  return result.status === null ? 1 : result.status;
};
