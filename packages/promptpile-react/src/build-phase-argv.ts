import { OBSERVE_DECISION_TOOL_NAME } from './observe-decision-tool';
import type { ReactPhase, ResolvedReactConfig } from './types';

const appendLlm = (
  argv: string[],
  llm: { model: string; apiKey: string; apiBaseUrl: string; temperature: number }
): void => {
  argv.push('-m', llm.model);
  if (llm.apiKey !== '') {
    argv.push('-k', llm.apiKey);
  }
  argv.push('-b', llm.apiBaseUrl);
  argv.push('--temperature', String(llm.temperature));
};

/**
 * Base argv per ReAct phase (no --config, no temp inject/tools/output).
 * Callers append --insert-files / Observe temp paths after this.
 */
export const buildPhaseArgv = (phase: ReactPhase, config: ResolvedReactConfig): string[] => {
  const argv: string[] = ['-d', config.directoryAbs];
  const llm = config.phases[phase];
  appendLlm(argv, llm);

  if (config.quiet) {
    argv.push('-q');
  }

  if (phase === 'thought') {
    if (config.toolsFileForCli !== undefined) {
      argv.push('--tools-file', config.toolsFileForCli);
    }
    if (config.afterHookForCli !== undefined) {
      argv.push('--after-hook-path', config.afterHookForCli);
    }
  }

  if (phase === 'final') {
    argv.push('--disable-tool');
  }

  if (phase === 'observe') {
    argv.push('--tool-choice', `function:${OBSERVE_DECISION_TOOL_NAME}`);
  }

  if (config.continueMode && (phase === 'thought' || phase === 'final')) {
    argv.push('-c');
  }

  return argv;
};
