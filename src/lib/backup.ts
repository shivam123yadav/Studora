import { db } from './db'
import type { Session, Task } from './types'

/** Everything lives in this one browser, so a backup file is the only copy that can survive a wiped phone. */
export interface Backup {
  /** File-format identifier, not the display name. Kept as-is so backups made before the rename still import. */
  app: 'study-timer'
  version: 1
  exportedAt: number
  tasks: Task[]
  sessions: Session[]
}

export class BackupError extends Error {}

export async function exportData(now = Date.now()): Promise<Backup> {
  const [tasks, sessions] = await Promise.all([db.tasks.toArray(), db.sessions.orderBy('start').toArray()])
  return { app: 'study-timer', version: 1, exportedAt: now, tasks, sessions }
}

export function backupFilename(now = Date.now()): string {
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, '0')
  return `studora-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isId = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v > 0

/**
 * Validate and normalise a backup file's text. Throws BackupError with a readable
 * message for anything that isn't a Studora backup. Sessions that point at a
 * missing task are dropped (and counted in `skipped`), and the "only the latest
 * session may be running" rule is restored.
 */
export function parseBackup(text: string): { backup: Backup; skipped: number } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('That file is not valid JSON.')
  }
  if (typeof raw !== 'object' || raw === null) throw new BackupError('That is not a Studora backup.')
  const r = raw as Record<string, unknown>
  if (r.app !== 'study-timer') throw new BackupError('That is not a Studora backup.')
  if (r.version !== 1) throw new BackupError('This backup was made by a newer version of the app.')
  if (!Array.isArray(r.tasks) || !Array.isArray(r.sessions)) throw new BackupError('The backup is missing its data.')

  const tasks: Task[] = []
  const ids = new Set<number>()
  r.tasks.forEach((t: unknown, i: number) => {
    const o = (t ?? {}) as Record<string, unknown>
    if (!isId(o.id) || typeof o.name !== 'string' || !o.name.trim()) {
      throw new BackupError(`Task ${i + 1} in the backup is damaged.`)
    }
    if (ids.has(o.id)) throw new BackupError('The backup contains duplicate tasks.')
    ids.add(o.id)
    tasks.push({
      id: o.id,
      name: o.name.trim(),
      color: typeof o.color === 'string' ? o.color : '#2a78d6',
      dailyTargetMinutes: isNum(o.dailyTargetMinutes) && o.dailyTargetMinutes > 0 ? Math.round(o.dailyTargetMinutes) : 60,
      archived: o.archived === true,
      order: isNum(o.order) ? o.order : i,
      createdAt: isNum(o.createdAt) ? o.createdAt : 0,
    })
  })

  let skipped = 0
  const sessions: Session[] = []
  for (const s of r.sessions as unknown[]) {
    const o = (s ?? {}) as Record<string, unknown>
    const validEnd = o.end === null || (isNum(o.end) && isNum(o.start) && o.end >= o.start)
    if (!isId(o.taskId) || !ids.has(o.taskId) || !isNum(o.start) || !validEnd) {
      skipped++
      continue
    }
    sessions.push({ taskId: o.taskId, start: o.start, end: o.end as number | null })
  }

  // Only the most recent session may still be running; close earlier "open" ones at the next start.
  sessions.sort((a, b) => a.start - b.start)
  sessions.forEach((s, i) => {
    if (s.end === null && i < sessions.length - 1) s.end = sessions[i + 1].start
  })

  return {
    backup: { app: 'study-timer', version: 1, exportedAt: isNum(r.exportedAt) ? r.exportedAt : 0, tasks, sessions },
    skipped,
  }
}

/** Replace ALL current data with the backup's. Task ids are kept so sessions stay linked. */
export async function importData(backup: Backup): Promise<{ tasks: number; sessions: number }> {
  await db.transaction('rw', db.tasks, db.sessions, async () => {
    await db.tasks.clear()
    await db.sessions.clear()
    await db.tasks.bulkAdd(backup.tasks)
    await db.sessions.bulkAdd(backup.sessions)
  })
  return { tasks: backup.tasks.length, sessions: backup.sessions.length }
}

export async function resetData(): Promise<void> {
  await db.transaction('rw', db.tasks, db.sessions, async () => {
    await db.tasks.clear()
    await db.sessions.clear()
  })
}
