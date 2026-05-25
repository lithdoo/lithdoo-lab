import fs from 'fs';
import path from 'path';
import type { ExecCallItem, ExecCallResult } from '../http/types';
import {
  resultAbsPathForCallFile,
  stemFromCallsBasename,
} from './calls-paths';

function resultContent(result: ExecCallResult): string {
  if (result.ok) {
    const c = result.content;
    if (c === undefined) {
      return '';
    }
    return typeof c === 'string' ? c : JSON.stringify(c);
  }
  return result.error ?? '执行失败';
}

function writeResultLinesToPath(
  outPath: string,
  calls: ExecCallItem[],
  results: ExecCallResult[]
): void {
  const byId = new Map(results.map((r) => [r.toolCallId, r]));
  const lines: string[] = [];

  for (const c of calls) {
    const r = byId.get(c.id);
    const content = r
      ? resultContent(r)
      : `错误：网关未返回 toolCallId=${c.id} 的结果`;

    const row: { tool_call_id: string; content: string; name?: string } = {
      tool_call_id: c.id,
      content,
    };
    if (c.function.name) {
      row.name = c.function.name;
    }
    lines.push(JSON.stringify(row));
  }

  fs.writeFileSync(
    outPath,
    lines.length > 0 ? `${lines.join('\n')}\n` : '',
    'utf8'
  );
}

/**
 * 写入指定路径的 result JSONL（与 promptpile `ToolResultLine` 对齐）。
 */
export function writeResultJsonlToPath(
  outputAbsPath: string,
  calls: ExecCallItem[],
  results: ExecCallResult[]
): void {
  writeResultLinesToPath(path.resolve(outputAbsPath), calls, results);
}

/**
 * 写入与 `callPath` 同目录的 `stem.result.jsonl`（stem 来自 basename 去掉 `.calls.jsonl`），与 promptpile `ToolResultLine` 对齐。
 */
export function writeResultJsonlForCallsFile(
  callPath: string,
  calls: ExecCallItem[],
  results: ExecCallResult[]
): void {
  const base = path.basename(callPath);
  const stem = stemFromCallsBasename(base);
  if (stem === undefined) {
    throw new Error(`writeResultJsonlForCallsFile: not a .calls.jsonl path: ${callPath}`);
  }

  const outPath = resultAbsPathForCallFile(callPath, stem);
  writeResultLinesToPath(outPath, calls, results);
}
