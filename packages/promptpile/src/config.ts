import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config({ quiet: true });

const parseBoolEnv = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const trimEnv = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const t = value.trim();
  return t === '' ? undefined : t;
};

export const loadConfig = (options: Partial<Config>): Config => {
  const afterHookEnv = trimEnv(process.env.AFTER_HOOK_PATH);
  const toolsFileEnv = trimEnv(process.env.TOOLS_FILE);
  const toolChoiceEnv = trimEnv(process.env.TOOL_CHOICE);
  return {
    directory: options.directory || process.env.DEFAULT_DIRECTORY || './messages',
    model: options.model || process.env.AI_MODEL || 'gpt-3.5-turbo',
    apiKey: options.apiKey || process.env.AI_API_KEY || '',
    apiBaseUrl: options.apiBaseUrl || process.env.AI_API_BASE_URL || 'https://api.openai.com/v1',
    format: options.format || 'text',
    continueMode: options.continueMode ?? false,
    inputMode: options.inputMode ?? false,
    output: options.output || process.env.OUTPUT_FILE || undefined,
    quiet: options.quiet ?? parseBoolEnv(process.env.QUIET),
    toolsFileCli: options.toolsFileCli,
    toolsFileEnv,
    afterHookCli: options.afterHookCli,
    afterHookEnv,
    toolChoice: options.toolChoice ?? toolChoiceEnv
  };
};
