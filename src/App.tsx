import { useEffect, useState, type ComponentType } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { BottomNav, type Tab } from './components/BottomNav'
import { TitleSync } from './components/TitleSync'
import { Today } from './screens/Today'
import { Stats } from './screens/Stats'
import { Settings } from './screens/Settings'

const SCREENS: Record<Tab, ComponentType> = {
  today: Today,
  stats: Stats,
  settings: Settings,
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const Screen = SCREENS[tab]

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  return (
    // "user" = skip transform animations for people who turned on reduced motion in their OS
    <MotionConfig reducedMotion="user">
      <TitleSync />
      <main
        className="mx-auto max-w-md px-4 pt-6"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav tab={tab} onChange={setTab} />
    </MotionConfig>
  )
}
