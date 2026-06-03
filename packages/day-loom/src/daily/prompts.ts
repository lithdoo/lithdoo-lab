import fs from 'fs';
import path from 'path';

export function loadDailyPrompt(name: 'daily-dialogue' | 'daily-finalize-plan'): string {
  return fs.readFileSync(path.resolve(__dirname, '..', '..', 'prompts', `${name}.system.md`), 'utf8');
}
