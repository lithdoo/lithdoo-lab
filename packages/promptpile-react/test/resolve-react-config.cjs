'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const root = path.join(__dirname, '..');
const { resolveReactConfig } = require(path.join(root, 'dist', 'resolve-react-config.js'));
const { buildPhaseArgv } = require(path.join(root, 'dist', 'build-phase-argv.js'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ppr-cfg-'));
const prevCwd = process.cwd();
try {
  process.chdir(tmp);

  const msgRel = 'messages';
  const msgAbs = path.join(tmp, msgRel);
  fs.mkdirSync(msgAbs, { recursive: true });

  const tomlPath = path.join(tmp, 'app.toml');
  fs.writeFileSync(
    tomlPath,
    `
[[llm_api]]
name = "deepseek"
model = "chat"
base_url = "https://api.example/v1"
api_key_env = "DEEPSEEK_API_KEY"

[promptpile]
dir = "other-dir"

[promptpile-react]
dir = "${msgRel}"
max_step = 3
thought_llm_api = "deepseek"
`
  );

  fs.writeFileSync(
    path.join(msgAbs, '.env'),
    'PROMPTPILE_REACT_MAX_STEP=5\n'
  );

  const fakeScript = path.join(tmp, 'fake-index.js');
  fs.writeFileSync(fakeScript, '');

  const cfg = resolveReactConfig(tmp, [
    'node',
    fakeScript,
    '--config',
    'app.toml'
  ]);
  assert.strictEqual(cfg.directoryAbs, msgAbs, 'promptpile-react dir wins over promptpile');
  assert.strictEqual(cfg.maxStep, 3, 'toml max_step wins over scan .env (CLI > TOML > scan env)');

  fs.writeFileSync(
    tomlPath,
    `
[[llm_api]]
name = "deepseek"
model = "chat"
base_url = "https://api.example/v1"

[promptpile-react]
dir = "${msgRel}"
thought_llm_api = "deepseek"
`
  );
  const cfgEnvOnly = resolveReactConfig(tmp, ['node', fakeScript, '--config', 'app.toml']);
  assert.strictEqual(cfgEnvOnly.maxStep, 5, 'scan .env applies when toml omits max_step');

  const cfgCli = resolveReactConfig(tmp, [
    'node',
    fakeScript,
    '--config',
    'app.toml',
    '-m',
    'm-cli'
  ]);
  assert.strictEqual(cfgCli.phases.thought.model, 'm-cli', 'cli -m overrides phase model');

  const cfgDefaultTemp = resolveReactConfig(tmp, ['node', fakeScript, '-k', 'key']);
  assert.strictEqual(cfgDefaultTemp.phases.thought.temperature, 0.8, 'default temperature');

  fs.writeFileSync(
    tomlPath,
    `
[[llm_api]]
name = "deepseek"
model = "chat"
base_url = "https://api.example/v1"

[promptpile-react]
dir = "${msgRel}"
thought_llm_api = "deepseek"
thought_llm_api_temperature = 0.3
`
  );
  const cfgTomlTemp = resolveReactConfig(tmp, ['node', fakeScript, '--config', 'app.toml', '-k', 'key']);
  assert.strictEqual(cfgTomlTemp.phases.thought.temperature, 0.3, 'toml thought_llm_api_temperature');

  const cfgCliTemp = resolveReactConfig(tmp, [
    'node',
    fakeScript,
    '--config',
    'app.toml',
    '-k',
    'key',
    '--temperature',
    '0.1'
  ]);
  assert.strictEqual(cfgCliTemp.phases.thought.temperature, 0.1, 'cli --temperature');
  assert.strictEqual(cfgCliTemp.phases.observe.temperature, 0.1, 'cli --temperature all phases');

  const thoughtArgv = buildPhaseArgv('thought', cfgTomlTemp);
  const tempIdx = thoughtArgv.indexOf('--temperature');
  assert.ok(tempIdx >= 0, 'thought argv has --temperature');
  assert.strictEqual(thoughtArgv[tempIdx + 1], '0.3', 'thought argv temperature value');

  const observeArgv = buildPhaseArgv('observe', cfg);
  assert.ok(!observeArgv.includes('--config'), 'observe argv has no --config');
  assert.ok(!observeArgv.includes('--after-hook-path'), 'observe argv has no after-hook');
  const tcIdx = observeArgv.indexOf('--tool-choice');
  assert.ok(tcIdx >= 0, 'observe argv has --tool-choice');
  assert.strictEqual(
    observeArgv[tcIdx + 1],
    'function:react_observe_decision',
    'observe forces react_observe_decision'
  );

  const finalArgv = buildPhaseArgv('final', cfg);
  assert.ok(finalArgv.includes('--disable-tool'), 'final argv has --disable-tool');

  const cfgCont = resolveReactConfig(tmp, [
    'node',
    fakeScript,
    '--config',
    'app.toml',
    '-c'
  ]);
  assert.strictEqual(cfgCont.continueMode, true, 'cli -c sets continueMode');
  const thoughtContArgv = buildPhaseArgv('thought', cfgCont);
  assert.ok(thoughtContArgv.includes('-c'), 'thought argv has -c when continueMode');
  const observeContArgv = buildPhaseArgv('observe', cfgCont);
  assert.ok(!observeContArgv.includes('-c'), 'observe argv must not have -c');
  const finalContArgv = buildPhaseArgv('final', cfgCont);
  assert.ok(finalContArgv.includes('-c'), 'final argv has -c when continueMode');
} finally {
  process.chdir(prevCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('resolve-react-config tests ok');
