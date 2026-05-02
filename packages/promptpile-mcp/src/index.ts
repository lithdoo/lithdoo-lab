#!/usr/bin/env node
import { parseCli } from './cli';

function main(): void {
  parseCli();
  process.stdout.write(
    'promptpile-mcp: 脚手架已就绪；MCP 集成尚未接线。\n'
  );
}

try {
  main();
} catch (e) {
  console.error('Error:', e);
  process.exitCode = 1;
}
