'use client';
import { useMemo } from 'react';
import { Timer, Target, CalendarDays, Lightbulb, ArrowUpRight } from 'lucide-react';
import { analyzeFocus, focusDateKey } from '@/lib/focus';
import { useFocus } from './focus-provider';
import { tr } from '@/lib/i18n';
import type { Lang } from '@/lib/catalog';

export default function FocusStats({ lang }: { lang: Lang }) {
  const { snapshot, error, retry, setExpanded } = useFocus();
  const t = (key: string) => tr(key, lang);
  const locale = { en: 'en-GB', ru: 'ru-RU', kk: 'kk-KZ' }[lang];
  const stats = useMemo(() => analyzeFocus(snapshot?.sessions ?? []), [snapshot]);
  const minutes = (ms: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ms / 60_000);
  const weekdays = t('focusWeekdays').split(',');
  const day = (date: Date) => `${weekdays[date.getDay()]}, ${new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(date)}`;
  const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text);
  const max = Math.max(1, ...stats.days.map(d => d.focusMs / 60_000));
  const advice = stats.total >= 3 && (stats.completionRate ?? 100) < 60 ? 'focusAdviceShort' : stats.activeDays < 4 ? 'focusAdviceRegular' : 'focusAdviceKeep';
  return <section className="card focus-stats" aria-labelledby="focus-stats-title">
    <div className="focus-stats-heading"><div><span className="focus-eyebrow">POMODORO</span><h2 id="focus-stats-title">{t('focusStats')}</h2><p>{t('focusStatsSub')}</p></div><button className="secondary" onClick={() => setExpanded(true)}><Timer size={17}/>{t('focusOpen')}<ArrowUpRight size={16}/></button></div>
    {error && <p className="focus-error" role="alert">{t(error)} <button onClick={retry}>{t('retry')}</button></p>}
    {!snapshot ? <p role="status">{t('loading')}</p> : <>
      <div className="focus-metrics">
        <div><Timer/><span>{t('focusTotal')}</span><strong>{minutes(stats.focusMs)} <small>{t('minutes')}</small></strong></div>
        <div><Target/><span>{t('focusCompletion')}</span><strong>{stats.completionRate === null ? '—' : stats.completionRate + '%'}</strong><small>{fill(t('focusCount'), { completed: stats.completed, total: stats.total })}</small></div>
        <div><CalendarDays/><span>{t('focusActiveDays')}</span><strong>{stats.activeDays}<small> / 7</small></strong></div>
      </div>
      <div className="focus-analysis"><div className="focus-chart-wrap">
        <h3>{t('focusChart')}</h3><p className="focus-chart-unit">{t('focusMinutesAxis')}</p>
        <svg viewBox="0 0 640 256" role="img" aria-labelledby="focus-chart-title focus-chart-desc">
          <title id="focus-chart-title">{t('focusChart')}</title><desc id="focus-chart-desc">{stats.days.map(d => `${day(d.date)}: ${minutes(d.focusMs)} ${t('minutes')}`).join('; ')}</desc>
          {[0, 1, 2, 3].map(i => { const y = 205 - i * 56; return <g key={i}><line x1="49" y1={y} x2="628" y2={y} stroke="#e4edf9"/><text x="40" y={y + 4} textAnchor="end">{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(max * i / 3)}</text></g>; })}
          {stats.days.map((d, i) => { const height = (d.focusMs / 60_000) / max * 168, x = 69 + i * 80; return <g key={d.key}>
            <rect x={x} y={205 - height} width="42" height={height} rx="8" fill={i === 6 ? '#1479f6' : '#95c7ff'}/>
            {d.focusMs > 0 && <text x={x + 21} y={Math.max(15, 196 - height)} textAnchor="middle" className="focus-bar-value">{minutes(d.focusMs)}</text>}
            <text x={x + 21} y="229" textAnchor="middle">{weekdays[d.date.getDay()]}</text>
            <text x={x + 21} y="247" textAnchor="middle">{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric' }).format(d.date)}</text>
          </g>; })}
        </svg><p className="focus-chart-note">{t('focusDateNote')}</p>
      </div><div className="focus-insights">
        <h3><Lightbulb size={19}/>{t('focusInsights')}</h3>
        {stats.total ? <>
          <p>{fill(t('focusFindingDays'), { days: stats.activeDays })}</p>
          <p>{fill(t('focusFindingBest'), { day: day(stats.best.date), minutes: minutes(stats.best.focusMs) })}</p>
          <div className="focus-advice"><strong>{t('focusSuggestion')}</strong><p>{t(advice)}</p></div>
        </> : <p>{t('focusEmpty')}</p>}
      </div></div>
      <p className="focus-definition">{t('focusDefinition')}</p>
      {stats.total > 0 && <details className="focus-history"><summary>{t('focusHistory')}</summary><div className="focus-table-scroll"><table><thead><tr><th>{t('date')}</th><th>{t('focusTotal')}</th><th>{t('focusStatus')}</th></tr></thead><tbody>{snapshot.sessions.filter(s => stats.days.some(d => d.key === focusDateKey(new Date(s.endedAt)))).slice(0, 20).map(s => <tr key={s.id}><td>{new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(s.endedAt)}</td><td>{minutes(s.focusMs)} {t('minutes')}</td><td>{t(s.completed ? 'focusCompleted' : 'focusInterrupted')}</td></tr>)}</tbody></table></div></details>}
    </>}
  </section>;
}
