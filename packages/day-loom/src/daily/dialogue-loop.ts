import { DEFAULT_MAX_TOOL_ROUNDS, OPENING_ASSISTANT } from './constants';
import { applyDailyPlan, describeChanges } from './apply-plan';
import { assertDailyCanStart, assertInitializedWorld, readCurrentDay, resolveWorldRoot } from './guard';
import { connectOrStartGateway } from './mcp-gateway';
import { assertAllowedPlayerContextRoot, exportReadonlyTools } from './mcp-tools';
import { parseDailyStatus, stripDailyStatus } from './parse-assistant';
import { projectDailyPlan } from './project-plan';
import { runPromptpileUntilText } from './promptpile-loop';
import { askYesNo, readDailyUserInput } from './read-user-input';
import { appendUserMessage, buildTranscript, cleanupSession, createDailySession, readDraft, writeDraft } from './session';
import { validateDailyPlan } from './validate-plan';
import { buildPlayerContext } from './player-context';
import { finalizeDailyPlan } from './finalize';
import type { DailyOptions } from './types';

export async function dailyInteractive(dir: string, options: DailyOptions = {}): Promise<void> {
  if (!process.env.DEEPSEEK_API_KEY?.trim()) throw new Error('DEEPSEEK_API_KEY is not set. Interactive daily requires an API key.');
  const worldRoot = resolveWorldRoot(dir);
  assertInitializedWorld(worldRoot);
  assertDailyCanStart(worldRoot);
  const day = readCurrentDay(worldRoot);
  const session = createDailySession();
  let preserveSession = options.keepSession ?? false;
  let gateway: Awaited<ReturnType<typeof connectOrStartGateway>> | undefined;
  const maxToolRounds = options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  try {
    buildPlayerContext(worldRoot, session.playerContextRoot);
    gateway = await connectOrStartGateway(session.root, session.playerContextRoot, options.mcpBaseUrl, options.mcpToken);
    await exportReadonlyTools(gateway.baseUrl, gateway.token, session.toolsFile);
    await assertAllowedPlayerContextRoot(gateway.baseUrl, gateway.token, session.playerContextRoot, session.root);
    process.stdout.write(`\n--- Daily planning session ---\n\n${OPENING_ASSISTANT}\n`);
    while (true) {
      const input = await readDailyUserInput();
      if (input === undefined) { preserveSession = true; process.stdout.write(`Daily draft saved in session: ${session.root}\n`); return; }
      if (input === '/help') { process.stdout.write('/pending  /start  /cancel  /exit\n'); continue; }
      if (input === '/pending') { process.stdout.write(`${JSON.stringify(readDraft(session), null, 2)}\n`); continue; }
      if (input === '/cancel') { process.stdout.write('Daily planning cancelled.\n'); return; }
      if (input === '/exit') { preserveSession = true; process.stdout.write(`Daily draft saved in session: ${session.root}\n`); return; }
      if (input === '/start') {
        const draft = readDraft(session);
        if (!draft.user_intent.trim()) { process.stdout.write('No daily intent collected yet.\n'); continue; }
        const plan = await finalizeDailyPlan(buildTranscript(session.messagesDir), draft, day, session.toolsFile, gateway.baseUrl, gateway.token, maxToolRounds, options.keepSession);
        validateDailyPlan(plan, day);
        const changes = projectDailyPlan(plan, buildTranscript(session.messagesDir));
        const description = describeChanges(worldRoot, changes);
        process.stdout.write(`\n${description}\n`);
        if (options.dryRun) { process.stdout.write('Dry run only. No files changed.\n'); continue; }
        if (!options.yes && !await askYesNo('Start this daily plan? (Y/N): ')) { process.stdout.write('Daily plan not applied.\n'); continue; }
        assertDailyCanStart(worldRoot);
        applyDailyPlan(worldRoot, plan, changes);
        process.stdout.write('Applied daily plan.\n');
        return;
      }
      appendUserMessage(session.messagesDir, input);
      const reply = await runPromptpileUntilText(session, gateway.baseUrl, gateway.token, maxToolRounds);
      try { const status = parseDailyStatus(reply); if (status) writeDraft(session, status); }
      catch (err) { process.stderr.write(`Warning: ${err instanceof Error ? err.message : err}\n`); }
      process.stdout.write(`\nAI> ${stripDailyStatus(reply)}\n`);
    }
  } finally {
    if (gateway) await gateway.stop();
    if (preserveSession) process.stderr.write(`Daily session preserved at: ${session.root}\n`);
    else cleanupSession(session);
  }
}
