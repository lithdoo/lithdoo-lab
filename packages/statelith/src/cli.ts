import { Command } from 'commander';

export function parseCli(): void {
  const program = new Command();
  program
    .name('statelith')
    .description(
      'Task state JSON spec and tools: parse, validate, watch, and emit to stdout / WebSocket / SSE (scaffold; not wired yet).'
    )
    .version('0.0.0')
    .helpOption('-h, --help', '显示帮助')
    .parse();
}
