import readline from 'readline';

export async function readUserInput(): Promise<string> {
  process.stdout.write(
    '\nEnter your reply. Finish with Ctrl+Z then Enter (Windows), or Ctrl+D (macOS/Linux).\n'
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }

  rl.close();
  const text = lines.join('\n').trim();
  if (!text) {
    throw new Error('Empty input. Nothing was written.');
  }
  return text;
}
