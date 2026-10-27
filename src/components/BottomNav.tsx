import { BarChart3, Settings, Timer } from 'lucide-react'

export type Tab = 'today' | 'stats' | 'settings'

const ITEMS: { id: Tab; label: string; Icon: typeof Timer }[] = [
  { id: 'today', label: 'Today', Icon: Timer },
  { id: 'stats', label: 'Stats', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md">
        {ITEMS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                active ? 'text-[var(--color-accent)]' : 'text-[var(--muted)]'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
