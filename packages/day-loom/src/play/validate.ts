import type { CurrentPlan, EventResult, EventStatus, GeneratedEvent, ReplanPayload } from './types';
const ID = /^[a-z][a-z0-9_]*$/; const EVENT_ID = /^event_\d{3}$/; const TIME = /^\d+(?:m|h)$/;
function nonEmpty(v: unknown, label: string): asserts v is string { if (typeof v !== 'string' || !v.trim()) throw new Error(label + ' must be non-empty'); }
function strings(v: unknown, label: string): asserts v is string[] { if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error(label + ' must be a string array'); }
export function validateGeneratedEvent(v: GeneratedEvent, expectedEvent: string, beat: string): void { if (v.id !== expectedEvent || !EVENT_ID.test(v.id)) throw new Error('Invalid event id'); if (v.source_beat !== beat) throw new Error('Event source beat mismatch'); nonEmpty(v.title, 'Event title'); nonEmpty(v.opening, 'Event opening'); nonEmpty(v.situation, 'Event situation'); strings(v.suggested_actions, 'Event suggested_actions'); if (v.suggested_actions.length > 5) throw new Error('Event suggested_actions exceeds 5'); for (const key of ['outcome','result','success','failure','reward']) if (key in (v as unknown as Record<string, unknown>)) throw new Error('Generated event contains forbidden result field: ' + key); }
export function validateEventStatus(v: EventStatus): void { if (v.status !== 'ongoing' && v.status !== 'resolved') throw new Error('Invalid event status'); nonEmpty(v.situation, 'Event status situation'); if (typeof v.needs_user_action !== 'boolean') throw new Error('needs_user_action must be boolean'); if (v.status === 'resolved') nonEmpty(v.resolution_summary, 'resolution_summary'); }
export function validateEventResult(v: EventResult, eventId: string, beatId: string): void { if (v.event_id !== eventId || v.source_beat !== beatId) throw new Error('Event result identity mismatch'); nonEmpty(v.summary, 'Event result summary'); strings(v.protagonist_learned, 'protagonist_learned'); if (!TIME.test(v.time_advanced)) throw new Error('time_advanced must look like 30m or 2h'); if (typeof v.completed_source_beat !== 'boolean') throw new Error('completed_source_beat must be boolean'); if (!Array.isArray(v.state_patch) || v.state_patch.length > 20) throw new Error('Invalid state_patch'); for (const patch of v.state_patch) { if (patch.op !== 'set' || !ID.test(patch.key)) throw new Error('Invalid runtime patch'); if (!['string','number','boolean'].includes(typeof patch.value) && patch.value !== null) throw new Error('Invalid runtime patch value'); } }
export function validateReplan(v: ReplanPayload, plan: CurrentPlan): void {
  if (!Array.isArray(v.operations) || v.operations.length > 10) throw new Error('Invalid replan operations');
  const byId = new Map(plan.beats.map(beat => [beat.id, beat]));
  let inserts = 0;
  for (const op of v.operations) {
    if (op.op === 'insert') {
      nonEmpty(op.intent, 'Inserted beat intent');
      nonEmpty(op.reason, 'Inserted beat reason');
      if (op.after && !byId.has(op.after)) throw new Error('Unknown insertion anchor: ' + op.after);
      if (op.priority !== 'required' && op.priority !== 'optional') throw new Error('Invalid inserted beat priority');
      inserts++;
      continue;
    }
    const beat = byId.get(op.beat_id);
    if (!beat) throw new Error('Unknown beat in replan: ' + op.beat_id);
    if (beat.status === 'completed' || beat.status === 'cancelled') throw new Error('Cannot change finished beat: ' + op.beat_id);
    if (op.op === 'modify') {
      nonEmpty(op.intent, 'Modified beat intent');
      nonEmpty(op.reason, 'Modified beat reason');
    }
    if (op.op === 'cancel') nonEmpty(op.reason, 'Cancelled beat reason');
  }
  if (plan.beats.length + inserts > plan.max_events) throw new Error('Replan exceeds max_events');
}
