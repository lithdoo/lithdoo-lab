import fs from 'fs';
import path from 'path';
import { stripBom, stripYamlFrontMatter } from './file-handler';
import type { ChatMessage } from './types';

export const resolveSystemInjectPath = (cwd: string, cliPath: string): string =>
  path.isAbsolute(cliPath) ? cliPath : path.resolve(cwd, cliPath);

export const readSystemInjectContent = (resolvedPath: string): string => {
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(`system inject file not found: ${resolvedPath}`);
  }
  return fs.readFileSync(resolvedPath, 'utf8');
};

export const normalizeInjectFileContent = (resolvedPath: string, raw: string): string => {
  let text = stripBom(raw);
  if (resolvedPath.toLowerCase().endsWith('.md')) {
    text = stripYamlFrontMatter(text);
  }
  return text;
};

/**
 * Merges non-empty inject text into `messages`: prepends to first `system` or unshifts a new system message.
 * Caller should skip when inject trimmed is empty.
 */
export const applySystemInject = (messages: ChatMessage[], inject: string): ChatMessage[] => {
  const out = [...messages];
  if (out.length > 0 && out[0].role === 'system') {
    const first = { ...out[0] };
    const prev = first.content ?? '';
    first.content = inject + '\n\n' + prev;
    out[0] = first;
    return out;
  }
  out.unshift({ role: 'system', content: inject });
  return out;
};
