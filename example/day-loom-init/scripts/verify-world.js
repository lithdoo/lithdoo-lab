'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'manifest.yaml',
  'current.yaml',
  'config.yaml',
  'canon/premise.md',
  'canon/rules.md',
  'canon/style.md',
  'canon/user_role.md',
  'state/world.yaml',
  'state/calendar.yaml',
  'state/progress.yaml',
  'state/variables.yaml',
  'characters/index.yaml',
  'scenes/index.yaml',
  'arcs/index.yaml',
  'memory/short_term.md',
  'memory/long_term.md',
  'memory/facts.yaml',
  'memory/unresolved_threads.yaml',
  'memory/important_events.yaml',
  'logs/state_changes.jsonl',
  'logs/generation_trace.md',
  'logs/errors.md',
];

const REQUIRED_DIRS = [
  'days',
  'exports/diaries',
  'exports/summaries',
];

function parseArgs(argv) {
  const args = argv.slice(2);
  let worldRoot = null;
  let mode = 'quick';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--mode') {
      mode = args[i + 1] || 'quick';
      i += 1;
    } else if (!arg.startsWith('-') && !worldRoot) {
      worldRoot = arg;
    }
  }

  if (!worldRoot) {
    console.error('Usage: node verify-world.js <worldRoot> [--mode quick|interactive]');
    process.exit(1);
  }

  if (mode !== 'quick' && mode !== 'interactive') {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }

  return { worldRoot: path.resolve(worldRoot), mode };
}

function fail(errors) {
  console.error('verify-world: FAILED');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fileExists(root, rel) {
  return fs.existsSync(path.join(root, rel));
}

function nonEmpty(content) {
  return typeof content === 'string' && content.trim().length > 0;
}

function yamlFieldNonEmpty(content, field) {
  const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
  const match = content.match(re);
  if (!match) {
    return false;
  }
  const value = match[1].trim();
  return value.length > 0 && value !== '""' && value !== "''";
}

function verifyCommon(worldRoot, errors) {
  if (!fs.existsSync(worldRoot)) {
    errors.push(`world root does not exist: ${worldRoot}`);
    return;
  }

  for (const rel of REQUIRED_FILES) {
    if (!fileExists(worldRoot, rel)) {
      errors.push(`missing file: ${rel}`);
    }
  }

  for (const rel of REQUIRED_DIRS) {
    const full = path.join(worldRoot, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
      errors.push(`missing directory: ${rel}`);
    }
  }

  const daysDir = path.join(worldRoot, 'days');
  if (fs.existsSync(daysDir)) {
    const dayEntries = fs.readdirSync(daysDir).filter(name => /^day_\d+/i.test(name));
    if (dayEntries.length > 0) {
      errors.push(`days/ must be empty at init, found: ${dayEntries.join(', ')}`);
    }
  }

  const manifestPath = path.join(worldRoot, 'manifest.yaml');
  if (fs.existsSync(manifestPath)) {
    const manifest = readText(manifestPath);
    if (!yamlFieldNonEmpty(manifest, 'id')) {
      errors.push('manifest.yaml: id is empty');
    }
    if (!yamlFieldNonEmpty(manifest, 'title')) {
      errors.push('manifest.yaml: title is empty');
    }
    if (!yamlFieldNonEmpty(manifest, 'protocol_version')) {
      errors.push('manifest.yaml: protocol_version is empty');
    }
  }

  const currentPath = path.join(worldRoot, 'current.yaml');
  if (fs.existsSync(currentPath)) {
    const current = readText(currentPath);
    if (!/day:\s*day_0001/i.test(current)) {
      errors.push('current.yaml: expected day: day_0001');
    }
  }
}

function verifyQuick(worldRoot, errors) {
  const charIndexPath = path.join(worldRoot, 'characters', 'index.yaml');
  if (fs.existsSync(charIndexPath)) {
    const index = readText(charIndexPath);
    const charDirs = fs
      .readdirSync(path.join(worldRoot, 'characters'), { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
    if (charDirs.length > 0) {
      errors.push(`quick mode: expected no character subdirs, found: ${charDirs.join(', ')}`);
    }
    if (!/characters:\s*\[\]/i.test(index) && /characters:\s*\n\s*-\s+\S+/i.test(index)) {
      errors.push('quick mode: characters/index.yaml should list no characters');
    }
  }
}

function verifyInteractive(worldRoot, errors) {
  for (const rel of [
    'canon/premise.md',
    'canon/rules.md',
    'canon/style.md',
    'canon/user_role.md',
  ]) {
    const full = path.join(worldRoot, rel);
    if (fs.existsSync(full) && !nonEmpty(readText(full))) {
      errors.push(`interactive mode: ${rel} is empty`);
    }
  }

  const worldYamlPath = path.join(worldRoot, 'state', 'world.yaml');
  if (fs.existsSync(worldYamlPath)) {
    const worldYaml = readText(worldYamlPath);
    if (!yamlFieldNonEmpty(worldYaml, 'title')) {
      errors.push('interactive mode: state/world.yaml title is empty');
    }
  }

  const charsDir = path.join(worldRoot, 'characters');
  const charDirs = fs.existsSync(charsDir)
    ? fs
        .readdirSync(charsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
    : [];

  if (charDirs.length === 0) {
    errors.push('interactive mode: expected at least one character directory');
  } else {
    for (const id of charDirs) {
      const profilePath = path.join(charsDir, id, 'profile.md');
      if (!fs.existsSync(profilePath) || !nonEmpty(readText(profilePath))) {
        errors.push(`interactive mode: characters/${id}/profile.md missing or empty`);
      }
    }
  }

  const indexPath = path.join(charsDir, 'index.yaml');
  if (fs.existsSync(indexPath)) {
    const index = readText(indexPath);
    if (!/characters:\s*\n\s*-\s+\S+/i.test(index)) {
      errors.push('interactive mode: characters/index.yaml lists no characters');
    }
  }

  const transcriptDir = path.join(worldRoot, '.loom', 'init-transcript');
  if (!fs.existsSync(transcriptDir)) {
    errors.push('interactive mode: missing .loom/init-transcript/');
  } else if (!fs.existsSync(path.join(transcriptDir, 'messages'))) {
    errors.push('interactive mode: .loom/init-transcript/messages/ missing');
  }
}

function main() {
  const { worldRoot, mode } = parseArgs(process.argv);
  const errors = [];

  verifyCommon(worldRoot, errors);
  if (mode === 'quick') {
    verifyQuick(worldRoot, errors);
  } else {
    verifyInteractive(worldRoot, errors);
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log(`verify-world: OK (${mode}) ${worldRoot}`);
}

main();
