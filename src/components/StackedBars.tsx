import { useEffect, useRef, useState } from 'react'
import type { Task } from '../lib/types'
import { formatDuration } from '../lib/time'
import { formatAxis, niceScale, type Bucket } from '../lib/stats'
import { taskColor } from '../lib/colors'

const PLOT_H = 168
const GUTTER = 'w-9' // y-axis label column

interface Props {
  buckets: Bucket[]
  /** All tasks (including archived) so history keeps its colours. Ordered bottom-to-top in the stack. */
  tasks: Task[]
  label: string
}

/**
 * Stacked columns, one stack per bucket (hour / day), one segment per task.
 * Marks follow the dataviz specs: columns capped at 24px, 4px rounded top, flat on the
 * baseline, 2px surface gaps between segments, hairline solid gridlines, text in ink
 * tokens (never the series colour). Hover/tap shows an exact-values tooltip.
 */
export function StackedBars({ buckets, tasks, label }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // Tapping anywhere outside the chart dismisses the tooltip (touch has no mouseleave)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const max = Math.max(0, ...buckets.map((b) => b.total))
  const { top, step } = niceScale(max)
  const ticks: number[] = []
  for (let t = 0; t <= top; t += step) ticks.push(t)

  const hovered = active !== null ? buckets[active] : null
  const tipLeft = active !== null ? Math.min(78, Math.max(22, ((active + 0.5) / buckets.length) * 100)) : 0

  return (
    <div ref={root}>
      <div className="flex">
        {/* Y axis labels */}
        <div className={`relative shrink-0 ${GUTTER}`} style={{ height: PLOT_H }} aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="tabular absolute right-2 translate-y-1/2 text-[11px] leading-none text-[var(--muted)]"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {formatAxis(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height: PLOT_H }}>
          {/* Gridlines: hairline, solid, recessive. The 0 line is the baseline. */}
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className="absolute inset-x-0 border-t"
              style={{
                bottom: `${(t / top) * 100}%`,
                borderColor: t === 0 ? 'var(--muted)' : 'var(--border)',
                opacity: t === 0 ? 0.45 : 1,
              }}
            />
          ))}

          <div role="group" aria-label={label} className="absolute inset-0 flex items-end">
            {buckets.map((b, i) => {
              const segs = tasks.filter((t) => (b.byTask.get(t.id!) ?? 0) > 0)
              const dim = active !== null && active !== i
              return (
                <button
                  key={b.from}
                  type="button"
                  disabled={b.future}
                  aria-label={`${b.title}: ${formatDuration(b.total)}`}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
                  onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
                  onPointerDown={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className={`relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-none transition-colors focus-visible:bg-[var(--surface-2)] ${
                    active === i ? 'bg-[var(--surface-2)]' : ''
                  }`}
                >
                  <div
                    className="flex w-full max-w-6 flex-col-reverse gap-[2px] px-px transition-opacity"
                    style={{ height: `${(b.total / top) * 100}%`, opacity: dim ? 0.5 : 1 }}
                  >
                    {segs.map((t, k) => (
                      <div
                        key={t.id}
                        className={k === segs.length - 1 ? 'rounded-t-[4px]' : ''}
                        style={{
                          flex: `${b.byTask.get(t.id!)} 1 0`,
                          minHeight: 2,
                          background: taskColor(t.color),
                        }}
                      />
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {max === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">
              No study time recorded
            </div>
          )}

          {hovered && (
            <div
              className="pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-36 max-w-56 -translate-x-1/2 rounded-2xl bg-[var(--surface)] p-3 text-sm shadow-lg ring-1 ring-[var(--border)]"
              style={{ left: `${tipLeft}%` }}
            >
              <div className="text-xs text-[var(--muted)]">{hovered.title}</div>
              <div className="tabular font-semibold">{hovered.total > 0 ? formatDuration(hovered.total) : 'No study'}</div>
              {tasks
                .filter((t) => (hovered.byTask.get(t.id!) ?? 0) > 0)
                .map((t) => (
                  <div key={t.id} className="mt-1 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: taskColor(t.color) }} />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="tabular text-[var(--muted)]">{formatDuration(hovered.byTask.get(t.id!) ?? 0)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* X axis labels */}
      <div className="flex pl-9 pt-1.5" aria-hidden>
        {buckets.map((b) => (
          <div key={b.from} className="relative h-4 min-w-0 flex-1">
            {b.tick && (
              <span
                className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] leading-4 ${
                  b.isCurrent ? 'font-semibold text-[var(--text)]' : 'text-[var(--muted)]'
                }`}
              >
                {b.tick}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Screen-reader / table alternative to the chart */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>Study time</th>
          </tr>
        </thead>
        <tbody>
          {buckets
            .filter((b) => !b.future)
            .map((b) => (
              <tr key={b.from}>
                <td>{b.title}</td>
                <td>{formatDuration(b.total)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
