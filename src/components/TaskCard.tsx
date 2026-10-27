import { Check, MoreHorizontal, Pause, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Task } from '../lib/types'
import { MIN, formatDuration } from '../lib/time'
import { toggle } from '../lib/timer'
import { inkOn, taskColor } from '../lib/colors'

interface Props {
  task: Task
  ms: number
  running: boolean
  onEdit: () => void
}

export function TaskCard({ task, ms, running, onEdit }: Props) {
  const color = taskColor(task.color)
  const targetMs = task.dailyTargetMinutes * MIN
  const pct = targetMs > 0 ? Math.min(100, (ms / targetMs) * 100) : 0
  const done = targetMs > 0 && ms >= targetMs
  const over = ms - targetMs

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-[var(--surface)] p-4 ring-1 transition-shadow"
      style={{
        // Running card gets an accent ring so the active task is obvious at a glance
        ['--tw-ring-color' as string]: running ? color : 'var(--border)',
        // Always a defined value: framer-motion keeps the last value when a style goes to
        // `undefined`, which left the glow stuck on after a task was paused.
        boxShadow: `0 8px 24px -12px ${running ? color : 'transparent'}`,
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => toggle(task.id!)}
          aria-label={running ? `Pause ${task.name}` : `Start ${task.name}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: color, color: inkOn(task.color) }}
        >
          {running ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{task.name}</span>
            {done && <Check size={16} className="shrink-0 text-emerald-500" strokeWidth={3} />}
          </div>
          <div className="tabular text-sm text-[var(--muted)]">
            {formatDuration(ms)} / {formatDuration(targetMs)}
            {over >= MIN && <span className="ml-1.5 font-medium text-emerald-500">+{formatDuration(over)}</span>}
          </div>
        </div>

        <button
          onClick={onEdit}
          aria-label={`Edit ${task.name}`}
          className="rounded-full p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </motion.div>
  )
}
