import type { EventResult, EventStatus, GeneratedEvent, ReplanPayload } from './types';
function block(text: string, label: string): string { const m = text.match(new RegExp('```(?:json\\s+)?' + label + '\\s*\\n([\\s\\S]*?)```', 'i')); if (!m) throw new Error('Assistant response missing ' + label + ' JSON block'); return m[1].trim(); }
function parse<T>(text: string, label: string): T { try { return JSON.parse(block(text, label)) as T; } catch (e) { throw new Error('Failed to parse ' + label + ': ' + (e instanceof Error ? e.message : String(e))); } }
export const parseGeneratedEvent = (text: string): GeneratedEvent => parse(text, 'play-event');
export const parseEventStatus = (text: string): EventStatus => parse(text, 'event-status');
export const parseEventResult = (text: string): EventResult => parse(text, 'event-result');
export const parseReplan = (text: string): ReplanPayload => parse(text, 'play-replan');
