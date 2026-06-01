import { Command } from 'commander';
import { registerInitCommand } from './init';
import { registerReviseCommand } from './revise';

export function parseCli(argv: string[] = process.argv): void {
  const program = new Command();
  program
    .name('day-loom')
    .description('day-loom: file-based AI life simulation by day')
    .version('0.0.0')
    .helpOption('-h, --help', '显示帮助');

  registerInitCommand(program);
  registerReviseCommand(program);

  program.parse(argv);
}
