import {
  DEFAULT_MAX_INTERVIEW_ROUNDS,
  FINALIZE_USER_PROMPT,
  OPENING_ASSISTANT,
} from './constants';
import { isInterviewReady, getInterviewMissingFromTranscript } from './checklist';
import { parseInterviewStatus } from './parse-assistant';
import { assertPromptpileOk, runPromptpile } from './promptpile-run';
import { readUserInput } from './read-user-input';
import {
  appendUserMessage,
  buildTranscript,
  createSession,
  getLatestAssistantText,
  writeOpeningAssistant,
} from './session';
import type { InitSession } from './types';

async function runInterviewRound(session: InitSession): Promise<string> {
  const userText = await readUserInput();
  appendUserMessage(session.messagesDir, userText);

  const result = await runPromptpile(session, [
    '--config',
    'promptpile.toml',
    '-d',
    'messages',
    '--continue',
    '--disable-tool',
  ]);

  assertPromptpileOk(result, 'Interview round');
  return getLatestAssistantText(session.messagesDir);
}

export async function runInterviewLoop(
  maxRounds: number = DEFAULT_MAX_INTERVIEW_ROUNDS
): Promise<{ session: InitSession; transcript: string }> {
  const session = createSession();
  writeOpeningAssistant(session.messagesDir, OPENING_ASSISTANT);

  process.stdout.write('\n--- World building interview ---\n\n');
  process.stdout.write(stripDisplay(OPENING_ASSISTANT));
  process.stdout.write('\n');

  for (let round = 1; round <= maxRounds; round += 1) {
    session.round = round;
    const assistantText = await runInterviewRound(session);
    const display = stripDisplay(assistantText);
    process.stdout.write('\n--- Assistant ---\n\n');
    process.stdout.write(display);
    process.stdout.write('\n');

    const status = parseInterviewStatus(assistantText);
    const transcript = buildTranscript(session.messagesDir);

    if (isInterviewReady(status, transcript)) {
      process.stdout.write('\nInterview complete. Finalizing world save...\n');
      return { session, transcript };
    }

    if (status.status === 'ready') {
      const gaps = [
        ...status.missing,
        ...getInterviewMissingFromTranscript(transcript),
      ];
      process.stdout.write(
        `\nNote: model marked ready but checklist incomplete (${[...new Set(gaps)].join(', ')}). Continuing...\n`
      );
    }
  }

  throw new Error(
    `Interview did not complete within ${maxRounds} rounds. Re-run init or increase --max-rounds.`
  );
}

function stripDisplay(text: string): string {
  return text.replace(/```(?:json\s+)?init-status\s*\n[\s\S]*?```/gi, '').trim();
}
