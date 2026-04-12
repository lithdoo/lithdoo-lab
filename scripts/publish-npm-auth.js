#!/usr/bin/env node
/**
 * Reads root .npmrc, extracts the first line containing _authToken=,
 * writes a minimal npmrc for publish (registry + token only).
 * Usage: node scripts/publish-npm-auth.js <source.npmrc> <dest.npmrc>
 */
const fs = require('fs');

const src = process.argv[2];
const dst = process.argv[3];

if (!src || !dst) {
  console.error('Usage: node scripts/publish-npm-auth.js <source.npmrc> <dest.npmrc>');
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error('Missing file:', src);
  process.exit(2);
}

const text = fs.readFileSync(src, 'utf8');
let token = '';
for (const line of text.split(/\r?\n/)) {
  const i = line.indexOf('_authToken=');
  if (i >= 0) {
    token = line.slice(i + '_authToken='.length).trim();
    if (token) break;
  }
}

if (!token) {
  console.error('No _authToken= line found in:', src);
  process.exit(3);
}

fs.writeFileSync(
  dst,
  [
    'registry=https://registry.npmjs.org/',
    `//registry.npmjs.org/:_authToken=${token}`,
    ''
  ].join('\n'),
  'utf8'
);
