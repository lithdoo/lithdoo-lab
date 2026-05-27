const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  parseInterviewStatus,
  parseInitPayload,
} = require('../../dist/init/parse-assistant.js');
const { isPayloadComplete } = require('../../dist/init/checklist.js');
const { initWorldQuick } = require('../../dist/init/index.js');
const { isInitialized } = require('../../dist/init/guard.js');

test('parseInterviewStatus reads init-status block', () => {
  const text = `好的，继续。

\`\`\`init-status
{"status":"ready","missing":[]}
\`\`\``;
  const status = parseInterviewStatus(text);
  assert.equal(status.status, 'ready');
  assert.deepEqual(status.missing, []);
});

test('parseInitPayload reads init-payload block', () => {
  const text = `\`\`\`init-payload
{"manifest":{"id":"test_world","title":"Test"},"canon":{"premise.md":"p","rules.md":"r","style.md":"s","user_role.md":"u"},"state":{"world.yaml":"title: Test\\n"},"characters":[{"id":"char_a","profileYaml":"name: A\\n"}]}
\`\`\``;
  const payload = parseInitPayload(text);
  assert.equal(payload.manifest.id, 'test_world');
});

test('isPayloadComplete detects missing canon', () => {
  const missing = isPayloadComplete({
    manifest: { id: 'w', title: 'W' },
    canon: {
      'premise.md': '',
      'rules.md': 'r',
      'style.md': 's',
      'user_role.md': 'u',
    },
    state: { 'world.yaml': 'title: W\n' },
    characters: [{ id: 'char_a', profileYaml: 'name: A\n' }],
  });
  assert.ok(missing.includes('canon.premise'));
});

test('initWorldQuick creates manifest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'day-loom-test-'));
  const worldRoot = initWorldQuick(dir, { id: 'test_world', title: 'Test' });
  assert.equal(isInitialized(worldRoot), true);
  assert.ok(fs.existsSync(path.join(worldRoot, 'canon', 'premise.md')));
  fs.rmSync(dir, { recursive: true, force: true });
});
