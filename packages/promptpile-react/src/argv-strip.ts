/**
 * 从 argv 拷贝中移除 Observe 轮需覆盖/禁用的成对参数（flag + 下一参数）。
 */
export function stripObserveRelevantFlags(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; ) {
    const a = argv[i];
    if (a === '--tools-file' || a === '--after-hook-path' || a === '-o' || a === '--output') {
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
