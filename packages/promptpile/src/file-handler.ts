import fs from 'fs';
import path from 'path';
import { readFileSync as readUtf8FileFromDisk } from '@agent-tool-lite/file';
import { normalizeToolCalls } from './ai-client';
import type { ChatMessage, FileInfo, ToolCall, ToolResultLine } from './types';
import { formatMissingToolResultContent } from './types';

const FILE_PATTERN = /^\[(\d+)\](.+?)\.(md|json)$/i;
const ASSISTANT_CALL_PATTERN = /^\[(\d+)\]assistant\.calls\.jsonl$/i;
const ASSISTANT_RESULT_PATTERN = /^\[(\d+)\]assistant\.result\.jsonl$/i;

export const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/** YAML front matter: opening `---` on first line, closing `---` on a later line. */
export const stripYamlFrontMatter = (raw: string): string => {
  const text = stripBom(raw);
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return text;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return lines.slice(i + 1).join('\n');
    }
  }
  return text;
};

/** Sort key: non-assistant messages, then `[idx]assistant.md`, then call, then result. */
const tier = (f: FileInfo): number => {
  if (f.fileKind === 'assistant_result') {
    return 3;
  }
  if (f.fileKind === 'assistant_call') {
    return 2;
  }
  if (f.fileKind === 'message' && f.role === 'assistant' && f.extension === 'md') {
    return 1;
  }
  return 0;
};

const compareScannedFiles = (a: FileInfo, b: FileInfo): number => {
  if (a.idx !== b.idx) {
    return a.idx - b.idx;
  }
  const ta = tier(a);
  const tb = tier(b);
  if (ta !== tb) {
    return ta - tb;
  }
  const ra = a.role.localeCompare(b.role);
  if (ra !== 0) {
    return ra;
  }
  return a.path.localeCompare(b.path);
};

export const scanDirectory = (directory: string): FileInfo[] => {
  const files: FileInfo[] = [];

  const traverse = (currentPath: string) => {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        let m = entry.name.match(FILE_PATTERN);
        if (m) {
          const ext = m[3].toLowerCase() as 'md' | 'json';
          files.push({
            path: fullPath,
            idx: parseInt(m[1], 10),
            role: m[2],
            extension: ext,
            fileKind: 'message'
          });
          continue;
        }
        m = entry.name.match(ASSISTANT_CALL_PATTERN);
        if (m) {
          files.push({
            path: fullPath,
            idx: parseInt(m[1], 10),
            role: 'assistant',
            extension: 'jsonl',
            fileKind: 'assistant_call'
          });
          continue;
        }
        m = entry.name.match(ASSISTANT_RESULT_PATTERN);
        if (m) {
          files.push({
            path: fullPath,
            idx: parseInt(m[1], 10),
            role: 'assistant',
            extension: 'jsonl',
            fileKind: 'assistant_result'
          });
        }
      }
    }
  };

  traverse(directory);
  return files.sort(compareScannedFiles);
};

const readMessageFileContent = (file: FileInfo): string => {
  let content = readUtf8FileFromDisk(file.path);
  if (file.extension === 'md') {
    content = stripYamlFrontMatter(content);
  }
  return content;
};

const parseAssistantCallFile = (raw: string): ToolCall[] => {
  const text = stripBom(raw).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return normalizeToolCalls(parsed) ?? [];
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const toolCalls = (parsed as { tool_calls?: unknown }).tool_calls;
      if (Array.isArray(toolCalls)) {
        return normalizeToolCalls(toolCalls) ?? [];
      }
    }
  } catch {
    // fall through to JSONL
  }

  const lines = stripBom(raw).split(/\r?\n/).filter(l => l.trim());
  const collected: ToolCall[] = [];
  for (const line of lines) {
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (Array.isArray(obj)) {
      const n = normalizeToolCalls(obj);
      if (n) {
        collected.push(...n);
      }
    } else if (obj && typeof obj === 'object' && 'id' in (obj as object)) {
      const n = normalizeToolCalls([obj]);
      if (n) {
        collected.push(...n);
      }
    }
  }
  return collected;
};

const parseAssistantResultFile = (raw: string): ToolResultLine[] => {
  const lines = stripBom(raw).split(/\r?\n/).filter(l => l.trim());
  const out: ToolResultLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    let obj: unknown;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      throw new Error(`Invalid JSON on line ${i + 1} of assistant.result.jsonl`);
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error(`assistant.result.jsonl line ${i + 1} must be a JSON object`);
    }
    const rec = obj as Record<string, unknown>;
    if (typeof rec.tool_call_id !== 'string' || !rec.tool_call_id) {
      throw new Error(`assistant.result.jsonl line ${i + 1} must include string "tool_call_id"`);
    }
    if (typeof rec.content !== 'string') {
      throw new Error(`assistant.result.jsonl line ${i + 1} must include string "content"`);
    }
    const line: ToolResultLine = {
      tool_call_id: rec.tool_call_id,
      content: rec.content
    };
    if (typeof rec.name === 'string') {
      line.name = rec.name;
    }
    out.push(line);
  }
  return out;
};

