import { describe, expect, it } from 'vitest'
import {
  buildBuckets,
  currentStreak,
  dailyTotals,
  elapsedDays,
  niceScale,
  periodLabel,
  rangeFor,
  shiftAnchor,
  summarize,
  taskRows,
} from './stats'
import { HOUR, MIN, addDays } from './time'
import type { Session, Task } from './types'

// Wed 28 Oct 2026, 15:00 local
const NOW = new Date(2026, 9, 28, 15).getTime()
const day = (d: number, h = 0, m = 0) => new Date(2026, 9, d, h, m).getTime()
const sess = (taskId: number, start: number, end: number | null): Session => ({ taskId, start, end })
const task = (id: number, over: Partial<Task> = {}): Task => ({
  id,
  name: `T${id}`,
  color: '#2a78d6',
  dailyTargetMinutes: 60,
  archived: false,
  order: id,
  createdAt: day(1),
  ...over,
})

describe('ranges', () => {
  it('week is Mon-Sun, month is the calendar month', () => {
    const w = rangeFor('week', NOW)
    expect(w.from).toBe(day(26))
    expect(w.to).toBe(new Date(2026, 10, 2).getTime()) // Mon 2 Nov
    const m = rangeFor('month', NOW)
    expect(m.from).toBe(day(1))
    expect(m.to).toBe(new Date(2026, 10, 1).getTime())
  })

  it('shifts and labels periods', () => {
    expect(shiftAnchor('week', NOW, -1)).toBe(day(21))
    expect(new Date(shiftAnchor('month', NOW, 1)).getMonth()).toBe(10)
    expect(periodLabel('day', rangeFor('day', NOW), NOW)).toBe('Today')
    expect(periodLabel('day', rangeFor('day', day(27)), NOW)).toBe('Yesterday')
  })
})

describe('buckets', () => {
  it('builds 24 hourly, 7 weekly and 31 monthly buckets', () => {
    expect(buildBuckets([], 'day', rangeFor('day', NOW), NOW)).toHaveLength(24)
    expect(buildBuckets([], 'week', rangeFor('week', NOW), NOW)).toHaveLength(7)
    expect(buildBuckets([], 'month', rangeFor('month', NOW), NOW)).toHaveLength(31)
  })

  it('splits a session across hours', () => {
    const s = [sess(1, day(28, 9, 30), day(28, 10, 15))]
    const b = buildBuckets(s, 'day', rangeFor('day', NOW), NOW)
    expect(b[9].total).toBe(30 * MIN)
    expect(b[10].total).toBe(15 * MIN)
    expect(b[9].byTask.get(1)).toBe(30 * MIN)
  })

  it('marks the current bucket and future buckets', () => {
    const b = buildBuckets([], 'week', rangeFor('week', NOW), NOW)
    expect(b[2].isCurrent).toBe(true) // Wednesday
    expect(b[3].future).toBe(true)
    expect(b[1].future).toBe(false)
  })
})

describe('summary', () => {
  const sessions = [
    sess(1, day(26, 10), day(26, 11)), // Mon 1h
    sess(1, day(27, 22, 30), day(28, 0, 30)), // Tue 1.5h + Wed 30m (crosses midnight)
    sess(2, day(28, 9), day(28, 9, 20)), // Wed 20m
  ]

  it('totals, average over elapsed days, best day', () => {
    const range = rangeFor('week', NOW)
    const s = summarize(sessions, range, NOW, dailyTotals(sessions, NOW))
    expect(s.total).toBe(HOUR + 90 * MIN + 30 * MIN + 20 * MIN)
    expect(s.days).toBe(3) // Mon, Tue, Wed have started
    expect(s.avgPerDay).toBeCloseTo(s.total / 3)
    expect(s.best).toEqual({ day: day(27), ms: 90 * MIN })
    expect(s.daysStudied).toBe(3)
    expect(s.sessionCount).toBe(3)
  })

  it('elapsedDays counts only started days', () => {
    expect(elapsedDays(rangeFor('week', NOW), NOW)).toBe(3)
    expect(elapsedDays(rangeFor('month', NOW), NOW)).toBe(28)
    expect(elapsedDays(rangeFor('week', day(14)), NOW)).toBe(7)
  })
})

describe('streak', () => {
  it('counts back from today, and a quiet today does not break it', () => {
    const d = new Map<number, number>([
      [day(26), HOUR],
      [day(27), HOUR],
    ])
    expect(currentStreak(d, NOW)).toBe(2) // today empty, yesterday + day before count
    d.set(day(28), 5 * MIN)
    expect(currentStreak(d, NOW)).toBe(3)
    d.delete(day(27))
    expect(currentStreak(d, NOW)).toBe(1)
  })

  it('ignores days under a minute', () => {
    expect(currentStreak(new Map([[day(28), 30_000]]), NOW)).toBe(0)
  })
})

describe('task rows', () => {
  it('only counts target for days the task existed', () => {
    const created = task(1, { createdAt: day(27, 12) }) // created Tue
    const rows = taskRows([created], [], rangeFor('week', NOW), NOW)
    expect(rows[0].targetMs).toBe(2 * 60 * MIN) // Tue + Wed
  })

  it('shows archived tasks only if they have time, with no target', () => {
    const arch = task(2, { archived: true })
    expect(taskRows([arch], [], rangeFor('week', NOW), NOW)).toHaveLength(0)
    const rows = taskRows([arch], [sess(2, day(27, 9), day(27, 10))], rangeFor('week', NOW), NOW)
    expect(rows[0]).toMatchObject({ ms: HOUR, targetMs: null })
  })

  it('has no target for a day before the task existed', () => {
    const t = task(1, { createdAt: day(28) })
    const rows = taskRows([t], [], rangeFor('day', day(27)), NOW)
    expect(rows[0].targetMs).toBeNull()
  })
})

describe('axis', () => {
  it('picks clean tops with at most 4 intervals', () => {
    expect(niceScale(0)).toEqual({ top: HOUR, step: 15 * MIN })
    expect(niceScale(5.3 * HOUR)).toEqual({ top: 6 * HOUR, step: 2 * HOUR })
    expect(niceScale(3 * HOUR)).toEqual({ top: 3 * HOUR, step: HOUR })
  })

  it('addDays stays on midnights', () => {
    expect(addDays(NOW, 1)).toBe(day(29))
  })
})
