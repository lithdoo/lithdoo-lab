import fs from 'fs';
import path from 'path';
import { parse as parseToml } from '@iarna/toml';
import { isPromptpileDiagnostic } from './diagnostic-log';
import type { ToolDefinition } from './types';

const TOOLS_JSONL = '.tools.jsonl';
const TOOLS_TOML = '.tools.toml';

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const isFile = (absPath: string): boolean =>
  fs.existsSync(absPath) && fs.statSync(absPath).isFile();

/**
 * Validate one flat tool entry and wrap it into the OpenAI Chat Completions
 * `tools[]` shape: `{ type: "function", function: { name, description?, parameters? } }`.
 *
 * Flat entries must contain `name` and may contain `description` / `parameters`.
 * Top-level `type` / `function` keys are rejected (the old nested form is no longer accepted).
 */
const normalizeFlatToolEntry = (
  rec: Record<string, unknown>,
  labelForErrors: string,
  locator: string,
): ToolDefinition => {
  if ('type' in rec || 'function' in rec) {
    throw new Error(
      `${labelForErrors}: ${locator}: tool entries must be flat (no "type" or "function" fields). Use { name, description?, parameters? }.`,
    );
  }
  if (typeof rec.name !== 'string' || rec.name.length === 0) {
    throw new Error(`${labelForErrors}: ${locator}: missing non-empty string "name"`);
  }
  let parameters: unknown = rec.parameters;
  if (typeof parameters === 'string') {
    try {
      parameters = JSON.parse(parameters) as unknown;
    } catch {
      throw new Error(`${labelForErrors}: ${locator}: invalid JSON in "parameters"`);
    }
  }
  if (
    parameters !== undefined &&
    (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters))
  ) {
    throw new Error(
      `${labelForErrors}: ${locator}: "parameters" must be an object (or JSON string of one)`,
    );
  }
  const description = rec.description;
  if (description !== undefined && typeof description !== 'string') {
    throw new Error(`${labelForErrors}: ${locator}: "description" must be a string`);
  }

  const fn: Record<string, unknown> = { name: rec.name };
  if (description !== undefined) fn.description = description;
  if (parameters !== undefined) fn.parameters = parameters;
  return { type: 'function', function: fn } as ToolDefinition;
};

const parseToolsJsonlContent = (raw: string, labelForErrors: string): ToolDefinition[] | undefined => {
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
      throw new Error(`${labelForErrors}: line ${i + 1} is not valid JSON`);
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error(`${labelForErrors}: line ${i + 1} must be a JSON object`);
    }
    const rec = obj as Record<string, unknown>;
    tools.push(normalizeFlatToolEntry(rec, labelForErrors, `line ${i + 1}`));
  }

  return tools.length > 0 ? tools : undefined;
};

const parseToolsJsonlFromAbsolutePath = (absPath: string): ToolDefinition[] | undefined => {
  const raw = stripBom(fs.readFileSync(absPath, 'utf8'));
  return parseToolsJsonlContent(raw, path.basename(absPath));
};

const parseToolsTomlContent = (raw: string, labelForErrors: string): ToolDefinition[] | undefined => {
  let root: unknown;
  try {
    root = parseToml(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${labelForErrors}: ${msg}`);
  }
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error(`${labelForErrors}: root must be a TOML table`);
  }
  const table = root as Record<string, unknown>;
  const toolsRaw = table.tools;
  if (toolsRaw === undefined || toolsRaw === null) {
    return undefined;
  }
  if (!Array.isArray(toolsRaw)) {
    throw new Error(`${labelForErrors}: "tools" must be an array`);
  }
  if (toolsRaw.length === 0) {
    return undefined;
  }

  const tools: ToolDefinition[] = [];
  for (let i = 0; i < toolsRaw.length; i++) {
    const item = toolsRaw[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${labelForErrors}: tools[${i}] must be a table`);
    }
    const rec = item as Record<string, unknown>;
    tools.push(normalizeFlatToolEntry(rec, labelForErrors, `tools[${i}]`));
  }
  return tools;
};

