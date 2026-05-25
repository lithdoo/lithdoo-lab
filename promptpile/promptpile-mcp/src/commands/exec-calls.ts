import fs from 'fs';
import path from 'path';
import { normalizeGatewayBaseUrl } from '../export/url';
import {
  resultAbsPathForCallFile,
  stemFromCallsBasename,
} from '../exec-calls/calls-paths';
import { parseCallJsonlFile } from '../exec-calls/parse-call-jsonl';
import {
  parseExecCallsResponseBody,
  postExecCalls,
  truncateBody,
} from '../exec-calls/post-exec';
import { scanCallsJsonlFiles } from '../exec-calls/scan-call-files';
import {
  writeResultJsonlForCallsFile,
  writeResultJsonlToPath,
} from '../exec-calls/write-result-jsonl';

export type ExecCallsCliOptions = {
  baseUrl: string;
  /** 目录模式：扫描根目录；未设置时用 `process.cwd()`；与 `input` 互斥 */
  dir?: string;
  /** 单文件模式：仅此 `.calls.jsonl`；与 `dir` 互斥 */
  input?: string;
  /** 单文件模式：result 输出路径；省略则同目录 `stem.result.jsonl`（仅当 input 为 `.calls.jsonl`） */
  output?: string;
  /** 可选；请求网关时在 Authorization 中发送 Bearer token */
  token?: string;
  /** 为 true 时覆盖已存在的 result；默认仅处理尚无 result 的项 */
  overwriteResults?: boolean;
};

async function runExecCallsSingleFile(
  opts: ExecCallsCliOptions,
  baseUrlNorm: string,
  token: string | undefined,
  overwrite: boolean
): Promise<number> {
  const rawInput = opts.input?.trim();
  if (!rawInput) {
    console.error('promptpile-mcp: --input 不能为空');
    return 1;
  }

  const inputPath = path.resolve(rawInput);
  if (!fs.existsSync(inputPath)) {
    console.error(`promptpile-mcp: 输入文件不存在: ${inputPath}`);
    return 1;
  }
  const st = fs.statSync(inputPath);
  if (!st.isFile()) {
    console.error(`promptpile-mcp: --input 须为普通文件: ${inputPath}`);
    return 1;
  }

  const base = path.basename(inputPath);
  const stem = stemFromCallsBasename(base);
  if (stem === undefined) {
    console.error(
      'promptpile-mcp: --input 须为有效 .calls.jsonl 路径（去掉后缀后 stem 非空）'
    );
    return 1;
  }

  let resultOutPath: string;
  if (opts.output !== undefined && opts.output.trim() !== '') {
    resultOutPath = path.resolve(opts.output.trim());
  } else {
    resultOutPath = resultAbsPathForCallFile(inputPath, stem);
  }

  if (!overwrite && fs.existsSync(resultOutPath)) {
    console.error(
      `promptpile-mcp: 已存在 result，跳过（使用 --overwrite-results 可覆盖）: ${resultOutPath}`
    );
    return 0;
  }

  let calls;
  try {
    calls = parseCallJsonlFile(inputPath);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }

  if (calls.length === 0) {
    console.error(`promptpile-mcp: 跳过空文件: ${inputPath}`);
    return 1;
  }

  const httpRes = await postExecCalls(baseUrlNorm, token, calls);
  if (!httpRes.ok) {
    console.error(
      `promptpile-mcp: exec-calls HTTP ${httpRes.status}: ${truncateBody(httpRes.bodyText)}`
    );
    return 1;
  }

  let body: ReturnType<typeof parseExecCallsResponseBody>;
  try {
    body = parseExecCallsResponseBody(httpRes.bodyText);
  } catch (e) {
    console.error(
      `promptpile-mcp: exec-calls ${e instanceof Error ? e.message : String(e)}`
    );
    return 1;
  }

  writeResultJsonlToPath(resultOutPath, calls, body.results);
  console.log(`promptpile-mcp: 已写入 ${resultOutPath}`);
  return 0;
}

