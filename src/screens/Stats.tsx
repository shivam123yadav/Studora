import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../lib/db'
import { formatDuration } from '../lib/time'
import {
  buildBuckets,
  currentStreak,
  dailyTotals,
  periodLabel,
  rangeFor,
  shiftAnchor,
  summarize,
  taskRows,
  type View,
} from '../lib/stats'
import { taskColor } from '../lib/colors'
import { useNow } from '../hooks/useTimer'
import { StackedBars } from '../components/StackedBars'

const VIEWS: { id: View; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

export function Stats() {
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => Date.now())

  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.orderBy('order').toArray(), [])

  // Re-render every 10s while a session is open so today's numbers stay live
  const running = !!sessions?.some((s) => s.end === null)
  const now = useNow(running, 10_000)

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor])
  const daily = useMemo(() => (sessions ? dailyTotals(sessions, now) : new Map<number, number>()), [sessions, now])

  if (!sessions || !tasks) return null

  const buckets = buildBuckets(sessions, view, range, now)
  const summary = summarize(sessions, range, now, daily)
  const rows = taskRows(tasks, sessions, range, now)
  const streak = currentStreak(daily, now)

  const atPresent = range.to > now // can't go into the future
  const goalMs = rows.reduce((s, r) => s + (r.targetMs ?? 0), 0)
  const goalDoneMs = rows.reduce((s, r) => s + (r.targetMs ? r.ms : 0), 0)
  const goalPct = goalMs > 0 ? Math.round((goalDoneMs / goalMs) * 100) : null
  const withTarget = rows.filter((r) => r.targetMs)
  const onTarget = withTarget.filter((r) => r.ms >= r.targetMs!).length
  const dayName = (d: number) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })

  const tiles =
    view === 'day'
      ? [
          { label: 'Sessions', value: String(summary.sessionCount), sub: 'start–pause blocks' },
          { label: 'Longest session', value: formatDuration(summary.longestMs), sub: 'in one go' },
          { label: 'Goals met', value: withTarget.length ? `${onTarget} / ${withTarget.length}` : '–', sub: 'tasks on target' },
          { label: 'Streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}`, sub: 'current' },
        ]
      : [
          { label: 'Daily average', value: formatDuration(summary.avgPerDay), sub: `over ${summary.days} ${summary.days === 1 ? 'day' : 'days'}` },
          { label: 'Best day', value: summary.best ? formatDuration(summary.best.ms) : '–', sub: summary.best ? dayName(summary.best.day) : 'nothing yet' },
          { label: 'Days studied', value: `${summary.daysStudied} / ${summary.days}`, sub: 'at least a minute' },
          { label: 'Streak', value: `${streak} ${streak === 1 ? 'day' : 'days'}`, sub: 'current' },
        ]

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Stats</h1>
        <div role="tablist" aria-label="Period" className="flex rounded-full bg-[var(--surface-2)] p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                view === v.id ? 'bg-[var(--surface)] shadow-sm' : 'text-[var(--muted)]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}
          aria-label="Previous period"
          className="rounded-full bg-[var(--surface)] p-2 ring-1 ring-[var(--border)]"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="font-semibold">{periodLabel(view, range, now)}</div>
          {!atPresent && (
            <button onClick={() => setAnchor(Date.now())} className="text-xs font-medium text-[var(--color-accent)]">
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}
          disabled={atPresent}
          aria-label="Next period"
          className="rounded-full bg-[var(--surface)] p-2 ring-1 ring-[var(--border)] disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Hero + chart */}
      <section className="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
        <div className="text-sm text-[var(--muted)]">Total study time</div>
        <div className="tabular text-5xl font-semibold tracking-tight">{formatDuration(summary.total)}</div>
        {goalPct !== null && (
          <div className="mt-1 text-sm text-[var(--muted)]">
            {goalPct}% of {formatDuration(goalMs)} goal
          </div>
        )}
        <div className="mt-6">
          <StackedBars
            buckets={buckets}
            tasks={tasks}
            label={`Study time by ${view === 'day' ? 'hour' : 'day'}, ${periodLabel(view, range, now)}`}
          />
        </div>
      </section>

      {/* Per-task breakdown (doubles as the chart legend) */}
      <section className="rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]">
        <h2 className="mb-4 text-sm font-medium text-[var(--muted)]">By task</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No tasks yet. Add one on the Today tab.</p>
        ) : (
          <ul className="space-y-4">
            {rows.map(({ task, ms, targetMs }) => {
              const pct = targetMs ? Math.min(100, (ms / targetMs) * 100) : 0
              const color = taskColor(task.color)
              return (
                <li key={task.id}>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {task.name}
                      {task.archived && <span className="ml-2 text-xs font-normal text-[var(--muted)]">archived</span>}
                    </span>
                    {targetMs !== null && ms >= targetMs && (
                      <Check size={16} className="shrink-0 text-emerald-500" strokeWidth={3} aria-label="Target met" />
                    )}
                    <span className="tabular text-sm text-[var(--muted)]">
                      {formatDuration(ms)}
                      {targetMs !== null && ` / ${formatDuration(targetMs)}`}
                    </span>
                  </div>
                  {targetMs !== null && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Summary tiles */}
      <section className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-3xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
            <div className="text-sm text-[var(--muted)]">{t.label}</div>
            <div className="tabular mt-1 text-xl font-semibold">{t.value}</div>
            <div className="text-xs text-[var(--muted)]">{t.sub}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
