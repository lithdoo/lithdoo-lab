import fs from 'fs';
import path from 'path';
import {
  resultAbsPathForCallFile,
  stemFromCallsBasename,
} from './calls-paths';

export type CallFileRef = {
  absPath: string;
  stem: string;
  resultAbsPath: string;
};

function walkFiles(dir: string, out: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
}

/**
 * 递归扫描 `rootAbs`，收集以 `.calls.jsonl` 结尾的文件；配对结果为同目录 `stem + '.result.jsonl'`。
 * 非法 basename `.calls.jsonl`（空 stem）跳过并 stderr 警告。
 */
export function scanCallsJsonlFiles(rootAbs: string): CallFileRef[] {
  if (!fs.existsSync(rootAbs)) {
    return [];
  }
  const stat = fs.statSync(rootAbs);
  if (!stat.isDirectory()) {
    return [];
  }

  const all: string[] = [];
  walkFiles(rootAbs, all);

  const refs: CallFileRef[] = [];

  for (const abs of all) {
    const base = path.basename(abs);
    const stem = stemFromCallsBasename(base);
    if (stem === undefined) {
      if (base.endsWith('.calls.jsonl')) {
        console.error(`promptpile-mcp: 跳过（无效的 .calls.jsonl 文件名）: ${abs}`);
      }
      continue;
    }
    refs.push({
      absPath: abs,
      stem,
      resultAbsPath: resultAbsPathForCallFile(abs, stem),
    });
  }

  refs.sort((a, b) => a.absPath.localeCompare(b.absPath));
  return refs;
}
