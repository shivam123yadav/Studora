import type { Session, Task } from './types'
import { HOUR, MIN, addDays, addMonths, msByTask, overlapMs, startOfDay, startOfMonth, startOfWeek } from './time'

export type View = 'day' | 'week' | 'month'

/** Half-open range [from, to) in epoch ms, aligned to local midnights. */
export interface Range {
  from: number
  to: number
}

export function rangeFor(view: View, anchor: number): Range {
  if (view === 'day') {
    const from = startOfDay(anchor)
    return { from, to: addDays(from, 1) }
  }
  if (view === 'week') {
    const from = startOfWeek(anchor)
    return { from, to: addDays(from, 7) }
  }
  const from = startOfMonth(anchor)
  return { from, to: addMonths(from, 1) }
}

/** Move the anchor one period back (-1) or forward (+1). */
export function shiftAnchor(view: View, anchor: number, dir: 1 | -1): number {
  if (view === 'day') return addDays(anchor, dir)
  if (view === 'week') return addDays(anchor, 7 * dir)
  return addMonths(anchor, dir)
}

const fmt = (ts: number, opts: Intl.DateTimeFormatOptions) => new Date(ts).toLocaleDateString(undefined, opts)

export function periodLabel(view: View, range: Range, now: number): string {
  if (view === 'day') {
    const today = startOfDay(now)
    if (range.from === today) return 'Today'
    if (range.from === addDays(today, -1)) return 'Yesterday'
    return fmt(range.from, { weekday: 'short', day: 'numeric', month: 'short' })
  }
  if (view === 'week') {
    const last = addDays(range.to, -1)
    return `${fmt(range.from, { day: 'numeric', month: 'short' })} – ${fmt(last, { day: 'numeric', month: 'short' })}`
  }
  return fmt(range.from, { month: 'long', year: 'numeric' })
}

// ---------- Chart buckets ----------

export interface Bucket {
  from: number
  to: number
  /** Short axis label; empty when this bucket gets no tick */
  tick: string
  /** Heading for the tooltip */
  title: string
  total: number
  byTask: Map<number, number>
  isCurrent: boolean
  future: boolean
}

function hourName(h: number): string {
  const x = h % 24
  return `${x % 12 || 12} ${x < 12 ? 'am' : 'pm'}`
}

/**
 * Day view: 24 hourly buckets. Week view: 7 daily buckets. Month view: one per day.
 * Each bucket holds the ms per task, split correctly across midnight and hour edges.
 */
export function buildBuckets(sessions: Session[], view: View, range: Range, now: number): Bucket[] {
  const edges: Pick<Bucket, 'from' | 'to' | 'tick' | 'title'>[] = []

  if (view === 'day') {
    const d = new Date(range.from)
    for (let h = 0; h < 24; h++) {
      const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTime()
      const to = h === 23 ? range.to : new Date(d.getFullYear(), d.getMonth(), d.getDate(), h + 1).getTime()
      edges.push({
        from,
        to,
        tick: h % 6 === 0 ? ['12a', '6a', '12p', '6p'][h / 6] : '',
        title: `${hourName(h)} – ${hourName(h + 1)}`,
      })
    }
  } else {
    let i = 0
    for (let from = range.from; from < range.to; from = addDays(from, 1), i++) {
      const dayOfMonth = new Date(from).getDate()
      edges.push({
        from,
        to: addDays(from, 1),
        tick:
          view === 'week'
            ? fmt(from, { weekday: 'short' })
            : dayOfMonth === 1 || dayOfMonth % 5 === 0
              ? String(dayOfMonth)
              : '',
        title: fmt(from, { weekday: 'short', day: 'numeric', month: 'short' }),
      })
    }
  }

  return edges.map((e) => {
    const byTask = msByTask(sessions, e.from, e.to, now)
    let total = 0
    for (const v of byTask.values()) total += v
    return { ...e, total, byTask, isCurrent: now >= e.from && now < e.to, future: e.from > now }
  })
}

// ---------- Summary numbers ----------

/** Study ms per local day (keyed by that day's midnight). Handles sessions across midnight. */
export function dailyTotals(sessions: Session[], now: number): Map<number, number> {
  const out = new Map<number, number>()
  for (const s of sessions) {
    const end = s.end ?? now
    for (let day = startOfDay(s.start); day < end; day = addDays(day, 1)) {
      const ms = overlapMs(s, day, addDays(day, 1), now)
      if (ms > 0) out.set(day, (out.get(day) ?? 0) + ms)
    }
  }
  return out
}