const buildMessagesForIdx = (group: FileInfo[]): ChatMessage[] => {
  const idx = group[0]?.idx ?? 0;
  const messages: ChatMessage[] = [];
  const callFile = group.find(f => f.fileKind === 'assistant_call');
  const resultFile = group.find(f => f.fileKind === 'assistant_result');
  const messageFiles = group.filter(f => f.fileKind === 'message');
  const assistantMdFile = messageFiles.find(
    f => f.role === 'assistant' && f.extension === 'md'
  );
  const otherMessageFiles = messageFiles.filter(f => f !== assistantMdFile);

  for (const file of otherMessageFiles) {
    const content = readMessageFileContent(file);
    messages.push({
      role: file.role,
      content
    });
  }

  let callToolCalls: ToolCall[] | undefined;
  if (callFile) {
    const raw = readUtf8FileFromDisk(callFile.path);
    callToolCalls = parseAssistantCallFile(raw);
  }

  const assistantText = assistantMdFile
    ? readMessageFileContent(assistantMdFile)
    : undefined;
  const hasCalls = !!callToolCalls && callToolCalls.length > 0;
  const hasMdFile = !!assistantMdFile;

  if (hasCalls && hasMdFile) {
    messages.push({
      role: 'assistant',
      content: assistantText ?? '',
      tool_calls: callToolCalls
    });
  } else if (hasCalls) {
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: callToolCalls
    });
  } else if (hasMdFile) {
    messages.push({
      role: 'assistant',
      content: assistantText ?? ''
    });
  }

  const idsFromCall = callToolCalls && callToolCalls.length > 0 ? callToolCalls : undefined;

  if (resultFile) {
    const raw = readUtf8FileFromDisk(resultFile.path);
    const rows = parseAssistantResultFile(raw);
    const byId = new Map(rows.map(r => [r.tool_call_id, r]));

    if (idsFromCall) {
      for (const tc of idsFromCall) {
        const r = byId.get(tc.id);
        const msg: ChatMessage = {
          role: 'tool',
          tool_call_id: tc.id,
          content: r ? r.content : formatMissingToolResultContent(idx, tc.id)
        };
        if (r?.name) {
          msg.name = r.name;
        }
        messages.push(msg);
      }
    } else {
      for (const r of rows) {
        const msg: ChatMessage = {
          role: 'tool',
          tool_call_id: r.tool_call_id,
          content: r.content
        };
        if (r.name) {
          msg.name = r.name;
        }
        messages.push(msg);
      }
    }
  } else if (idsFromCall) {
    for (const tc of idsFromCall) {
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: formatMissingToolResultContent(idx, tc.id)
      });
    }
  }

  return messages;
};

export const buildMessages = (files: FileInfo[]): ChatMessage[] => {
  const byIdx = new Map<number, FileInfo[]>();
  for (const f of files) {
    if (!byIdx.has(f.idx)) {
      byIdx.set(f.idx, []);
    }
    byIdx.get(f.idx)!.push(f);
  }

  const indices = [...byIdx.keys()].sort((a, b) => a - b);
  const out: ChatMessage[] = [];

  for (const idx of indices) {
    const group = byIdx.get(idx)!;
    group.sort(compareScannedFiles);
    out.push(...buildMessagesForIdx(group));
  }

  return out;
};

/** @deprecated Use buildMessages(scanDirectory(...)) */
export const readFiles = (files: FileInfo[]): ChatMessage[] => {
  return buildMessages(files);
};

export const appendAssistantMessage = (
  directory: string,
  files: FileInfo[],
  content: string
): string | undefined => {
  return appendAssistantTurn(directory, files, content, undefined).mdPath;
};

export const appendUserMessage = (directory: string, files: FileInfo[], content: string): string => {
  return appendMessage(directory, files, 'user', content);
};

/**
 * Find the smallest index N (>= max(files.idx)+1) such that none of
 * `[N]assistant.md`, `[N]assistant.calls.jsonl`, `[N]assistant.result.jsonl`
 * exist on disk; used by `appendAssistantTurn` so the markdown reply and the
 * companion `.calls.jsonl` (continue) always share the same `N`.
 */
export const nextAssistantIdx = (directory: string, files: FileInfo[]): number => {
  const maxIdx = files.reduce((max, file) => Math.max(max, file.idx), -1);
  let idx = maxIdx + 1;
  while (
    fs.existsSync(path.join(directory, `[${idx}]assistant.md`)) ||
    fs.existsSync(path.join(directory, `[${idx}]assistant.calls.jsonl`)) ||
    fs.existsSync(path.join(directory, `[${idx}]assistant.result.jsonl`))
  ) {
    idx += 1;
  }
  return idx;
};

/**
 * Write an assistant turn under `--continue` semantics. `mdPath` and `callsPath`
 * are independent and may both be set for a single `[N]`; `buildMessagesForIdx`
 * merges them into one assistant message with both `content` and `tool_calls`:
 *
 * - When `content` is non-empty, write `[N]assistant.md`.
 * - When `toolCalls` is non-empty, write `[N]assistant.calls.jsonl`.
 * - When neither is present, reserve nothing on disk.
 */
export const appendAssistantTurn = (
  directory: string,
  files: FileInfo[],
  content: string,
  toolCalls: ToolCall[] | undefined
): { idx: number; mdPath?: string; callsPath?: string } => {
  const idx = nextAssistantIdx(directory, files);
  let mdPath: string | undefined;
  let callsPath: string | undefined;

  if (content.length > 0) {
    mdPath = path.join(directory, `[${idx}]assistant.md`);
    fs.writeFileSync(mdPath, content, 'utf8');
  }
  if (toolCalls && toolCalls.length > 0) {
    callsPath = path.join(directory, `[${idx}]assistant.calls.jsonl`);
    const body = toolCalls.map(tc => JSON.stringify(tc)).join('\n') + '\n';
    fs.writeFileSync(callsPath, body, 'utf8');
  }

  return { idx, mdPath, callsPath };
};

const appendMessage = (directory: string, files: FileInfo[], role: string, content: string): string => {
  const maxIdx = files.reduce((max, file) => Math.max(max, file.idx), -1);
  let nextIdx = maxIdx + 1;
  let filePath = path.join(directory, `[${nextIdx}]${role}.md`);

  while (fs.existsSync(filePath)) {
    nextIdx += 1;
    filePath = path.join(directory, `[${nextIdx}]${role}.md`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
};
