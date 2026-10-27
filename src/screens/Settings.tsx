import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Check, Download, Monitor, Moon, Sun, Trash2, Upload } from 'lucide-react'
import { useTheme, type Theme } from '../hooks/useTheme'
import { db } from '../lib/db'
import {
  BackupError,
  backupFilename,
  exportData,
  importData,
  parseBackup,
  resetData,
  type Backup,
} from '../lib/backup'

const OPTIONS: { id: Theme; label: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
]

const LAST_BACKUP_KEY = 'lastBackupAt'

function readLastBackup(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_BACKUP_KEY))
    return v > 0 ? v : null
  } catch {
    return null
  }
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

type Notice = { kind: 'ok' | 'error'; text: string }

export function Settings() {
  const { theme, setTheme } = useTheme()
  const taskCount = useLiveQuery(() => db.tasks.count(), [])
  const sessionCount = useLiveQuery(() => db.sessions.count(), [])

  const fileInput = useRef<HTMLInputElement>(null)
  const [lastBackup, setLastBackup] = useState(readLastBackup)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pending, setPending] = useState<{ backup: Backup; skipped: number; fileName: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  async function onExport() {
    const now = Date.now()
    download(backupFilename(now), JSON.stringify(await exportData(now), null, 2))
    try {
      localStorage.setItem(LAST_BACKUP_KEY, String(now))
    } catch {
      /* storage unavailable */
    }
    setLastBackup(now)
    setNotice({ kind: 'ok', text: 'Backup downloaded. Keep the file somewhere safe, like Google Drive.' })
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return
    setNotice(null)
    try {
      const { backup, skipped } = parseBackup(await file.text())
      setPending({ backup, skipped, fileName: file.name })
    } catch (e) {
      setPending(null)
      setNotice({ kind: 'error', text: e instanceof BackupError ? e.message : 'Could not read that file.' })
    }
    if (fileInput.current) fileInput.current.value = '' // allow re-picking the same file
  }

  async function onConfirmImport() {
    if (!pending) return
    const { tasks, sessions } = await importData(pending.backup)
    setPending(null)
    setNotice({ kind: 'ok', text: `Restored ${tasks} ${tasks === 1 ? 'task' : 'tasks'} and ${sessions} sessions.` })
  }

  async function onReset() {
    await resetData()
    setConfirmReset(false)
    setNotice({ kind: 'ok', text: 'All data deleted.' })
  }

  const card = 'rounded-3xl bg-[var(--surface)] p-5 ring-1 ring-[var(--border)]'

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className={card}>
        <h2 className="mb-3 text-sm font-medium text-[var(--muted)]">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={`flex flex-col items-center gap-2 rounded-2xl py-4 text-sm font-medium transition-colors ${
                theme === id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-medium text-[var(--muted)]">Your data</h2>
        <p className="mt-2 text-sm">
          <span className="tabular font-semibold">{taskCount ?? 0}</span> tasks ·{' '}
          <span className="tabular font-semibold">{sessionCount ?? 0}</span> sessions
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Everything is stored only on this device. Clearing browser data or changing phones erases it, so
          back up now and then.
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Last backup:{' '}
          {lastBackup
            ? new Date(lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
            : 'never'}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onExport}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-semibold transition active:scale-[0.98]"
          >
            <Upload size={16} /> Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
        </div>

        {pending && (
          <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="font-medium">Replace your current data?</p>
                <p className="mt-1 text-[var(--muted)]">
                  {pending.fileName} has {pending.backup.tasks.length} tasks and {pending.backup.sessions.length}{' '}
                  sessions. Your current tasks and history will be overwritten.
                  {pending.skipped > 0 && ` ${pending.skipped} damaged sessions will be skipped.`}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setPending(null)} className="rounded-xl bg-[var(--surface)] py-2.5 font-medium">
                Cancel
              </button>
              <button onClick={onConfirmImport} className="rounded-xl bg-[var(--color-accent)] py-2.5 font-semibold text-white">
                Replace
              </button>
            </div>
          </div>
        )}

        {notice && (
          <p
            role="status"
            className={`mt-4 flex items-start gap-2 text-sm ${notice.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}
          >
            {notice.kind === 'ok' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            {notice.text}
          </p>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-medium text-[var(--muted)]">Danger zone</h2>
        {confirmReset ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmReset(false)} className="rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-medium">
              Cancel
            </button>
            <button onClick={onReset} className="flex items-center justify-center gap-2 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white">
              <Trash2 size={16} /> Delete everything
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--surface-2)] py-3 text-sm font-medium text-red-500"
          >
            <Trash2 size={16} /> Delete all data
          </button>
        )}
      </section>
    </div>
  )
}
