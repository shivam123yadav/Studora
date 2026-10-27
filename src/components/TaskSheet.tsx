import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, Trash2, X } from 'lucide-react'
import type { Task } from '../lib/types'
import { TASK_COLORS, taskColor } from '../lib/colors'
import { addTask, archiveTask, deleteTask, updateTask } from '../lib/timer'

interface Props {
  open: boolean
  /** Task being edited; undefined means "new task" */
  task?: Task
  /** Colour pre-selected for a new task (the next unused slot) */
  defaultColor?: string
  onClose: () => void
}

const PRESETS = [30, 60, 120, 180, 240]

export function TaskSheet({ open, task, defaultColor, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-[2rem] bg-[var(--surface)] p-6 shadow-2xl"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            {/* Remount the form per task so its state always starts fresh */}
            <SheetForm key={task?.id ?? 'new'} task={task} defaultColor={defaultColor} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function SheetForm({
  task,
  defaultColor,
  onClose,
}: {
  task?: Task
  defaultColor?: string
  onClose: () => void
}) {
  const [name, setName] = useState(task?.name ?? '')
  const [color, setColor] = useState(task?.color ?? defaultColor ?? TASK_COLORS[0])
  const [hours, setHours] = useState(String(Math.floor((task?.dailyTargetMinutes ?? 60) / 60)))
  const [minutes, setMinutes] = useState(String((task?.dailyTargetMinutes ?? 60) % 60))
  const [confirmDelete, setConfirmDelete] = useState(false)

  const targetMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0)
  const valid = name.trim().length > 0 && targetMinutes > 0

  function setTarget(total: number) {
    setHours(String(Math.floor(total / 60)))
    setMinutes(String(total % 60))
  }

  async function save() {
    if (!valid) return
    const data = { name: name.trim(), color, dailyTargetMinutes: targetMinutes }
    if (task) await updateTask(task.id!, data)
    else await addTask(data)
    onClose()
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{task ? 'Edit task' : 'New task'}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full bg-[var(--surface-2)] p-2 text-[var(--muted)]"
        >
          <X size={18} />
        </button>
      </div>

      <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Name</label>
      <input
        autoFocus={!task}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="e.g. Maths"
        maxLength={40}
        className="w-full rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-base outline-none ring-2 ring-transparent transition focus:ring-[var(--color-accent)]"
      />

      <label className="mb-1.5 mt-5 block text-sm font-medium text-[var(--muted)]">Daily target</label>
      <div className="flex items-center gap-2">
        <NumberBox value={hours} onChange={setHours} max={24} suffix="h" label="Hours" />
        <NumberBox value={minutes} onChange={setMinutes} max={59} suffix="m" label="Minutes" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setTarget(p)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              targetMinutes === p ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--surface-2)]'
            }`}
          >
            {p < 60 ? `${p}m` : `${p / 60}h`}
          </button>
        ))}
      </div>

      <label className="mb-1.5 mt-5 block text-sm font-medium text-[var(--muted)]">Colour</label>
      <div className="flex flex-wrap gap-3">
        {TASK_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
            aria-pressed={color === c}
            className="h-9 w-9 rounded-full transition-transform active:scale-90"
            style={{
              background: taskColor(c),
              boxShadow: color === c ? `0 0 0 3px var(--surface), 0 0 0 5px ${taskColor(c)}` : undefined,
            }}
          />
        ))}
      </div>

      <button
        onClick={save}
        disabled={!valid}
        className="mt-6 w-full rounded-2xl bg-[var(--color-accent)] py-3.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-40"
      >
        {task ? 'Save changes' : 'Add task'}
      </button>

      {task && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={async () => {
              await archiveTask(task.id!)
              onClose()
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-medium"
          >
            <Archive size={16} /> Archive
          </button>
          {confirmDelete ? (
            <button
              onClick={async () => {
                await deleteTask(task.id!)
                onClose()
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white"
            >
              <Trash2 size={16} /> Tap again to delete
            </button>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-medium text-red-500"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>
      )}
      {task && (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          Archive hides the task but keeps its history in Stats. Delete removes its history too.
        </p>
      )}
    </>
  )
}

function NumberBox({
  value,
  onChange,
  max,
  suffix,
  label,
}: {
  value: string
  onChange: (v: string) => void
  max: number
  suffix: string
  label: string
}) {
  return (
    <div className="flex flex-1 items-center rounded-2xl bg-[var(--surface-2)] px-4 ring-2 ring-transparent focus-within:ring-[var(--color-accent)]">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        aria-label={label}
        value={value}
        onChange={(e) => {
          const n = Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0)))
          onChange(e.target.value === '' ? '' : String(n))
        }}
        className="tabular w-full bg-transparent py-3 text-lg outline-none"
      />
      <span className="text-[var(--muted)]">{suffix}</span>
    </div>
  )
}
