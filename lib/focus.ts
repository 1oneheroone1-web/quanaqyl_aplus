/** The clock is server-authoritative. No client-supplied durations enter history. */
export type FocusTimer = {
  revision: number;
  phase: 'idle' | 'work' | 'break';
  status: 'idle' | 'running' | 'paused';
  workMinutes: number;
  breakMinutes: number;
  sessionId: string | null;
  startedAt: number | null;
  remainingMs: number;
  deadline: number | null;
};
export type FocusSession = {
  id: string; startedAt: number; endedAt: number;
  plannedMs: number; focusMs: number; completed: boolean;
};
export type FocusSnapshot = { timer: FocusTimer; sessions: FocusSession[]; serverNow: number };
export type FocusAction = 'start' | 'pause' | 'resume' | 'reset' | 'sync';
export type FocusCommand = {
  action: FocusAction; revision: number; requestId: string;
  workMinutes?: number; breakMinutes?: number;
};
export class FocusError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function focusRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Secure random bytes also work in HTTP-only local development previews.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export const defaultFocusTimer = (): FocusTimer => ({
  revision: 0, phase: 'idle', status: 'idle', workMinutes: 25, breakMinutes: 5,
  sessionId: null, startedAt: null, remainingMs: 25 * 60_000, deadline: null,
});
export function validFocusMinutes(work: number, rest: number) {
  return Number.isInteger(work) && work >= 1 && work <= 120 && Number.isInteger(rest) && rest >= 1 && rest <= 60;
}
export function validateFocusCommand(input: unknown): FocusCommand {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FocusError('focusInvalid');
  const p = input as Record<string, unknown>;
  const allowed = p.action === 'start' ? ['action', 'revision', 'requestId', 'workMinutes', 'breakMinutes'] : ['action', 'revision', 'requestId'];
  if (Object.keys(p).some(k => !allowed.includes(k)) ||
      !['start', 'pause', 'resume', 'reset', 'sync'].includes(String(p.action)) ||
      !Number.isSafeInteger(p.revision) || (p.revision as number) < 0 ||
      typeof p.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.requestId)) throw new FocusError('focusInvalid');
  if (p.action === 'start' && !validFocusMinutes(p.workMinutes as number, p.breakMinutes as number)) throw new FocusError('focusInvalid');
  return p as FocusCommand;
}
export function focusRemaining(timer: FocusTimer, now: number) {
  return Math.max(0, Math.min(timer.remainingMs, timer.status === 'running' && timer.deadline !== null ? timer.deadline - now : timer.remainingMs));
}
function idle(timer: FocusTimer): FocusTimer {
  return { ...timer, phase: 'idle', status: 'idle', sessionId: null, startedAt: null, deadline: null, remainingMs: timer.workMinutes * 60_000 };
}
/** Pure transition: tests can advance the clock without waiting or adding demo data. */
export function transitionFocus(original: FocusTimer, command: FocusCommand, now: number, newId: string): { timer: FocusTimer; session: FocusSession | null; changed: boolean } {
  let timer = { ...original };
  let session: FocusSession | null = null;
  const finish = (endedAt: number, focusMs: number, completed: boolean) => {
    if (timer.sessionId && timer.startedAt !== null && focusMs > 0) session = {
      id: timer.sessionId, startedAt: timer.startedAt, endedAt,
      plannedMs: timer.workMinutes * 60_000, focusMs, completed,
    };
  };
  // Settle at the original deadline, even after a sleeping tab or a browser restart.
  if (timer.status === 'running' && timer.deadline !== null && now >= timer.deadline) {
    if (timer.phase === 'work') {
      finish(timer.deadline, timer.workMinutes * 60_000, true);
      timer = { ...timer, phase: 'break', remainingMs: timer.breakMinutes * 60_000, deadline: timer.deadline + timer.breakMinutes * 60_000 };
    }
    if (timer.phase === 'break' && timer.deadline !== null && now >= timer.deadline) timer = idle(timer);
  }
  // A button pressed on an expired phase must not unexpectedly act on the next one.
  const settled = timer.phase !== original.phase;
  if (command.action === 'reset') {
    if (timer.phase === 'work') finish(now, timer.workMinutes * 60_000 - focusRemaining(timer, now), false);
    timer = idle(timer);
  } else if (!settled) {
    switch (command.action) {
      case 'start':
        if (timer.phase !== 'idle') throw new FocusError('focusConflict', 409);
        timer = { ...timer, phase: 'work', status: 'running', workMinutes: command.workMinutes!, breakMinutes: command.breakMinutes!, sessionId: newId, startedAt: now, remainingMs: command.workMinutes! * 60_000, deadline: now + command.workMinutes! * 60_000 };
        break;
      case 'pause':
        if (timer.status !== 'running') throw new FocusError('focusConflict', 409);
        timer = { ...timer, status: 'paused', remainingMs: focusRemaining(timer, now), deadline: null };
        break;
      case 'resume':
        if (timer.status !== 'paused') throw new FocusError('focusConflict', 409);
        timer = { ...timer, status: 'running', deadline: now + timer.remainingMs };
        break;
    }
  }
  const changed = JSON.stringify(timer) !== JSON.stringify(original);
  if (changed) timer.revision = original.revision + 1;
  return { timer, session, changed };
}

export const focusDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** Last seven LOCAL calendar days. Attribute a session to the day it ended. */
export function analyzeFocus(sessions: FocusSession[], now = new Date()) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + i, 12);
    return { date, key: focusDateKey(date), focusMs: 0, completed: 0, count: 0 };
  });
  let completed = 0, total = 0, focusMs = 0;
  for (const session of sessions) {
    const day = days.find(d => d.key === focusDateKey(new Date(session.endedAt)));
    if (!day) continue;
    day.focusMs += session.focusMs; day.count++; day.completed += Number(session.completed);
    total++; focusMs += session.focusMs; completed += Number(session.completed);
  }
  const best = days.reduce((a, b) => b.focusMs > a.focusMs ? b : a);
  const activeDays = days.filter(d => d.focusMs > 0).length;
  return { days, focusMs, completed, total, activeDays, best, completionRate: total ? Math.round(completed / total * 100) : null };
}