/** Number of local days whose midnight lies in [from, to). */
export function countDays(from: number, to: number): number {
  let n = 0
  for (let d = from; d < to; d = addDays(d, 1)) n++
  return n
}

/** Days of `range` that have started by `now` (a half-finished week counts only its past days). */
export function elapsedDays(range: Range, now: number): number {
  return countDays(range.from, Math.min(range.to, addDays(now, 1)))
}

/**
 * Consecutive days with at least a minute of study, ending today. A quiet *today* doesn't
 * break the streak (the day isn't over); it just isn't counted until you study.
 */
export function currentStreak(daily: Map<number, number>, now: number): number {
  let d = startOfDay(now)
  if ((daily.get(d) ?? 0) < MIN) d = addDays(d, -1)
  let n = 0
  while ((daily.get(d) ?? 0) >= MIN) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export interface Summary {
  total: number
  /** Days of the range that have started */
  days: number
  avgPerDay: number
  best?: { day: number; ms: number }
  /** Days with at least a minute of study */
  daysStudied: number
  sessionCount: number
  longestMs: number
}

export function summarize(sessions: Session[], range: Range, now: number, daily: Map<number, number>): Summary {
  let total = 0
  let sessionCount = 0
  let longestMs = 0
  for (const s of sessions) {
    const ms = overlapMs(s, range.from, range.to, now)
    if (ms <= 0) continue
    total += ms
    sessionCount++
    longestMs = Math.max(longestMs, ms)
  }

  const last = Math.min(range.to, addDays(now, 1))
  let best: Summary['best']
  let daysStudied = 0
  for (let d = range.from; d < last; d = addDays(d, 1)) {
    const ms = daily.get(d) ?? 0
    if (ms >= MIN) daysStudied++
    if (ms > 0 && (!best || ms > best.ms)) best = { day: d, ms }
  }

  const days = elapsedDays(range, now)
  return { total, days, avgPerDay: days > 0 ? total / days : 0, best, daysStudied, sessionCount, longestMs }
}

// ---------- Per-task breakdown ----------

export interface TaskRow {
  task: Task
  ms: number
  /** Target for the range, or null when there isn't one (archived task, or task didn't exist yet) */
  targetMs: number | null
}

/**
 * One row per task. Targets only count days the task existed and that have started, so a
 * task created on Wednesday isn't marked behind for Monday and Tuesday. Past days use the
 * task's current target (targets aren't versioned).
 */
export function taskRows(tasks: Task[], sessions: Session[], range: Range, now: number): TaskRow[] {
  const totals = msByTask(sessions, range.from, range.to, now)
  const rows: TaskRow[] = []
  for (const task of tasks) {
    const ms = totals.get(task.id!) ?? 0
    if (task.archived && ms === 0) continue
    let targetMs: number | null = null
    if (!task.archived) {
      const days = countDays(
        Math.max(range.from, startOfDay(task.createdAt)),
        Math.min(range.to, addDays(now, 1)),
      )
      if (days > 0) targetMs = task.dailyTargetMinutes * MIN * days
    }
    rows.push({ task, ms, targetMs })
  }
  return rows.sort((a, b) => {
    if (a.task.archived !== b.task.archived) return a.task.archived ? 1 : -1
    return a.task.archived ? b.ms - a.ms : a.task.order - b.task.order
  })
}

// ---------- Axis ----------

const STEPS = [10 * MIN, 15 * MIN, 30 * MIN, HOUR, 2 * HOUR, 3 * HOUR, 4 * HOUR, 6 * HOUR, 8 * HOUR, 12 * HOUR, 24 * HOUR]

/** A clean y-axis top and tick step with at most 4 intervals. */
export function niceScale(maxMs: number): { top: number; step: number } {
  const m = Math.max(maxMs, HOUR)
  for (const step of STEPS) {
    if (Math.ceil(m / step) <= 4) return { top: Math.ceil(m / step) * step, step }
  }
  return { top: 24 * HOUR, step: 6 * HOUR }
}

export function formatAxis(ms: number): string {
  if (ms === 0) return '0'
  if (ms < HOUR) return `${Math.round(ms / MIN)}m`
  if (ms % HOUR === 0) return `${ms / HOUR}h`
  return `${(ms / HOUR).toFixed(1)}h`
}
