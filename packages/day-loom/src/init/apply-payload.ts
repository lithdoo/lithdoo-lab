import fs from 'fs';
import path from 'path';
import type { InitPayload } from './types';

function writeFileForce(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

export function applyPayload(worldRoot: string, payload: InitPayload): void {
  const manifestLines = [
    `id: ${payload.manifest.id}`,
    `protocol_version: "0.0.0"`,
    `created_at: ${new Date().toISOString()}`,
    `title: ${yamlString(payload.manifest.title)}`,
    '',
  ];
  writeFileForce(path.join(worldRoot, 'manifest.yaml'), manifestLines.join('\n'));

  writeFileForce(path.join(worldRoot, 'canon', 'premise.md'), payload.canon['premise.md']);
  writeFileForce(path.join(worldRoot, 'canon', 'rules.md'), payload.canon['rules.md']);
  writeFileForce(path.join(worldRoot, 'canon', 'style.md'), payload.canon['style.md']);
  writeFileForce(
    path.join(worldRoot, 'canon', 'user_role.md'),
    payload.canon['user_role.md']
  );

  writeFileForce(path.join(worldRoot, 'state', 'world.yaml'), payload.state['world.yaml']);
  if (payload.state['calendar.yaml']) {
    writeFileForce(
      path.join(worldRoot, 'state', 'calendar.yaml'),
      payload.state['calendar.yaml']
    );
  }

  const charIds = payload.characters.map(c => c.id);
  writeFileForce(
    path.join(worldRoot, 'characters', 'index.yaml'),
    `characters:\n${charIds.map(id => `  - ${id}`).join('\n')}\n`
  );

  for (const char of payload.characters) {
    const dir = path.join(worldRoot, 'characters', char.id);
    writeFileForce(path.join(dir, 'profile.yaml'), char.profileYaml);
    writeFileForce(
      path.join(dir, 'relationships.yaml'),
      char.relationshipsYaml ?? 'relationships: {}\n'
    );
    writeFileForce(path.join(dir, 'memory.md'), '');
    writeFileForce(path.join(dir, 'timeline.md'), '');
  }

  if (payload.scenes?.length) {
    writeFileForce(
      path.join(worldRoot, 'scenes', 'index.yaml'),
      `scenes:\n${payload.scenes.map(s => `  - ${s.id}`).join('\n')}\n`
    );
    for (const scene of payload.scenes) {
      const dir = path.join(worldRoot, 'scenes', scene.id);
      writeFileForce(path.join(dir, 'profile.yaml'), scene.profileYaml);
      writeFileForce(path.join(dir, 'memory.md'), '');
      writeFileForce(path.join(dir, 'triggers.yaml'), 'triggers: []\n');
      writeFileForce(path.join(dir, 'timeline.md'), '');
    }
  }
}

function yamlString(value: string): string {
  if (/[:#\n'"]/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}
