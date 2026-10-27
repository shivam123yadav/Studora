import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addTask, start, pause, getRunningSession } from './timer'
import { backupFilename, exportData, importData, parseBackup, resetData, BackupError } from './backup'

beforeEach(async () => {
  await resetData()
})

async function seed() {
  const a = await addTask({ name: 'Maths', color: '#2a78d6', dailyTargetMinutes: 180 })
  const b = await addTask({ name: 'Physics', color: '#eb6834', dailyTargetMinutes: 90 })
  await start(a, 1000)
  await start(b, 5000)
  await pause(9000)
  return { a, b }
}

describe('backup', () => {
  it('round-trips: export, wipe, import gives back identical data', async () => {
    const { a, b } = await seed()
    const before = await exportData(1)
    const text = JSON.stringify(before)

    await resetData()
    expect(await db.tasks.count()).toBe(0)

    const { backup, skipped } = parseBackup(text)
    expect(skipped).toBe(0)
    expect(await importData(backup)).toEqual({ tasks: 2, sessions: 2 })

    const after = await exportData(1)
    expect(after.tasks).toEqual(before.tasks)
    expect(after.sessions.map(({ taskId, start, end }) => ({ taskId, start, end }))).toEqual(
      before.sessions.map(({ taskId, start, end }) => ({ taskId, start, end })),
    )
    expect(after.tasks.map((t) => t.id)).toEqual([a, b])
  })

  it('import replaces existing data rather than merging', async () => {
    await seed()
    const text = JSON.stringify(await exportData())
    await addTask({ name: 'Extra', color: '#008300', dailyTargetMinutes: 30 })
    await importData(parseBackup(text).backup)
    expect(await db.tasks.count()).toBe(2)
  })

  it('keeps a running session running after import', async () => {
    const { a } = await seed()
    await start(a, 20_000)
    const text = JSON.stringify(await exportData())
    await resetData()
    await importData(parseBackup(text).backup)
    expect((await getRunningSession())?.taskId).toBe(a)
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Study Timer backup/)
    expect(() => parseBackup('null')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"study-timer","version":2,"tasks":[],"sessions":[]}')).toThrow(/newer version/)
    expect(() => parseBackup('{"app":"study-timer","version":1,"tasks":[{"id":1}],"sessions":[]}')).toThrow(/damaged/)
  })

  it('drops sessions for unknown tasks and bad times, and counts them', () => {
    const file = {
      app: 'study-timer',
      version: 1,
      tasks: [{ id: 1, name: 'A', color: '#2a78d6', dailyTargetMinutes: 60, archived: false, order: 0, createdAt: 0 }],
      sessions: [
        { taskId: 1, start: 0, end: 10 },
        { taskId: 99, start: 0, end: 10 }, // orphan
        { taskId: 1, start: 50, end: 40 }, // ends before it starts
        { taskId: 1, start: 'x', end: 5 }, // garbage
      ],
    }
    const { backup, skipped } = parseBackup(JSON.stringify(file))
    expect(skipped).toBe(3)
    expect(backup.sessions).toHaveLength(1)
  })

  it('closes older "open" sessions so at most the latest one is running', () => {
    const file = {
      app: 'study-timer',
      version: 1,
      tasks: [{ id: 1, name: 'A', color: '#2a78d6', dailyTargetMinutes: 60, archived: false, order: 0, createdAt: 0 }],
      sessions: [
        { taskId: 1, start: 100, end: null },
        { taskId: 1, start: 300, end: null },
      ],
    }
    const { backup } = parseBackup(JSON.stringify(file))
    expect(backup.sessions[0].end).toBe(300)
    expect(backup.sessions[1].end).toBeNull()
  })

  it('names the file by local date', () => {
    expect(backupFilename(new Date(2026, 9, 7, 12).getTime())).toBe('study-timer-backup-2026-10-07.json')
  })
})
