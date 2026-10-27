import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

function apply(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

function read(): Theme {
  try {
    const t = localStorage.getItem('theme')
    if (t === 'light' || t === 'dark' || t === 'system') return t
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read)

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem('theme', t)
    } catch {
      /* storage unavailable */
    }
    apply(t)
  }, [])

  // Follow OS changes while on "system"
  useEffect(() => {
    if (theme !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return { theme, setTheme }
}