async function runExecCallsDirectory(
  opts: ExecCallsCliOptions,
  baseUrlNorm: string,
  token: string | undefined,
  overwrite: boolean
): Promise<number> {
  const root = path.resolve(opts.dir ?? process.cwd());
  if (!fs.existsSync(root)) {
    console.error(`promptpile-mcp: 目录不存在: ${root}`);
    return 1;
  }
  const st = fs.statSync(root);
  if (!st.isDirectory()) {
    console.error(`promptpile-mcp: 不是目录: ${root}`);
    return 1;
  }

  const allRefs = scanCallsJsonlFiles(root);

  if (allRefs.length === 0) {
    console.error('promptpile-mcp: 未发现 *.calls.jsonl，无可执行内容');
    return 1;
  }

  const toProcess = overwrite
    ? allRefs
    : allRefs.filter((r) => !fs.existsSync(r.resultAbsPath));

  if (toProcess.length === 0) {
    console.error(
      'promptpile-mcp: 全部 *.calls.jsonl 已有配对 result，未执行（使用 --overwrite-results 可覆盖）'
    );
    return 0;
  }

  let wroteAny = false;
  for (const { absPath, resultAbsPath } of toProcess) {
    let calls;
    try {
      calls = parseCallJsonlFile(absPath);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      return 1;
    }

    if (calls.length === 0) {
      console.error(`promptpile-mcp: 跳过空文件: ${absPath}`);
      continue;
    }

    const httpRes = await postExecCalls(baseUrlNorm, token, calls);
    if (!httpRes.ok) {
      console.error(
        `promptpile-mcp: exec-calls HTTP ${httpRes.status}: ${truncateBody(httpRes.bodyText)}`
      );
      return 1;
    }

    let body: ReturnType<typeof parseExecCallsResponseBody>;
    try {
      body = parseExecCallsResponseBody(httpRes.bodyText);
    } catch (e) {
      console.error(
        `promptpile-mcp: exec-calls ${e instanceof Error ? e.message : String(e)}`
      );
      return 1;
    }

    writeResultJsonlForCallsFile(absPath, calls, body.results);
    wroteAny = true;
    console.log(`promptpile-mcp: 已写入 ${resultAbsPath}`);
  }

  if (!wroteAny) {
    console.error(
      'promptpile-mcp: 所有 call 文件均为空，未写入任何 result.jsonl'
    );
    return 1;
  }

  return 0;
}

/**
 * **目录模式**：扫描 `--dir` 下任意 `*.calls.jsonl` → POST → 同目录 `stem.result.jsonl`。
 * **单文件模式**：`--input` 指定单个 `.calls.jsonl`，`--output` 可选（默认同目录配对）。
 * `--input` 与 `--dir` 互斥。默认跳过已存在配对 result；`--overwrite-results` 覆盖。
 */
export async function runExecCalls(
  opts: ExecCallsCliOptions
): Promise<number> {
  try {
    const hasInput =
      opts.input !== undefined && String(opts.input).trim() !== '';
    const hasExplicitDir = opts.dir !== undefined;

    if (opts.output !== undefined && opts.output.trim() !== '' && !hasInput) {
      console.error('promptpile-mcp: 使用 --output 时必须同时指定 --input');
      return 1;
    }

    if (hasInput && hasExplicitDir) {
      console.error('promptpile-mcp: 不能同时使用 --input 与 --dir');
      return 1;
    }

    const overwrite = opts.overwriteResults === true;
    const baseUrlNorm = normalizeGatewayBaseUrl(opts.baseUrl);
    const token =
      opts.token !== undefined && opts.token !== '' ? opts.token : undefined;

    if (hasInput) {
      return runExecCallsSingleFile(opts, baseUrlNorm, token, overwrite);
    }

    return runExecCallsDirectory(opts, baseUrlNorm, token, overwrite);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`promptpile-mcp: exec-calls 失败: ${msg}`);
    return 1;
  }
}
