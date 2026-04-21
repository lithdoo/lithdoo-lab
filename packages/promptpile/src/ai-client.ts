import fetch from 'node-fetch';
import type { AiCallResult, ChatApiToolChoice, ChatMessage, ToolCall, ToolDefinition } from './types';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
  error?: { message?: string };
}

interface StreamDeltaToolCall {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string | null };
}

interface ChatCompletionStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: StreamDeltaToolCall[];
    };
  }>;
  error?: { message?: string };
}

const trimTrailingSlash = (url: string) => url.replace(/\/$/, '');

const createPayload = (
  model: string,
  messages: ChatMessage[],
  stream: boolean,
  tools: ToolDefinition[] | undefined,
  toolChoice: ChatApiToolChoice | undefined
) => {
  const body: Record<string, unknown> = {
    model,
    stream,
    messages
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    if (toolChoice !== undefined) {
      body.tool_choice = toolChoice;
    }
  }
  return body;
};

const createHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
});

export const normalizeToolCalls = (raw: unknown): ToolCall[] | undefined => {
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const out: ToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const t = item as Record<string, unknown>;
    const id = typeof t.id === 'string' ? t.id : '';
    const type = typeof t.type === 'string' ? t.type : 'function';
    const fn = t.function;
    if (!fn || typeof fn !== 'object') {
      continue;
    }
    const f = fn as Record<string, unknown>;
    const name = typeof f.name === 'string' ? f.name : '';
    const args = typeof f.arguments === 'string' ? f.arguments : '';
    if (!id) {
      continue;
    }
    out.push({
      id,
      type,
      function: { name, arguments: args }
    });
  }
  return out.length > 0 ? out : undefined;
};

/** Merge streaming `delta.tool_calls` chunks into complete `ToolCall[]`. */
export const mergeStreamToolCalls = (deltas: StreamDeltaToolCall[]): ToolCall[] => {
  type Builder = {
    id: string;
    type: string;
    name: string;
    arguments: string;
  };
  const byIndex = new Map<number, Builder>();

  for (const tc of deltas) {
    const index = typeof tc.index === 'number' ? tc.index : 0;
    let b = byIndex.get(index);
    if (!b) {
      b = { id: '', type: 'function', name: '', arguments: '' };
      byIndex.set(index, b);
    }
    if (tc.id) {
      b.id = tc.id;
    }
    if (tc.type) {
      b.type = tc.type;
    }
    if (tc.function?.name) {
      b.name = tc.function.name;
    }
    if (tc.function?.arguments) {
      b.arguments += tc.function.arguments;
    }
  }

  const indices = [...byIndex.keys()].sort((a, b) => a - b);
  const out: ToolCall[] = [];
  for (const i of indices) {
    const b = byIndex.get(i);
    if (!b || !b.id) {
      continue;
    }
    out.push({
      id: b.id,
      type: b.type,
      function: { name: b.name, arguments: b.arguments }
    });
  }
  return out;
};

export const callAI = async (
  apiKey: string,
  apiBaseUrl: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] | undefined,
  toolChoice: ChatApiToolChoice | undefined
): Promise<AiCallResult> => {
  const url = `${trimTrailingSlash(apiBaseUrl)}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: createHeaders(apiKey),
      body: JSON.stringify(createPayload(model, messages, false, tools, toolChoice))
    });

    const data = (await res.json()) as ChatCompletionResponse;

    if (!res.ok) {
      const detail = data.error?.message ?? res.statusText;
      console.error('Error calling AI API:', detail);
      throw new Error(`AI API error (${res.status}): ${detail}`);
    }

    const msg = data.choices?.[0]?.message;
    const content = msg?.content ?? '';
    const toolCalls = normalizeToolCalls(msg?.tool_calls);

    return { content, toolCalls };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI API error')) {
      throw error;
    }
    console.error('Error calling AI API:', error);
    console.error('Please check your network connection and API key');
    throw new Error('Failed to call AI API. Please check your network connection and API key.');
  }
};

export const callAIStream = async (
  apiKey: string,
  apiBaseUrl: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[] | undefined,
  toolChoice: ChatApiToolChoice | undefined,
  onChunk: (chunk: string) => void
): Promise<AiCallResult> => {
  const url = `${trimTrailingSlash(apiBaseUrl)}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: createHeaders(apiKey),
      body: JSON.stringify(createPayload(model, messages, true, tools, toolChoice))
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as ChatCompletionStreamChunk;
      const detail = data.error?.message ?? res.statusText;
      console.error('Error calling AI API:', detail);
      throw new Error(`AI API error (${res.status}): ${detail}`);
    }

    if (!res.body) {
      throw new Error('AI API did not return a stream body.');
    }

    let fullText = '';
    let buffer = '';
    const streamToolDeltas: StreamDeltaToolCall[] = [];

    for await (const chunk of res.body) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          continue;
        }

        try {
          const data = JSON.parse(payload) as ChatCompletionStreamChunk;
          const delta = data.choices?.[0]?.delta;
          const piece = delta?.content ?? '';
          if (piece) {
            fullText += piece;
            onChunk(piece);
          }
          const tc = delta?.tool_calls;
          if (tc && tc.length > 0) {
            streamToolDeltas.push(...tc);
          }
        } catch {
          // Ignore non-JSON lines to keep streaming resilient across providers.
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      const payload = buffer.trim().slice(5).trim();
      if (payload && payload !== '[DONE]') {
        try {
          const data = JSON.parse(payload) as ChatCompletionStreamChunk;
          const delta = data.choices?.[0]?.delta;
          const piece = delta?.content ?? '';
          if (piece) {
            fullText += piece;
            onChunk(piece);
          }
          const tc = delta?.tool_calls;
          if (tc && tc.length > 0) {
            streamToolDeltas.push(...tc);
          }
        } catch {
          // Ignore trailing malformed payload.
        }
      }
    }

    const merged = mergeStreamToolCalls(streamToolDeltas);
    const toolCalls = merged.length > 0 ? merged : undefined;

    return { content: fullText, toolCalls };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI API error')) {
      throw error;
    }
    console.error('Error calling AI API:', error);
    console.error('Please check your network connection and API key');
    throw new Error('Failed to call AI API. Please check your network connection and API key.');
  }
};
