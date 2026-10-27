import { Pause, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Task } from '../lib/types'
import { MIN, formatClock, formatDuration } from '../lib/time'
import { pause, start } from '../lib/timer'
import { inkOn, taskColor } from '../lib/colors'

interface Props {
  /** The task currently running, if any */
  active?: Task
  /** The task to resume when idle (last used), if any */
  resumeTask?: Task
  /** Today's ms on the displayed task */
  taskMs: number
  /** Today's ms across all tasks */
  totalMs: number
}

export function ActiveTimerCard({ active, resumeTask, taskMs, totalMs }: Props) {
  const task = active ?? resumeTask
  const targetMs = task ? task.dailyTargetMinutes * MIN : 0
  const pct = task && targetMs > 0 ? Math.min(100, (taskMs / targetMs) * 100) : 0

  // Running: the card wears the task's colour. Idle: the app accent.
  const bg = active ? taskColor(active.color) : '#4f46e5'
  const ink = active ? inkOn(active.color) : '#ffffff'

  return (
    <motion.section
      layout
      className="relative overflow-hidden rounded-[2rem] p-6 shadow-lg"
      style={{ background: bg, color: ink }}
    >
      {/* Soft sheen so the flat colour doesn't look like a block */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 to-black/10" />

      <div className="relative">
        <div className="flex items-center justify-between text-sm/6 font-medium opacity-80">
          <span className="flex items-center gap-2">
            {active && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
              </span>
            )}
            {active ? active.name : task ? `Up next: ${task.name}` : 'No task yet'}
          </span>
          <span>{formatDuration(totalMs)} today</span>
        </div>

        <div className="tabular mt-4 text-center text-6xl font-semibold tracking-tight">{formatClock(taskMs)}</div>

        {task && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-current/25">
              <div className="h-full rounded-full bg-current transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 text-center text-xs opacity-75">
              {formatDuration(taskMs)} of {formatDuration(targetMs)}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-center">
          <button
            disabled={!task}
            onClick={() => (active ? pause() : task && start(task.id!))}
            aria-label={active ? 'Pause' : 'Start'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-900 shadow-md transition-transform active:scale-95 disabled:opacity-40"
          >
            {active ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>
        </div>
      </div>
    </motion.section>
  )
}
