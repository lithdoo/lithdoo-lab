'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const root = path.join(__dirname, '..');
const { computeDir0, resolveConfig } = require(path.join(root, 'dist', 'resolve-config.js'));

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-dir0-'));
try {
  assert.strictEqual(
    computeDir0(base, 'a', undefined, undefined, undefined),
    path.resolve(base, 'a')
  );
  assert.strictEqual(
    computeDir0(base, undefined, 'from-toml', 'from-cwd', undefined),
    path.resolve(base, 'from-toml')
  );
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-cfg-'));
const prevCwd = process.cwd();
const hadModel = Object.prototype.hasOwnProperty.call(process.env, 'AI_MODEL');
const prevModel = process.env.AI_MODEL;
try {
  process.chdir(tmp);
  delete process.env.AI_MODEL;

  const msgRel = 'messages';
  const msgAbs = path.join(tmp, msgRel);
  fs.mkdirSync(msgAbs, { recursive: true });

  fs.writeFileSync(path.join(tmp, '.env'), `DEFAULT_DIRECTORY=${msgRel}\nAI_MODEL=m-cwd\n`);
  fs.writeFileSync(path.join(msgAbs, '.env'), 'AI_MODEL=m-scan\n');

  const fakeScript = path.join(tmp, 'fake-index.js');
  fs.writeFileSync(fakeScript, '');
  const cfg = resolveConfig(tmp, ['node', fakeScript, '-k', 'key']);
  assert.strictEqual(cfg.model, 'm-scan', 'scan .env overrides cwd .env');

  const tomlPath = path.join(tmp, 'app.toml');
  fs.writeFileSync(tomlPath, '[promptpile]\nllm_api_model = "m-toml"\n');
  const cfg2 = resolveConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key']);
  assert.strictEqual(cfg2.model, 'm-toml', 'toml overrides scan for model');

  const cfg3 = resolveConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key', '-m', 'm-cli']);
  assert.strictEqual(cfg3.model, 'm-cli', 'cli overrides toml');

  const cfgDefaultTemp = resolveConfig(tmp, ['node', fakeScript, '-k', 'key']);
  assert.strictEqual(cfgDefaultTemp.temperature, 0.8, 'default temperature when unset');

  fs.writeFileSync(
    tomlPath,
    '[promptpile]\nllm_api_temperature = 0.3\n'
  );
  const cfgTomlTemp = resolveConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key']);
  assert.strictEqual(cfgTomlTemp.temperature, 0.3, 'toml llm_api_temperature');

  const cfgCliTemp = resolveConfig(tmp, [
    'node',
    fakeScript,
    '--config',
    'app.toml',
    '-k',
    'key',
    '--temperature',
    '0.1'
  ]);
  assert.strictEqual(cfgCliTemp.temperature, 0.1, 'cli --temperature overrides toml');

  fs.writeFileSync(
    tomlPath,
    '[promptpile]\nllm_api_extra_body = { a = 1 }\n'
  );
  const cfgTomlExtra = resolveConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key']);
  assert.deepStrictEqual(cfgTomlExtra.extraBody, { a: 1 }, 'toml llm_api_extra_body');

  fs.writeFileSync(path.join(msgAbs, '.env'), 'PROMPTPILE_LLM_API_EXTRA_BODY={"b":2}\n');
  const cfgEnvExtra = resolveConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key']);
  assert.deepStrictEqual(cfgEnvExtra.extraBody, { a: 1 }, 'toml extra_body wins over scan env');

  fs.writeFileSync(tomlPath, '[promptpile]\n');
  const cfgScanExtra = resolveConfig(tmp, ['node', fakeScript, '-k', 'key']);
  assert.deepStrictEqual(cfgScanExtra.extraBody, { b: 2 }, 'scan env extra_body when toml unset');

  const cfgCliExtra = resolveConfig(tmp, [
    'node',
    fakeScript,
    '--config',
    'app.toml',
    '-k',
    'key',
    '--extra-body',
    '{"c":3}'
  ]);
  assert.deepStrictEqual(cfgCliExtra.extraBody, { c: 3 }, 'cli --extra-body overrides env');

  fs.writeFileSync(
    tomlPath,
    '[promptpile]\noutput_pile_file = "toml-new.jsonl"\noutput_pipe = "toml-old.jsonl"\noutput_pile_fd = 3\noutput_pile_format = "json"\n'
  );
  fs.writeFileSync(
    path.join(msgAbs, '.env'),
    'PROMPTPILE_OUTPUT_PILE_FILE=scan-new.txt\nPROMPTPILE_OUTPUT_PIPE=scan-old.txt\nPROMPTPILE_OUTPUT_PILE_FD=5\nPROMPTPILE_OUTPUT_PILE_FORMAT=text\n'
  );
  const cfgTomlPile = resolveConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key']);
  assert.strictEqual(cfgTomlPile.outputPileFile, 'toml-new.jsonl', 'toml output_pile_file overrides scan env and old toml alias');
  assert.strictEqual(cfgTomlPile.outputPileFd, 3, 'toml output_pile_fd');
  assert.strictEqual(cfgTomlPile.outputPileFormat, 'json', 'toml output_pile_format');

  fs.writeFileSync(tomlPath, '[promptpile]\noutput_pipe = "toml-old-only.jsonl"\noutput_pipe_format = "json"\n');
  const cfgOldTomlPile = resolveConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key']);
  assert.strictEqual(cfgOldTomlPile.outputPileFile, 'toml-old-only.jsonl', 'old toml output_pipe alias');
  assert.strictEqual(cfgOldTomlPile.outputPileFormat, 'json', 'old toml output_pipe_format alias');

  fs.writeFileSync(tomlPath, '[promptpile]\n');
  const cfgScanPile = resolveConfig(tmp, ['node', fakeScript, '-k', 'key']);
  assert.strictEqual(cfgScanPile.outputPileFile, 'scan-new.txt', 'scan env output pile file when toml unset');
  assert.strictEqual(cfgScanPile.outputPileFd, 5, 'scan env output pile fd');
  assert.strictEqual(cfgScanPile.outputPileFormat, 'text', 'scan env output pile format');

  fs.writeFileSync(path.join(msgAbs, '.env'), 'PROMPTPILE_OUTPUT_PIPE=scan-old-only.txt\nPROMPTPILE_OUTPUT_PIPE_FORMAT=json\n');
  const cfgOldScanPile = resolveConfig(tmp, ['node', fakeScript, '-k', 'key']);
  assert.strictEqual(cfgOldScanPile.outputPileFile, 'scan-old-only.txt', 'old env output pipe alias');
  assert.strictEqual(cfgOldScanPile.outputPileFormat, 'json', 'old env output pipe format alias');

  const cfgCliPile = resolveConfig(tmp, [
    'node',
    fakeScript,
    '-k',
    'key',
    '--output-pile-file',
    'cli-stream.jsonl',
    '--output-pile-fd',
    '4',
    '--output-pile-format',
    'text'
  ]);
  assert.strictEqual(cfgCliPile.outputPileFile, 'cli-stream.jsonl', 'cli output pile file overrides env');
  assert.strictEqual(cfgCliPile.outputPileFd, 4, 'cli output pile fd overrides env');
  assert.strictEqual(cfgCliPile.outputPileFormat, 'text', 'cli output pile format');

  const cfgCliAliasPile = resolveConfig(tmp, [
    'node',
    fakeScript,
    '-k',
    'key',
    '--output-pipe',
    'cli-alias.jsonl',
    '--output-pipe-format',
    'json'
  ]);
  assert.strictEqual(cfgCliAliasPile.outputPileFile, 'cli-alias.jsonl', 'old cli output-pipe alias');
  assert.strictEqual(cfgCliAliasPile.outputPileFormat, 'json', 'old cli output-pipe-format alias');
} finally {
  process.chdir(prevCwd);
  if (hadModel) {
    process.env.AI_MODEL = prevModel;
  } else {
    delete process.env.AI_MODEL;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('resolve-config tests ok');
