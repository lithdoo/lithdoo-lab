import { Command } from 'commander';

export function parseCli(): void {
  const program = new Command();
  program
    .name('promptpile-mcp')
    .description(
      'MCP adapter for promptpile (scaffold; MCP not wired yet).'
    )
    .version('0.0.0')
    .helpOption('-h, --help', '显示帮助')
    .parse();
}
