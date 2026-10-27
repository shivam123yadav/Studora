// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StackedBars } from './StackedBars'
import { buildBuckets, rangeFor } from '../lib/stats'
import { HOUR, MIN } from '../lib/time'
import type { Session, Task } from '../lib/types'

const NOW = new Date(2026, 9, 28, 15).getTime()
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime()

const tasks: Task[] = [
  { id: 1, name: 'Maths', color: '#2a78d6', dailyTargetMinutes: 180, archived: false, order: 0, createdAt: at(1, 0) },
  { id: 2, name: 'Physics', color: '#eb6834', dailyTargetMinutes: 120, archived: false, order: 1, createdAt: at(1, 0) },
]
const sessions: Session[] = [
  { taskId: 1, start: at(26, 9), end: at(26, 10) },
  { taskId: 2, start: at(26, 10), end: at(26, 10, 30) },
  { taskId: 1, start: at(27, 18), end: at(27, 20) },
]

describe('StackedBars', () => {
  it('renders one column per bucket with a segment per task', () => {
    const buckets = buildBuckets(sessions, 'week', rangeFor('week', NOW), NOW)
    const html = renderToStaticMarkup(<StackedBars buckets={buckets} tasks={tasks} label="Week" />)
    expect((html.match(/aria-label="[A-Z][a-z]{2}, /g) ?? []).length).toBe(7)
    expect(html).toContain('#2a78d6')
    expect(html).toContain('#eb6834')
    expect(html).not.toContain('No study time recorded')
  })

  it('shows the empty state when there is no data', () => {
    const buckets = buildBuckets([], 'month', rangeFor('month', NOW), NOW)
    const html = renderToStaticMarkup(<StackedBars buckets={buckets} tasks={tasks} label="Month" />)
    expect(html).toContain('No study time recorded')
  })

  it('uses a clean axis for the data range', () => {
    const buckets = buildBuckets(sessions, 'week', rangeFor('week', NOW), NOW)
    expect(Math.max(...buckets.map((b) => b.total))).toBe(2 * HOUR)
    expect(buckets[0].total).toBe(90 * MIN)
  })
})
