import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { db } from '../lib/db'
import { TASK_COLORS } from '../lib/colors'
import type { Task } from '../lib/types'
import { useTasks, useTodayTotals } from '../hooks/useTimer'
import { ActiveTimerCard } from '../components/ActiveTimerCard'
import { TaskCard } from '../components/TaskCard'
import { TaskSheet } from '../components/TaskSheet'

export function Today() {
  const tasks = useTasks()
  const { totals, running, loading, now } = useTodayTotals()
  const lastSession = useLiveQuery(() => db.sessions.orderBy('start').reverse().first(), [])
  const [sheet, setSheet] = useState<{ open: boolean; task?: Task }>({ open: false })

  if (!tasks || loading) return null // first IndexedDB read takes a few ms

  const active = running ? tasks.find((t) => t.id === running.taskId) : undefined
  const resumeTask = tasks.find((t) => t.id === lastSession?.taskId) ?? tasks[0]
  const shown = active ?? resumeTask
  const totalMs = tasks.reduce((sum, t) => sum + (totals.get(t.id!) ?? 0), 0)
  const dateLabel = new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-[var(--muted)]">{dateLabel}</p>
        <h1 className="text-2xl font-semibold">Today</h1>
      </header>

      <ActiveTimerCard
        active={active}
        resumeTask={resumeTask}
        taskMs={shown ? (totals.get(shown.id!) ?? 0) : 0}
        totalMs={totalMs}
      />

      {tasks.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--border)] p-8 text-center">
          <p className="font-medium">Add your first task</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Set a daily target for each subject. It repeats every day until you change it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              ms={totals.get(t.id!) ?? 0}
              running={active?.id === t.id}
              onEdit={() => setSheet({ open: true, task: t })}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setSheet({ open: true })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] py-3.5 font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        <Plus size={18} /> Add task
      </button>

      <TaskSheet
        open={sheet.open}
        task={sheet.task}
        defaultColor={TASK_COLORS[tasks.length % TASK_COLORS.length]}
        onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  )
}
