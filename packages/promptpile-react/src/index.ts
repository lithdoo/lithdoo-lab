#!/usr/bin/env node
import { buildForwardedPromptpileArgs, getPromptpileReactOptions, parseCli } from './cli';
import { loadReactPrompts } from './load-react-prompts';
import { PromptpileReactRuntime } from './react-runtime';

function main(): void {
  parseCli();
  const options = getPromptpileReactOptions();
  const forwarded = buildForwardedPromptpileArgs(options);
  const prompts = loadReactPrompts(options.directory);
  const runtime = new PromptpileReactRuntime(options, forwarded, prompts);

  // 未传 --max-step 时为 Infinity：避免 `while (running)` 无限循环，只执行一轮 nextStep。
  if (Number.isFinite(runtime.maxStep)) {
    while (runtime.stopReason === 'running') {
      runtime.nextStep();
    }
  } else if (runtime.stopReason === 'running') {
    runtime.nextStep();
  }

  runtime.finalAnswer();
  process.exitCode = runtime.stopReason === 'error' ? 1 : 0;
}

try {
  main();
} catch (e) {
  console.error('Error:', e);
  process.exitCode = 1;
}
