#!/usr/bin/env node
import { parseCli } from './cli';

function main(): void {
  parseCli();
  process.stdout.write('day-loom: scaffold ready.\n');
}

try {
  main();
} catch (e) {
  console.error('Error:', e);
  process.exitCode = 1;
}
