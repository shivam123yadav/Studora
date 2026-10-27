import { db } from './db'
import type { Session, Task } from './types'

/**
 * Timer engine.
 *
 * Time is stored as sessions (taskId, start, end). A task's total is the sum of
 * its sessions, so pause/resume/switch are just "close the open session" and
 * "open a new one". Because only the start timestamp is stored, the timer is
 * exact across refreshes, closed tabs and throttled background tabs.
 *
 * Invariant: at most one session is open (end === null) at any time, and it is
 * always the most recent session by `start`.
 */

/** The currently running session, or undefined if nothing is running. */
export async function getRunningSession(): Promise<Session | undefined> {
  const latest = await db.sessions.orderBy('start').reverse().first()
  return latest && latest.end === null ? latest : undefined
}

/** Close the open session (if any). Returns the task id that was running. */
export async function pause(now = Date.now()): Promise<number | undefined> {
  return db.transaction('rw', db.sessions, async () => {
    const running = await getRunningSession()
    if (!running) return undefined
    await db.sessions.update(running.id!, { end: Math.max(now, running.start) })
    return running.taskId
  })
}

/**
 * Start (or resume) a task. If another task is running it is paused first, so
 * switching is a single tap. Starting the already-running task is a no-op.
 */
export async function start(taskId: number, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.sessions, db.tasks, async () => {
    const task = await db.tasks.get(taskId)
    if (!task) throw new Error(`Task ${taskId} does not exist`)

    const running = await getRunningSession()
    if (running?.taskId === taskId) return
    if (running) await db.sessions.update(running.id!, { end: Math.max(now, running.start) })

    await db.sessions.add({ taskId, start: now, end: null })
  })
}

/** Tap on a task's play/pause button. */
export async function toggle(taskId: number, now = Date.now()): Promise<void> {
  const running = await getRunningSession()
  if (running?.taskId === taskId) await pause(now)
  else await start(taskId, now)
}

// ---------- Task management ----------

export type NewTask = Pick<Task, 'name' | 'color' | 'dailyTargetMinutes'>

export async function addTask(input: NewTask): Promise<number> {
  const last = await db.tasks.orderBy('order').reverse().first()
  const id = await db.tasks.add({
    ...input,
    archived: false,
    order: (last?.order ?? -1) + 1,
    createdAt: Date.now(),
  })
  return id as number
}

export async function updateTask(
  id: number,
  changes: Partial<Pick<Task, 'name' | 'color' | 'dailyTargetMinutes' | 'order'>>,
): Promise<void> {
  await db.tasks.update(id, changes)
}

/** Hide a task from Today but keep its history in the stats. Stops it if running. */
export async function archiveTask(id: number, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.tasks, db.sessions, async () => {
    const running = await getRunningSession()
    if (running?.taskId === id) await db.sessions.update(running.id!, { end: Math.max(now, running.start) })
    await db.tasks.update(id, { archived: true })
  })
}

/** Permanently delete a task and all of its sessions. */
export async function deleteTask(id: number): Promise<void> {
  await db.transaction('rw', db.tasks, db.sessions, async () => {
    await db.sessions.where('taskId').equals(id).delete()
    await db.tasks.delete(id)
  })
}
