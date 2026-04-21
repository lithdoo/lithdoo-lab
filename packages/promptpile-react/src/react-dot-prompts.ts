import fs from 'fs';
import path from 'path';

/** 平铺在 `-d` 根目录的 ReAct 协议文件名（不会被 promptpile 消息扫描匹配）。 */
export const REACT_DOT_CORE_FILENAME = '.react.core.md';
export const REACT_DOT_OBS_FILENAME = '.react.obs.md';
export const REACT_DOT_FINAL_FILENAME = '.react.final.md';

/** 无 `.react.core.md` 或文件为空时使用。不强制终稿格式，终稿仅由 `.react.final.md` 约束。 */
export const DEFAULT_REACT_CORE_PROMPT = `你是一个按 ReAct 方式思考的助手：在需要时使用工具，逐步推进任务。

请遵循：
- **Thought**：简要说明当前推理与计划。
- **Action**：在需要调用工具时发起工具调用；不要编造未执行的工具结果。
- **Observation**：仅使用工具真实返回或环境给出的观察内容；没有工具结果时不要虚构 Observation。

一次只推进一小步，保持诚实与可追溯。`;

/** 无 `.react.obs.md` 或文件为空时使用。具体截断与结构化由调用方代码落实。 */
export const DEFAULT_REACT_OBS_PROMPT = `工具返回（Observation）在写入对话时应：

- 优先**简洁、可读**；必要时可使用 JSON 或条目列表便于解析。
- **不要**在 Observation 中重复冗长的系统说明；避免无意义前缀堆砌。
- 若内容过长，由运行时策略做截断或摘要；此处仅作风格与结构上的约定。`;

export interface ReactDotPrompts {
  core: string;
  obs: string;
  /** 来自 `.react.final.md`；无文件或为空时为 `''`，表示不注入终稿协议、不生成最终答案（由调用方判定）。 */
  final: string;
}

const stripBom = (s: string): string => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

/**
 * 读取单个点文件：须为普通文件；读入后去 BOM、trim；空串视为「未配置」。
 * @returns 有有效内容时返回字符串，否则 `undefined`。
 */
const readDotFileNonEmpty = (absPath: string): string | undefined => {
  if (!fs.existsSync(absPath)) {
    return undefined;
  }
  const st = fs.statSync(absPath);
  if (!st.isFile()) {
    return undefined;
  }
  const raw = fs.readFileSync(absPath, 'utf8');
  const text = stripBom(raw).trim();
  return text === '' ? undefined : text;
};

/**
 * 从消息目录根读取 `.react.core.md`、`.react.obs.md`、`.react.final.md`。
 * Core/Obs：缺失或空 → 中文内置默认。Final：不设内置；缺失或空则 `final` 为 `''`。
 */
export const loadReactDotPrompts = (directory: string, cwd?: string): ReactDotPrompts => {
  const root = path.resolve(cwd ?? process.cwd(), directory);
  const core = readDotFileNonEmpty(path.join(root, REACT_DOT_CORE_FILENAME)) ?? DEFAULT_REACT_CORE_PROMPT;
  const obs = readDotFileNonEmpty(path.join(root, REACT_DOT_OBS_FILENAME)) ?? DEFAULT_REACT_OBS_PROMPT;
  const final = readDotFileNonEmpty(path.join(root, REACT_DOT_FINAL_FILENAME)) ?? '';
  return { core, obs, final };
};
