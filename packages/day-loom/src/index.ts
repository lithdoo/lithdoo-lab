#!/usr/bin/env node
import { parseCli } from './cli';

try {
  parseCli();
} catch (e) {
  console.error('Error:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
