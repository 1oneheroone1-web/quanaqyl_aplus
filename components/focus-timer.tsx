'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Timer, Coffee, Play, Pause, RotateCcw, Minus, GripVertical, Maximize2 } from 'lucide-react';
import { useFocus } from './focus-provider';
import { focusRemaining, validFocusMinutes } from '@/lib/focus';
import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/catalog';
type Position = { x: number; y: number };
export default function FocusTimer({ lang }: { lang: Lang }) {
  const { snapshot, clockOffset, busy, error, expanded, setExpanded, send, retry } = useFocus();
  const t = (key: string) => tr(key, lang), timer = snapshot?.timer;
  const [now, setNow] = useState(Date.now()), [work, setWork] = useState('25'), [rest, setRest] = useState('5'), [invalid, setInvalid] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const panel = useRef<HTMLElement>(null), drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const positionRef = useRef<Position | null>(null);
  const clamp = useCallback((p: Position) => {
    const rect = panel.current?.getBoundingClientRect();
    return { x: Math.max(8, Math.min(p.x, document.documentElement.clientWidth - (rect?.width ?? 328) - 8)), y: Math.max(8, Math.min(p.y, window.innerHeight - (rect?.height ?? 380) - 8)) };
  }, []);
  const move = useCallback((p: Position, save = false) => {
    const next = clamp(p); positionRef.current = next;
    setPosition(old => old?.x === next.x && old?.y === next.y ? old : next);
    if (save) try { localStorage.setItem('quanaqyl-focus-position', JSON.stringify(next)); } catch { }
  }, [clamp]);
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('quanaqyl-focus-position') || 'null');
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) move(p);
    } catch { }
    const resize = () => { if (positionRef.current) move(positionRef.current); };
    const observer = new ResizeObserver(resize); if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, [move]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []);
  useEffect(() => { if (timer) { setWork(String(timer.workMinutes)); setRest(String(timer.breakMinutes)); } }, [timer?.workMinutes, timer?.breakMinutes]);
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = panel.current!.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current) move({ x: drag.current.left + event.clientX - drag.current.x, y: drag.current.top + event.clientY - drag.current.y });
  };
  const pointerEnd = () => { drag.current = null; if (positionRef.current) move(positionRef.current, true); };
  const keyMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] };
    const delta = directions[event.key]; if (!delta) return;
    event.preventDefault(); const rect = panel.current!.getBoundingClientRect(); move({ x: rect.left + delta[0], y: rect.top + delta[1] }, true);
  };
  const duration = timer?.phase === 'break' ? timer.breakMinutes : timer?.workMinutes ?? 25;
  const remaining = timer?.phase === 'idle' ? (validFocusMinutes(Number(work), Number(rest)) ? Number(work) : duration) * 60_000 : timer ? focusRemaining(timer, now + clockOffset) : 25 * 60_000;
  const seconds = Math.ceil(remaining / 1000), display = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const label = t(timer?.phase === 'break' ? 'focusRest' : 'focusWork');
  const frozen = busy || Boolean(error) || !timer;
  const active = timer?.phase !== 'idle';
  const start = () => {
    if (!validFocusMinutes(Number(work), Number(rest))) { setInvalid(true); return; }
    setInvalid(false); void send('start', { workMinutes: Number(work), breakMinutes: Number(rest) });
  };
  return <aside ref={panel} className={`focus-widget ${expanded ? '' : 'is-collapsed'} ${timer?.phase === 'break' ? 'is-rest' : ''}`} style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined} aria-label={t('focusTitle')}>
    <header className="focus-widget-header">
      <button className="focus-grip" aria-label={t('focusMove')} title={t('focusMove')} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onKeyDown={keyMove}><GripVertical size={18}/></button>
      <span className="focus-brand"><Timer size={17}/>Pomodoro</span>
      {!expanded && <span className="focus-mini-time" aria-label={`${label}: ${display}`}>{error ? '!' : display}</span>}
      <button className="focus-icon" onClick={() => setExpanded(!expanded)} aria-label={t(expanded ? 'focusMinimize' : 'focusExpand')} title={t(expanded ? 'focusMinimize' : 'focusExpand')}>{expanded ? <Minus size={18}/> : <Maximize2 size={16}/>}</button>
    </header>
    {expanded && <div className="focus-widget-body">
      <p className="focus-phase" aria-live="polite">{timer?.phase === 'break' ? <Coffee size={15}/> : <span className="focus-dot"/>}{label}{timer?.status === 'paused' && <span> · {t('focusPaused')}</span>}</p>
      <div className="focus-clock" style={{ '--focus-angle': `${Math.min(1, remaining / (duration * 60_000)) * 360}deg` } as CSSProperties}>
        <div><span role="timer" aria-live="off" aria-label={`${label}: ${display}`}>{display}</span><small>{t(timer?.phase === 'idle' ? 'focusReady' : timer?.status === 'paused' ? 'focusPausedNote' : timer?.phase === 'break' ? 'focusBreathe' : 'focusOneThing')}</small></div>
      </div>
      <div className="focus-inputs">
        <label htmlFor="focus-work">{t('focusWorkInput')}<input id="focus-work" type="number" inputMode="numeric" min="1" max="120" step="1" value={work} disabled={active || frozen} aria-invalid={invalid} aria-describedby={invalid ? 'focus-input-error' : undefined} onChange={e => { setWork(e.target.value); setInvalid(false); }}/></label>
        <label htmlFor="focus-rest">{t('focusRestInput')}<input id="focus-rest" type="number" inputMode="numeric" min="1" max="60" step="1" value={rest} disabled={active || frozen} aria-invalid={invalid} aria-describedby={invalid ? 'focus-input-error' : undefined} onChange={e => { setRest(e.target.value); setInvalid(false); }}/></label>
      </div>
      {invalid && <p className="focus-error" id="focus-input-error" role="alert">{t('focusInvalid')}</p>}
      {error && <div className="focus-error" role="alert">{t(error)} <button onClick={retry} disabled={busy}>{t('retry')}</button></div>}
      <div className="focus-actions">
        {timer?.status === 'running' ? <button className="primary" disabled={frozen} onClick={() => void send('pause')}><Pause size={17}/>{t('focusPause')}</button> : <button className="primary" disabled={frozen} onClick={() => timer?.status === 'paused' ? void send('resume') : start()}><Play size={17}/>{t(timer?.status === 'paused' ? 'focusResume' : 'start')}</button>}
        <button className="focus-reset" disabled={frozen || !active} onClick={() => void send('reset')} aria-label={t('focusReset')} title={t('focusReset')}><RotateCcw size={18}/></button>
      </div>
      <p className="focus-footnote">{!timer ? t('loading') : t(active ? 'focusActiveNote' : 'focusReadyNote')}</p>
    </div>}
  </aside>;
}
