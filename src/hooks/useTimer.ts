import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { getRunningSession } from '../lib/timer'
import { startOfDay, addDays, msByTask } from '../lib/time'

/**
 * Current time. Re-renders every `intervalMs` while `active` (a timer is running), and once
 * a minute otherwise so "today" rolls over at midnight even if the app is left open idle.
 * Also refreshes the moment the tab becomes visible again.
 */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, active ? intervalMs : 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [active, intervalMs])
  return now
}

/** Active (non-archived) tasks in display order. Updates live. */
export function useTasks() {
  return useLiveQuery(
    () => db.tasks.orderBy('order').filter((t) => !t.archived).toArray(),
    [],
  )
}

/** The running session, or undefined. `null` while the first query loads. */
export function useRunningSession() {
  return useLiveQuery(async () => (await getRunningSession()) ?? null, [])
}

/** Today's milliseconds per task id, ticking while something is running. */
export function useTodayTotals() {
  const running = useRunningSession()
  const now = useNow(!!running)
  const dayStart = startOfDay(now)
  const sessions = useLiveQuery(async () => {
    const recent = await db.sessions.where('start').above(addDays(dayStart, -1)).toArray()
    // A session left running for more than a day started before the window above
    const open = await getRunningSession()
    if (open && !recent.some((s) => s.id === open.id)) recent.push(open)
    return recent
  }, [dayStart])
  const totals = sessions ? msByTask(sessions, dayStart, addDays(dayStart, 1), now) : new Map<number, number>()
  return { totals, running: running ?? undefined, now, loading: sessions === undefined || running === null }
}
