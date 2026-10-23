'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/catalog';
import type { FocusAction, FocusCommand, FocusSnapshot } from '@/lib/focus';
import { focusRequestId } from '@/lib/focus';

type FocusContextValue = {
  snapshot: FocusSnapshot | null; clockOffset: number; busy: boolean; error: string;
  expanded: boolean; setExpanded: (value: boolean) => void;
  send: (action: FocusAction, settings?: { workMinutes: number; breakMinutes: number }) => Promise<void>;
  retry: () => void;
};
export const FocusContext = createContext<FocusContextValue | null>(null);
export function useFocus() {
  const value = useContext(FocusContext);
  if (!value) throw new Error('FocusProvider is missing');
  return value;
}
export default function FocusProvider({ children, lang }: { children: ReactNode; lang: Lang }) {
  const [snapshot, setSnapshot] = useState<FocusSnapshot | null>(null);
  const [clockOffset, setOffset] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const current = useRef<FocusSnapshot | null>(null), offset = useRef(0), language = useRef(lang);
  language.current = lang;
  const inFlight = useRef(false), pending = useRef<FocusCommand | null>(null), sequence = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null), alive = useRef(true);
  const apply = useCallback((next: FocusSnapshot, began: number) => {
    if (!alive.current || (current.current && next.timer.revision < current.current.timer.revision)) return;
    const previous = current.current?.timer;
    if (previous?.phase === 'work' && next.timer.phase !== 'work' && next.sessions.some(s => s.id === previous.sessionId && s.completed)) {
      toast.success(tr(next.timer.phase === 'break' ? 'focusWorkDone' : 'focusCycleDone', language.current));
    } else if (previous?.phase === 'break' && next.timer.phase === 'idle') toast.info(tr('focusBreakDone', language.current));
    offset.current = next.serverNow - (began + Date.now()) / 2;
    current.current = next; setSnapshot(next); setOffset(offset.current);
  }, []);
  const refresh = useCallback(async () => {
    if (inFlight.current || pending.current) return;
    const seq = ++sequence.current, began = Date.now();
    try {
      const response = await fetch('/api/focus', { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json() as FocusSnapshot & { error?: string };
      if (!response.ok) throw new Error(body.error || 'focusSaveError');
      if (seq === sequence.current && alive.current) { apply(body, began); setError(''); }
    } catch (e) { if (seq === sequence.current && alive.current) setError((e as Error).message === 'unauthorized' ? 'unauthorized' : 'focusSaveError'); }
  }, [apply]);
  const perform = useCallback(async (command: FocusCommand) => {
    if (inFlight.current) return;
    inFlight.current = true; pending.current = command; ++sequence.current;
    setBusy(true); setError('');
    let conflict = false;
    const began = Date.now();
    try {
      const response = await fetch('/api/focus', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      const body = await response.json() as FocusSnapshot & { error?: string };
      if (!response.ok) {
        if (response.status < 500) pending.current = null;
        conflict = response.status === 409;
        throw new Error(body.error || 'focusSaveError');
      }
      pending.current = null; apply(body, began); channel.current?.postMessage('updated');
    } catch (e) {
      if (alive.current) setError(['focusInvalid', 'focusConflict', 'unauthorized'].includes((e as Error).message) ? (e as Error).message : 'focusSaveError');
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
    if (conflict) { toast.info(tr('focusConflict', language.current)); await refresh(); }
  }, [apply, refresh]);
  const send = useCallback(async (action: FocusAction, settings?: { workMinutes: number; breakMinutes: number }) => {
    if (!current.current || inFlight.current || pending.current) return;
    await perform({ action, revision: current.current.timer.revision, requestId: focusRequestId(), ...(action === 'start' ? settings : {}) });
  }, [perform]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const onVisible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', onVisible); document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 20_000);
    try { channel.current = new BroadcastChannel('quanaqyl-focus'); channel.current.onmessage = () => { void refresh(); }; } catch { /* Polling supports browsers without BroadcastChannel. */ }
    return () => { alive.current = false; ++sequence.current; clearInterval(poll); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); channel.current?.close(); channel.current = null; };
  }, [refresh]);
  useEffect(() => {
    const tick = window.setInterval(() => {
      const timer = current.current?.timer;
      if (!error && timer?.status === 'running' && timer.deadline !== null && Date.now() + offset.current >= timer.deadline) void send('sync');
    }, 750);
    return () => clearInterval(tick);
  }, [send, error]);
  return <FocusContext.Provider value={{ snapshot, clockOffset, busy, error, expanded, setExpanded, send, retry: () => { if (pending.current) void perform(pending.current); else void refresh(); } }}>{children}</FocusContext.Provider>;
}
