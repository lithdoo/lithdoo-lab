import fs from 'fs';
import path from 'path';
import { loadEnvFile } from 'promptpile/dist/env-file';
import { computeDir0 } from 'promptpile/dist/resolve-config';
import { loadReactPromptsFromConfig } from './load-react-prompts';
import {
  mapProcessEnvReact,
  mapProcessEnvShared,
  mapReactEnvRecord,
  mapSharedEnvRecord
} from './env-react';
import { pickBool, pickInt, pickNum, pickStr } from './merge-utils';
import { parseReactCli } from './cli';
import { applyCliLlmOverrides, resolveLlmProfile } from './resolve-llm-profile';
import {
  buildReactOnlyTomlLayer,
  buildSharedTomlLayer,
  loadReactTomlConfig,
  type ReactOnlyTomlLayer,
  type SharedTomlLayer
} from './toml-config-react';
import type { PhaseLlmConfig, ResolvedReactConfig, ReactCliOverrides } from './types';

const resolveScanRelative = (scanAbs: string, rel: string | undefined): string | undefined => {
  if (rel === undefined) {
    return undefined;
  }
  return path.isAbsolute(rel) ? rel : path.resolve(scanAbs, rel);
};

const resolveCwdRelative = (cwd: string, rel: string | undefined): string | undefined => {
  if (rel === undefined) {
    return undefined;
  }
  return path.isAbsolute(rel) ? rel : path.resolve(cwd, rel);
};

const mergePhaseLlm = (
  llmApis: ReturnType<typeof loadReactTomlConfig>['llmApis'],
  defaultProfile: string | undefined,
  phase: {
    profileName?: string;
    key?: string;
    keyEnv?: string;
    model?: string;
    baseUrl?: string;
    temperature?: number;
  },
  cli: ReactCliOverrides,
  shared: { pileTomlTemperature?: number; sharedEnvTemperature?: number }
): PhaseLlmConfig => {
  const temperatureOverride = pickNum(
    phase.temperature,
    shared.pileTomlTemperature,
    shared.sharedEnvTemperature
  );
  const base = resolveLlmProfile(llmApis, {
    profileName: phase.profileName ?? defaultProfile,
    model: phase.model,
    apiKey: phase.key,
    apiKeyEnv: phase.keyEnv,
    apiBaseUrl: phase.baseUrl,
    temperature: temperatureOverride
  });
  return applyCliLlmOverrides(base, cli);
};

