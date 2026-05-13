const OBSERVE_STRIP_FLAGS: ReadonlySet<string> = new Set([
  '--tools-file',
  '--after-hook-path',
  '-o',
  '--output'
]);

/** Final: strip hook / temp output only; tool disabling is solely `--disable-tool` on the child argv. */
const FINAL_STRIP_FLAGS: ReadonlySet<string> = new Set(['--after-hook-path', '-o', '--output']);

/**
 * Remove paired CLI flags (flag + following argument). If a flag has no
 * following token, skip only the flag (same edge-case behavior as the
 * original Observe stripper).
 */
export function stripPairedFlags(
  argv: readonly string[],
  flagNames: ReadonlySet<string>
): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; ) {
    const a = argv[i];
    if (flagNames.has(a)) {
      if (i + 1 >= argv.length) {
        i += 1;
        continue;
      }
      i += 2;
      continue;
    }
    out.push(a);
    i += 1;
  }
  return out;
}

/** Observe round: drop forwarded tools/hook/output so Observe can inject its own. */
export function stripObserveRelevantFlags(argv: readonly string[]): string[] {
  return stripPairedFlags(argv, OBSERVE_STRIP_FLAGS);
}

/** Final round: strip after-hook / `-o` only; drop stray `--disable-tool` before appending a single instance. */
export function stripFinalForwardedArgs(argv: readonly string[]): string[] {
  const withoutPaired = stripPairedFlags(argv, FINAL_STRIP_FLAGS);
  return withoutPaired.filter((a) => a !== '--disable-tool');
}
