#!/usr/bin/env node
import {
  buildForwardedPromptpileArgs,
  getPromptpileReactOptions,
  parseCli,
  type PromptpileReactOptions
} from './cli';
import { appendUserFromTerminal } from './append-user-message';
import { loadReactPrompts, type ReactPromptTexts } from './load-react-prompts';
import { readUserInputFromTerminal } from './read-user-input';
import { reactDebugLog } from './react-debug-log';
import { PromptpileReactRuntime } from './react-runtime';

async function runOneReactSession(runtime: PromptpileReactRuntime): Promise<void> {
  reactDebugLog(
    'session start maxStep=',
    Number.isFinite(runtime.maxStep) ? String(runtime.maxStep) : 'Infinity'
  );
  // 未传 --max-step 时为 Infinity：避免 `while (running)` 无限循环，只执行一轮 nextStep。
  if (Number.isFinite(runtime.maxStep)) {
    while (runtime.stopReason === 'running') {
      await runtime.nextStep();
    }
  } else if (runtime.stopReason === 'running') {
    await runtime.nextStep();
  }

  await runtime.finalAnswer();
  reactDebugLog('session end stopReason=', runtime.stopReason);
}

async function main(): Promise<void> {
  parseCli();
  const options = getPromptpileReactOptions();
  const forwarded = buildForwardedPromptpileArgs(options);
  const prompts = loadReactPrompts(options.directory);

  if (options.inputMode) {
    await runInputMode(options, forwarded, prompts);
    return;
  }

  const runtime = new PromptpileReactRuntime(options, forwarded, prompts);
  await runOneReactSession(runtime);
  process.exitCode = runtime.stopReason === 'error' ? 1 : 0;
}

async function runInputMode(
  options: PromptpileReactOptions,
  forwarded: string[],
  prompts: ReactPromptTexts
): Promise<void> {
  if (!options.directory) {
    console.error('Error: -i requires -d / --directory');
    process.exitCode = 1;
    return;
  }

  const dir = options.directory;

  const processRound = async (): Promise<boolean> => {
    const userContent = await readUserInputFromTerminal();
    if (!userContent) {
      console.error('Error: Empty input. Nothing was written.');
      process.exitCode = 1;
      return false;
    }

    try {
      appendUserFromTerminal(dir, userContent);
      reactDebugLog('inputRound userAppended');
    } catch (e) {
      console.error('Error:', e instanceof Error ? e.message : e);
      process.exitCode = 1;
      return false;
    }

    const runtime = new PromptpileReactRuntime(options, forwarded, prompts);
    await runOneReactSession(runtime);

    if (runtime.stopReason === 'error') {
      process.exitCode = 1;
      return false;
    }

    process.exitCode = 0;
    return true;
  };

  if (!options.continueMode) {
    await processRound();
    return;
  }

  while (true) {
    const ok = await processRound();
    if (!ok) {
      return;
    }
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exitCode = 1;
});
