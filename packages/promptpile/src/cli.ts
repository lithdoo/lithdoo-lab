import { Command } from 'commander';
import { Config } from './types';

/** Result of {@link parseCli}; `configPath` is raw path from argv (resolve against cwd in resolve-config). */
export interface CliParseResult {
  /** Raw path from argv; resolve against cwd where used. */
  configPath?: string;
  options: Partial<Config>;
}

const buildProgram = (): Command => {
  const program = new Command();
  program
    .name('promptpile')
    .description('Assemble message files and call Chat Completions APIs')
    .version('1.0.0')
    .option('--config <path>', 'TOML config file path (relative to cwd)')
    .option('-d, --directory <path>', 'Directory to scan for files')
    .option('-m, --model <model>', 'AI model to use')
    .option('-k, --api-key <key>', 'AI API key')
    .option('-b, --api-base-url <url>', 'AI API base URL')
    .option('-o, --output <path>', 'Output file path for AI response')
    .option('-q, --quiet', 'Disable normal stdout logs and response output')
    .option('-f, --format <format>', 'Output format (text or json)')
    .option('-i, --input', 'Read user input from terminal and append as next user message')
    .option('-c, --continue', 'Append assistant reply to next message file')
    .option(
      '--system-inject-file <path>',
      'Prepend or merge into first system message from this UTF-8 file (relative paths resolve from cwd)'
    )
    .option(
      '--tools-file <path>',
      'Load tools from this .toml file only (supports extends; relative paths resolve from cwd). Required unless --disable-tool.'
    )
    .option(
      '--after-hook-path <path>',
      'Run this script file after success (relative paths resolve from cwd)'
    )
    .option(
      '--tool-choice <value>',
      'OpenAI tool_choice when tools are sent: none | auto | required | function:<name> (default: auto if unset)'
    )
    .option(
      '--disable-tool',
      'Do not load or send tools: skip --tools-file / TOOLS_FILE and omit built-in Glob/Grep pack'
    )
  return program;
};

export const parseCli = (argv: string[]): CliParseResult => {
  const program = buildProgram();
  program.parse(argv, { from: 'node' });
  const options = program.opts() as {
    config?: string;
    directory?: string;
    model?: string;
    apiKey?: string;
    apiBaseUrl?: string;
    output?: string;
    quiet?: boolean;
    format?: 'text' | 'json';
    continue?: boolean;
    input?: boolean;
    toolsFile?: string;
    afterHookPath?: string;
    toolChoice?: string;
    systemInjectFile?: string;
    disableTool?: boolean;
  };

  const rawConfig = options.config as string | undefined;
  let configPath: string | undefined;
  if (typeof rawConfig === 'string' && rawConfig.trim() !== '') {
    configPath = rawConfig.trim();
  }

  const rawToolsFile = options.toolsFile as string | undefined;
  const toolsFileCli =
    typeof rawToolsFile === 'string' && rawToolsFile.trim() !== ''
      ? rawToolsFile.trim()
      : undefined;
  const rawHook = options.afterHookPath as string | undefined;
  const afterHookCli =
    typeof rawHook === 'string' && rawHook.trim() !== '' ? rawHook.trim() : undefined;
  const rawToolChoice = options.toolChoice as string | undefined;
  const toolChoiceCli =
    typeof rawToolChoice === 'string' && rawToolChoice.trim() !== ''
      ? rawToolChoice.trim()
      : undefined;
  const rawSystemInject = options.systemInjectFile as string | undefined;
  const systemInjectFileCli =
    typeof rawSystemInject === 'string' && rawSystemInject.trim() !== ''
      ? rawSystemInject.trim()
      : undefined;

  return {
    configPath,
    options: {
      directory: options.directory,
      model: options.model,
      apiKey: options.apiKey,
      apiBaseUrl: options.apiBaseUrl,
      output: options.output,
      quiet: options.quiet as boolean | undefined,
      format: options.format as 'text' | 'json' | undefined,
      continueMode: options.continue === true ? true : undefined,
      inputMode: options.input === true ? true : undefined,
      toolsFileCli,
      systemInjectFileCli,
      afterHookCli,
      toolChoice: toolChoiceCli,
      disableTool: options.disableTool === true ? true : undefined
    }
  };
};
