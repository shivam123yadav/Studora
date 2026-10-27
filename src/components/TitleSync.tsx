import { useEffect } from 'react'
import { formatClock } from '../lib/time'
import { useTasks, useTodayTotals } from '../hooks/useTimer'

const DEFAULT_TITLE = 'Study Timer'

/**
 * Mirrors the running timer into the browser tab title ("1:02:05 · Maths"), so you can see
 * it from another tab. Renders nothing, and lives in its own component so the once-a-second
 * updates don't re-render the whole app.
 */
export function TitleSync() {
  const tasks = useTasks()
  const { totals, running } = useTodayTotals()
  const task = running ? tasks?.find((t) => t.id === running.taskId) : undefined
  const ms = task ? (totals.get(task.id!) ?? 0) : 0

  useEffect(() => {
    document.title = task ? `${formatClock(ms)} · ${task.name}` : DEFAULT_TITLE
  }, [task, ms])

  useEffect(() => {
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [])
  return null
}
