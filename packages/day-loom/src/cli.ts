import { Command } from 'commander';

export function parseCli(): void {
  const program = new Command();
  program
    .name('day-loom')
    .description('day-loom CLI (scaffold)')
    .version('0.0.0')
    .helpOption('-h, --help', '显示帮助')
    .parse();
}
