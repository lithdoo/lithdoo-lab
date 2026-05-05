import type { ExecCallItem, ExecCallResult } from '../http/types';

export type ExecCallsHttpBody = {
  results: ExecCallResult[];
};

const FETCH_TIMEOUT_MS = 60_000;
const BODY_SNIPPET_MAX = 500;

export function truncateBody(text: string): string {
  if (text.length <= BODY_SNIPPET_MAX) return text;
  return `${text.slice(0, BODY_SNIPPET_MAX)}...`;
}

export async function postExecCalls(
  baseUrl: string,
  token: string | undefined,
  calls: ExecCallItem[]
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const url = `${baseUrl}/v1/calls/exec`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token !== undefined && token !== '') {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ calls }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const bodyText = await res.text();
  return { ok: res.ok, status: res.status, bodyText };
}

export function parseExecCallsResponseBody(bodyText: string): ExecCallsHttpBody {
  let data: unknown;
  try {
    data = JSON.parse(bodyText) as unknown;
  } catch {
    throw new Error('响应不是合法 JSON');
  }
  if (!data || typeof data !== 'object' || !('results' in data)) {
    throw new Error('响应缺少 results 字段');
  }
  const results = (data as { results: unknown }).results;
  if (!Array.isArray(results)) {
    throw new Error('响应中 results 须为数组');
  }
  return { results: results as ExecCallResult[] };
}
