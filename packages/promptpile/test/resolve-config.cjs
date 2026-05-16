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
