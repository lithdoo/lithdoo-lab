import type { ReactPromptTexts } from './load-react-prompts';

export interface PhaseLlmConfig {
  model: string;
  apiKey: string;
  apiBaseUrl: string;
  temperature: number;
}

export interface ReactPromptPaths {
  thought?: string;
  observe?: string;
  final?: string;
}

/** CLI overrides (highest merge priority). */
export interface ReactCliOverrides {
  configPath?: string;
  directory?: string;
  model?: string;
  apiKey?: string;
  apiBaseUrl?: string;
  temperature?: number;
  quiet?: boolean;
  toolsFile?: string;
  afterHookPath?: string;
  inputMode?: boolean;
  continueMode?: boolean;
  maxStep?: number;
}

export interface ResolvedReactConfig {
  cwd: string;
  configPath?: string;
  directoryAbs: string;
  quiet: boolean;
  inputMode: boolean;
  continueMode: boolean;
  maxStep: number;
  toolsFileForCli?: string;
  afterHookForCli?: string;
  phases: {
    thought: PhaseLlmConfig;
    observe: PhaseLlmConfig;
    final: PhaseLlmConfig;
  };
  prompts: ReactPromptTexts;
}

export type ReactPhase = 'thought' | 'observe' | 'final';
