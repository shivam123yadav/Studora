import type { Session } from './types'

export const MIN = 60_000
export const HOUR = 60 * MIN

/** Local midnight at the start of the day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Local midnight `n` days after the day containing `ts` (n can be negative). */
export function addDays(ts: number, n: number): number {
  const d = new Date(startOfDay(ts))
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** Monday 00:00 of the week containing `ts`. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts))
  const dow = (d.getDay() + 6) % 7 // Mon=0 ... Sun=6
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

/** First day of the month containing `ts`, 00:00 local. */
export function startOfMonth(ts: number): number {
  const d = new Date(startOfDay(ts))
  d.setDate(1)
  return d.getTime()
}

export function addMonths(ts: number, n: number): number {
  const d = new Date(startOfMonth(ts))
  d.setMonth(d.getMonth() + n)
  return d.getTime()
}

/**
 * Milliseconds of `session` that fall inside [from, to).
 * An open session counts up to `now`. Handles sessions that cross midnight.
 */
export function overlapMs(session: Session, from: number, to: number, now: number): number {
  const end = session.end ?? now
  const lo = Math.max(session.start, from)
  const hi = Math.min(end, to)
  return Math.max(0, hi - lo)
}

/** Total ms per task inside [from, to). */
export function msByTask(
  sessions: Session[],
  from: number,
  to: number,
  now: number,
): Map<number, number> {
  const out = new Map<number, number>()
  for (const s of sessions) {
    const ms = overlapMs(s, from, to, now)
    if (ms > 0) out.set(s.taskId, (out.get(s.taskId) ?? 0) + ms)
  }
  return out
}

/** 3725000 -> "1:02:05" (always h:mm:ss, for the big timer). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return `${h}:${mm}:${ss}`
}

/** 3900000 -> "1h 05m", 600000 -> "10m", 0 -> "0m" (compact, for cards and stats). */
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(Math.max(0, ms) / MIN)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}
