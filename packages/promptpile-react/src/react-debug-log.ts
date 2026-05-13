/**
 * Opt-in orchestration diagnostics (stderr, `[promptpile-react]` prefix).
 * Set `PROMPTPILE_REACT_DEBUG=1` (or `true` / `yes` / `on`) — does not enable child `promptpile` `PROMPTPILE_DEBUG`.
 */

export const isPromptpileReactDebug = (): boolean => {
  const v = process.env.PROMPTPILE_REACT_DEBUG?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
};

/** One line per call when debug is on; always stderr so stdout stays for streamed model text. */
export const reactDebugLog = (...parts: unknown[]): void => {
  if (!isPromptpileReactDebug()) {
    return;
  }
  console.error('[promptpile-react]', ...parts);
};
