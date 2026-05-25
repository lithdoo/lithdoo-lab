#!/usr/bin/env node
import { parseCli } from './cli';

function main(): void {
  parseCli();
  process.stdout.write(
    'statelith: 脚手架已就绪；State Document 规范与 parse / watch / emit 尚未实现。\n'
  );
}

try {
  main();
} catch (e) {
  console.error('Error:', e);
  process.exitCode = 1;
}
