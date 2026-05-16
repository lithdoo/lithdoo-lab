declare module 'promptpile/dist/config' {
  export function parseBoolEnv(value: string | undefined): boolean;
  export function trimEnv(value: string | undefined): string | undefined;
}

declare module 'promptpile/dist/env-file' {
  export function loadEnvFile(absPath: string): Record<string, string>;
}

declare module 'promptpile/dist/llm-sampling' {
  export const DEFAULT_TEMPERATURE: number;
  export function parseTemperatureInput(raw: string | undefined): number | undefined;
  export function coerceTemperatureValue(v: unknown): number | undefined;
}

declare module 'promptpile/dist/toml-config' {
  export interface LlmApiProfile {
    name: string;
    model?: string;
    base_url?: string;
    api_key?: string;
    api_key_env?: string;
    temperature?: number;
  }

  export interface ParsedTomlConfig {
    promptpile: Record<string, unknown>;
    llmApis: LlmApiProfile[];
  }

  export function loadTomlConfigFile(absPath: string): ParsedTomlConfig;
}

declare module 'promptpile/dist/resolve-config' {
  export function computeDir0(
    cwd: string,
    cliDir: string | undefined,
    tomlDir: string | undefined,
    cwdDotDir: string | undefined,
    procDir: string | undefined
  ): string;
}