const parseToolsTomlFromAbsolutePath = (absPath: string): ToolDefinition[] | undefined => {
  const raw = stripBom(fs.readFileSync(absPath, 'utf8'));
  return parseToolsTomlContent(raw, path.basename(absPath));
};

/**
 * Load `.tools.jsonl` from the message directory root only (not recursive).
 * Returns `undefined` if the file is absent. Throws if present but invalid.
 */
export const loadToolsJsonl = (directory: string): ToolDefinition[] | undefined => {
  const fullPath = path.join(directory, TOOLS_JSONL);
  if (!isFile(fullPath)) {
    return undefined;
  }
  return parseToolsJsonlFromAbsolutePath(fullPath);
};

/**
 * Load `.tools.toml` from the message directory root only (not recursive).
 * Returns `undefined` if the file is absent. Throws if present but invalid.
 */
export const loadToolsToml = (directory: string): ToolDefinition[] | undefined => {
  const fullPath = path.join(directory, TOOLS_TOML);
  if (!isFile(fullPath)) {
    return undefined;
  }
  return parseToolsTomlFromAbsolutePath(fullPath);
};

const resolveExplicitToolsPath = (
  raw: string,
  baseDir: string
): { abs: string; ext: string } => {
  const abs = path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(baseDir, raw);
  const ext = path.extname(abs).toLowerCase();
  if (ext !== '.jsonl' && ext !== '.toml') {
    throw new Error(`Tools file must end with .jsonl or .toml: ${abs}`);
  }
  if (!isFile(abs)) {
    throw new Error(`Tools file not found: ${abs}`);
  }
  return { abs, ext };
};

export type LoadToolsParams = {
  directory: string;
  cwd: string;
  toolsFileCli?: string;
  toolsFileEnv?: string;
};

/**
 * Resolve tools from CLI path, env path, or default `.tools.toml` / `.tools.jsonl` in the scan root.
 * Priority: `toolsFileCli` > `toolsFileEnv` > defaults. Default mode: at most one of `.tools.toml` / `.tools.jsonl`.
 */
export const loadTools = (params: LoadToolsParams): ToolDefinition[] | undefined => {
  const { directory, cwd, toolsFileCli, toolsFileEnv } = params;
  const scanAbs = path.resolve(cwd, directory);

  if (toolsFileCli) {
    const { abs, ext } = resolveExplicitToolsPath(toolsFileCli, cwd);
    if (isPromptpileDiagnostic()) {
      console.error('[promptpile] tools source: --tools-file', abs);
    }
    return ext === '.jsonl' ? parseToolsJsonlFromAbsolutePath(abs) : parseToolsTomlFromAbsolutePath(abs);
  }
  if (toolsFileEnv) {
    const { abs, ext } = resolveExplicitToolsPath(toolsFileEnv, scanAbs);
    if (isPromptpileDiagnostic()) {
      console.error('[promptpile] tools source: TOOLS_FILE env', abs);
    }
    return ext === '.jsonl' ? parseToolsJsonlFromAbsolutePath(abs) : parseToolsTomlFromAbsolutePath(abs);
  }

  const tomlPath = path.join(scanAbs, TOOLS_TOML);
  const jsonlPath = path.join(scanAbs, TOOLS_JSONL);
  const hasToml = isFile(tomlPath);
  const hasJsonl = isFile(jsonlPath);
  if (hasToml && hasJsonl) {
    throw new Error(
      `Both ${TOOLS_JSONL} and ${TOOLS_TOML} exist in the message directory; keep only one.`
    );
  }
  if (hasToml) {
    if (isPromptpileDiagnostic()) {
      console.error('[promptpile] tools source: default', tomlPath);
    }
    return loadToolsToml(scanAbs);
  }
  if (hasJsonl) {
    if (isPromptpileDiagnostic()) {
      console.error('[promptpile] tools source: default', jsonlPath);
    }
    return loadToolsJsonl(scanAbs);
  }
  if (isPromptpileDiagnostic()) {
    console.error('[promptpile] tools source: (none under scan directory)', scanAbs);
  }
  return undefined;
};
