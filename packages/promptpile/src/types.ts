/**
 * Synthetic `tool` message `content` when `assistant.call` lists a `tool_call_id` but
 * `[idx]assistant.result.jsonl` has no matching line (or the file is absent). Documented in README.
 */
export const formatMissingToolResultContent = (idx: number, toolCallId: string): string =>
  `错误：未在 [${idx}]assistant.result.jsonl 中找到 tool_call_id=${toolCallId}`;

/** OpenAI-style tool call on an assistant message. */
export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Chat Completions message shape (subset used by promptpile).
 * Maps directly to API JSON; optional fields omitted when unused.
 */
export interface ChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

/** One line in `[idx]assistant.result.jsonl`. */
export interface ToolResultLine {
  tool_call_id: string;
  content: string;
  name?: string;
}

/** Single element of the API `tools` array (e.g. one line of `.tools.jsonl`). */
export type ToolDefinition = Record<string, unknown>;

/** OpenAI Chat Completions `tool_choice` string values (subset used by promptpile). */
export type ChatApiToolChoiceString = 'none' | 'auto' | 'required';

/** OpenAI Chat Completions `tool_choice` (string or forced function). */
export type ChatApiToolChoice =
  | ChatApiToolChoiceString
  | { type: 'function'; function: { name: string } };

export type FileKind = 'message' | 'assistant_call' | 'assistant_result';

export interface FileInfo {
  path: string;
  idx: number;
  /** Role from filename for normal messages; for assistant_call/assistant_result use `assistant`. */
  role: string;
  extension: 'md' | 'json' | 'jsonl';
  fileKind: FileKind;
}

export interface Config {
  directory: string;
  model: string;
  apiKey: string;
  apiBaseUrl: string;
  format: 'text' | 'json';
  continueMode: boolean;
  inputMode: boolean;
  output?: string;
  quiet: boolean;
  /** CLI `--tools-file`: relative to cwd when relative. */
  toolsFileCli?: string;
  /** Env `TOOLS_FILE`: relative to scan directory root when relative. */
  toolsFileEnv?: string;
  /** CLI `--system-inject-file`: relative to cwd when relative. */
  systemInjectFileCli?: string;
  /** CLI `--after-hook-path`: relative to cwd when relative. */
  afterHookCli?: string;
  /** Env `AFTER_HOOK_PATH`: relative to scan directory when relative. */
  afterHookEnv?: string;
  /**
   * Raw `none` | `auto` | `required` | `function:<name>` from CLI `--tool-choice` or env `TOOL_CHOICE`.
   * Parsed to {@link ChatApiToolChoice} when building the API body.
   */
  toolChoice?: string;
}

export interface AiCallResult {
  content: string;
  toolCalls: ToolCall[] | undefined;
}
