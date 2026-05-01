/**
 * Opt-in diagnostics (stderr, `[promptpile]` prefix).
 * Set `PROMPTPILE_DEBUG=1` (or `true` / `yes` / `on`) to enable extra lines even when `-q` / `QUIET` is on.
 */

import type { ToolDefinition } from './types';

export const toolNamesFromDefinitions = (tools: ToolDefinition[] | undefined): string[] => {
  if (!tools?.length) return [];
  return tools.map(t => {
    const fn = (t as { function?: { name?: unknown } }).function;
    return typeof fn?.name === 'string' && fn.name.length > 0 ? fn.name : '?';
  });
};

export const isPromptpileDiagnostic = (): boolean => {
  const v = process.env.PROMPTPILE_DEBUG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

/** Log to stderr when not quiet, or when PROMPTPILE_DEBUG is set. */
export const diagnosticLog = (quiet: boolean, ...parts: unknown[]): void => {
  if (quiet && !isPromptpileDiagnostic()) return;
  console.error('[promptpile]', ...parts);
};
