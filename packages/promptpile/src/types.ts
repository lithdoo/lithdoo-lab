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
}

export interface AiCallResult {
  content: string;
  toolCalls: ToolCall[] | undefined;
}