export const resolveReactConfig = (cwd: string, argv: string[]): ResolvedReactConfig => {
  let cli: ReactCliOverrides;
  try {
    cli = parseReactCli(argv);
  } catch (e) {
    console.error('Error: Invalid CLI options:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  let llmApis: ReturnType<typeof loadReactTomlConfig>['llmApis'] = [];
  let sharedTomlReact: SharedTomlLayer = {};
  let sharedTomlPile: SharedTomlLayer = {};
  let reactToml: ReactOnlyTomlLayer = {};
  let configPathAbs: string | undefined;

  if (cli.configPath !== undefined) {
    configPathAbs = path.isAbsolute(cli.configPath)
      ? cli.configPath
      : path.resolve(cwd, cli.configPath);
    if (!fs.existsSync(configPathAbs)) {
      console.error(`Error: config file not found: ${configPathAbs}`);
      process.exit(1);
    }
    try {
      const loaded = loadReactTomlConfig(configPathAbs);
      llmApis = loaded.llmApis;
      sharedTomlPile = buildSharedTomlLayer(loaded.promptpile);
      sharedTomlReact = buildSharedTomlLayer(loaded.promptpileReact);
      reactToml = buildReactOnlyTomlLayer(loaded.promptpileReact);
    } catch (e) {
      console.error(`Error: failed to parse TOML config: ${configPathAbs}`, e);
      process.exit(1);
    }
  }

  let cwdShared: ReturnType<typeof mapSharedEnvRecord>;
  let cwdReact: ReturnType<typeof mapReactEnvRecord>;
  let procShared: ReturnType<typeof mapProcessEnvShared>;
  let procReact: ReturnType<typeof mapProcessEnvReact>;
  let scanShared: ReturnType<typeof mapSharedEnvRecord>;
  let scanReact: ReturnType<typeof mapReactEnvRecord>;
  try {
    const cwdEnvMap = loadEnvFile(path.join(cwd, '.env'));
    cwdShared = mapSharedEnvRecord(cwdEnvMap);
    cwdReact = mapReactEnvRecord(cwdEnvMap);
    procShared = mapProcessEnvShared();
    procReact = mapProcessEnvReact();
  } catch (e) {
    console.error('Error: Invalid temperature in env:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const dir0 = computeDir0(
    cwd,
    cli.directory,
    sharedTomlReact.directory,
    cwdReact.directory ?? procReact.directory,
    sharedTomlPile.directory ?? cwdShared.directory ?? procShared.directory
  );

  try {
    const scanEnvMap = loadEnvFile(path.join(dir0, '.env'));
    scanShared = mapSharedEnvRecord(scanEnvMap);
    scanReact = mapReactEnvRecord(scanEnvMap);
  } catch (e) {
    console.error('Error: Invalid temperature in env:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const directoryRel = pickStr(
    cli.directory,
    sharedTomlReact.directory,
    scanReact.directory,
    cwdReact.directory,
    procReact.directory,
    sharedTomlPile.directory,
    scanShared.directory,
    cwdShared.directory,
    procShared.directory,
    './message'
  )!;
  const directoryAbs = path.isAbsolute(directoryRel)
    ? directoryRel
    : path.resolve(cwd, directoryRel);

  const quiet = pickBool(
    cli.quiet,
    sharedTomlReact.quiet,
    scanReact.quiet,
    cwdReact.quiet,
    procReact.quiet,
    sharedTomlPile.quiet,
    scanShared.quiet,
    cwdShared.quiet,
    procShared.quiet,
    false
  )!;

  const inputMode = pickBool(
    cli.inputMode,
    sharedTomlReact.inputMode,
    scanReact.inputMode,
    cwdReact.inputMode,
    procReact.inputMode,
    sharedTomlPile.inputMode,
    scanShared.inputMode,
    cwdShared.inputMode,
    procShared.inputMode,
    false
  )!;

  const continueMode = pickBool(
    cli.continueMode,
    sharedTomlReact.continueMode,
    scanReact.continueMode,
    cwdReact.continueMode,
    procReact.continueMode,
    sharedTomlPile.continueMode,
    scanShared.continueMode,
    cwdShared.continueMode,
    procShared.continueMode,
    false
  )!;

  const maxStep =
    pickInt(
      cli.maxStep,
      reactToml.maxStep,
      scanReact.maxStep,
      cwdReact.maxStep,
      procReact.maxStep
    ) ?? Number.POSITIVE_INFINITY;

  const toolsRel = pickStr(
    cli.toolsFile,
    sharedTomlReact.toolsFile,
    scanReact.toolsFile,
    cwdReact.toolsFile,
    procReact.toolsFile,
    sharedTomlPile.toolsFile,
    scanShared.toolsFile,
    cwdShared.toolsFile,
    procShared.toolsFile
  );

  let toolsFileForCli: string | undefined;
  if (cli.toolsFile !== undefined) {
    toolsFileForCli = resolveCwdRelative(cwd, cli.toolsFile);
  } else if (toolsRel !== undefined) {
    toolsFileForCli = resolveScanRelative(directoryAbs, toolsRel);
  }

  const afterHookRel = pickStr(
    cli.afterHookPath,
    sharedTomlReact.afterHook,
    scanReact.afterHook,
    cwdReact.afterHook,
    procReact.afterHook,
    sharedTomlPile.afterHook,
    scanShared.afterHook,
    cwdShared.afterHook,
    procShared.afterHook
  );

  let afterHookForCli: string | undefined;
  if (cli.afterHookPath !== undefined) {
    afterHookForCli = resolveCwdRelative(cwd, cli.afterHookPath);
  } else if (afterHookRel !== undefined) {
    afterHookForCli = resolveScanRelative(directoryAbs, afterHookRel);
  }

  const defaultProfile = pickStr(
    sharedTomlReact.defaultLlmApi,
    sharedTomlPile.defaultLlmApi,
    scanShared.defaultLlmApi,
    cwdShared.defaultLlmApi,
    procShared.defaultLlmApi
  );

  const sharedTemperature = {
    pileTomlTemperature: sharedTomlPile.llmApiTemperature ?? sharedTomlReact.llmApiTemperature,
    sharedEnvTemperature: pickNum(
      scanShared.temperature,
      cwdShared.temperature,
      procShared.temperature
    )
  };

  const thought = mergePhaseLlm(
    llmApis,
    defaultProfile,
    {
      profileName: reactToml.thoughtLlmApi,
      key: reactToml.thoughtLlmApiKey,
      keyEnv: reactToml.thoughtLlmApiKeyEnv,
      model: reactToml.thoughtLlmApiModel,
      baseUrl: reactToml.thoughtLlmApiBaseUrl,
      temperature: pickNum(
        reactToml.thoughtLlmApiTemperature,
        scanReact.thoughtLlmApiTemperature,
        cwdReact.thoughtLlmApiTemperature,
        procReact.thoughtLlmApiTemperature
      )
    },
    cli,
    sharedTemperature
  );
  const observe = mergePhaseLlm(
    llmApis,
    defaultProfile,
    {
      profileName: reactToml.observeLlmApi,
      key: reactToml.observeLlmApiKey,
      keyEnv: reactToml.observeLlmApiKeyEnv,
      model: reactToml.observeLlmApiModel,
      baseUrl: reactToml.observeLlmApiBaseUrl,
      temperature: pickNum(
        reactToml.observeLlmApiTemperature,
        scanReact.observeLlmApiTemperature,
        cwdReact.observeLlmApiTemperature,
        procReact.observeLlmApiTemperature
      )
    },
    cli,
    sharedTemperature
  );
  const finalPhase = mergePhaseLlm(
    llmApis,
    defaultProfile,
    {
      profileName: reactToml.finalLlmApi,
      key: reactToml.finalLlmApiKey,
      keyEnv: reactToml.finalLlmApiKeyEnv,
      model: reactToml.finalLlmApiModel,
      baseUrl: reactToml.finalLlmApiBaseUrl,
      temperature: pickNum(
        reactToml.finalLlmApiTemperature,
        scanReact.finalLlmApiTemperature,
        cwdReact.finalLlmApiTemperature,
        procReact.finalLlmApiTemperature
      )
    },
    cli,
    sharedTemperature
  );

  const promptPaths = {
    thought: pickStr(
      reactToml.thoughtPrompt,
      scanReact.thoughtPrompt,
      cwdReact.thoughtPrompt,
      procReact.thoughtPrompt
    ),
    observe: pickStr(
      reactToml.observePrompt,
      scanReact.observePrompt,
      cwdReact.observePrompt,
      procReact.observePrompt
    ),
    final: pickStr(
      reactToml.finalPrompt,
      scanReact.finalPrompt,
      cwdReact.finalPrompt,
      procReact.finalPrompt
    )
  };

  const prompts = loadReactPromptsFromConfig(directoryAbs, promptPaths);

  return {
    cwd,
    configPath: configPathAbs,
    directoryAbs,
    quiet,
    inputMode,
    continueMode,
    maxStep,
    toolsFileForCli,
    afterHookForCli,
    phases: { thought, observe, final: finalPhase },
    prompts
  };
};
