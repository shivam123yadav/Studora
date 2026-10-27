import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addTask, archiveTask, deleteTask, getRunningSession, pause, start, toggle } from './timer'
import { MIN, addDays, formatClock, formatDuration, msByTask, startOfDay, startOfWeek } from './time'

let a: number
let b: number

beforeEach(async () => {
  await db.tasks.clear()
  await db.sessions.clear()
  a = await addTask({ name: 'Maths', color: '#6366f1', dailyTargetMinutes: 180 })
  b = await addTask({ name: 'Physics', color: '#10b981', dailyTargetMinutes: 120 })
})

describe('timer engine', () => {
  it('starts, pauses and resumes a task as separate sessions', async () => {
    await start(a, 1000)
    expect((await getRunningSession())?.taskId).toBe(a)
    await pause(61_000)
    expect(await getRunningSession()).toBeUndefined()
    await start(a, 100_000)
    await pause(160_000)

    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(2)
    const totals = msByTask(sessions, 0, 1e12, 999_999)
    expect(totals.get(a)).toBe(60_000 + 60_000)
  })

  it('switching tasks auto-pauses the running one', async () => {
    await start(a, 0)
    await start(b, 60 * MIN) // a ran 1h, switch to b
    await start(a, 120 * MIN) // b ran 1h, back to a
    await pause(150 * MIN) // a ran 30m more

    const totals = msByTask(await db.sessions.toArray(), 0, 1e12, 0)
    expect(totals.get(a)).toBe(90 * MIN)
    expect(totals.get(b)).toBe(60 * MIN)
    expect((await db.sessions.toArray()).filter((s) => s.end === null)).toHaveLength(0)
  })

  it('never leaves more than one open session', async () => {
    await start(a, 0)
    await start(b, 10)
    await start(a, 20)
    await toggle(b, 30)
    expect((await db.sessions.toArray()).filter((s) => s.end === null)).toHaveLength(1)
  })

  it('starting the already-running task is a no-op', async () => {
    await start(a, 0)
    await start(a, 5000)
    expect(await db.sessions.count()).toBe(1)
  })

  it('toggle pauses when running and starts when not', async () => {
    await toggle(a, 0)
    expect((await getRunningSession())?.taskId).toBe(a)
    await toggle(a, 1000)
    expect(await getRunningSession()).toBeUndefined()
  })

  it('counts an open session up to "now"', async () => {
    await start(a, 0)
    const totals = msByTask(await db.sessions.toArray(), 0, 1e12, 5 * MIN)
    expect(totals.get(a)).toBe(5 * MIN)
  })

  it('splits a session that crosses midnight between two days', async () => {
    const day1 = startOfDay(new Date(2026, 9, 26, 12).getTime())
    const day2 = addDays(day1, 1)
    await start(a, day2 - 30 * MIN) // 23:30
    await pause(day2 + 45 * MIN) // 00:45 next day
    const sessions = await db.sessions.toArray()
    expect(msByTask(sessions, day1, day2, 0).get(a)).toBe(30 * MIN)
    expect(msByTask(sessions, day2, addDays(day2, 1), 0).get(a)).toBe(45 * MIN)
  })

  it('archive keeps history and stops the task; delete removes everything', async () => {
    await start(a, 0)
    await archiveTask(a, 10 * MIN)
    expect(await getRunningSession()).toBeUndefined()
    expect((await db.tasks.get(a))?.archived).toBe(true)
    expect(await db.sessions.count()).toBe(1)

    await deleteTask(a)
    expect(await db.tasks.get(a)).toBeUndefined()
    expect(await db.sessions.count()).toBe(0)
  })

  it('refuses to start a task that does not exist', async () => {
    await expect(start(9999)).rejects.toThrow()
  })
})

describe('time helpers', () => {
  it('formats clock and duration', () => {
    expect(formatClock(3725_000)).toBe('1:02:05')
    expect(formatClock(0)).toBe('0:00:00')
    expect(formatDuration(65 * MIN)).toBe('1h 05m')
    expect(formatDuration(10 * MIN)).toBe('10m')
  })

  it('week starts on Monday', () => {
    const wed = new Date(2026, 9, 28, 15).getTime() // Wed 28 Oct 2026
    expect(new Date(startOfWeek(wed)).getDay()).toBe(1)
    const sun = new Date(2026, 10, 1, 9).getTime() // Sun 1 Nov 2026
    expect(new Date(startOfWeek(sun)).getDate()).toBe(26) // Mon 26 Oct
  })
})
