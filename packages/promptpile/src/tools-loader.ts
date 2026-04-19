import fs from 'fs';
import path from 'path';
import type { ToolDefinition } from './types';

const TOOLS_FILE = '.tools.jsonl';

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/**
 * Load `.tools.jsonl` from the message directory root only (not recursive).
 * Returns `undefined` if the file is absent. Throws or process should exit if invalid when present.
 */
export const loadToolsJsonl = (directory: string): ToolDefinition[] | undefined => {
  const fullPath = path.join(directory, TOOLS_FILE);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return undefined;
  }

  const raw = stripBom(fs.readFileSync(fullPath, 'utf8'));
  const lines = raw.split(/\r?\n/);
  const tools: ToolDefinition[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      throw new Error(`${TOOLS_FILE}: line ${i + 1} is not valid JSON`);
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error(`${TOOLS_FILE}: line ${i + 1} must be a JSON object`);
    }
    const rec = obj as Record<string, unknown>;
    if (typeof rec.type !== 'string' || !rec.type) {
      throw new Error(`${TOOLS_FILE}: line ${i + 1} must include a non-empty string "type" field`);
    }
    tools.push(rec as ToolDefinition);
  }

  return tools.length > 0 ? tools : undefined;
};
