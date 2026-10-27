export interface Task {
  id?: number
  name: string
  /** Hex colour used for the card accent and charts */
  color: string
  /** Daily target. The same target repeats every day. */
  dailyTargetMinutes: number
  /** Archived tasks are hidden from Today but keep their history for stats */
  archived: boolean
  /** Manual ordering on the Today screen */
  order: number
  createdAt: number
}

export interface Session {
  id?: number
  taskId: number
  /** Epoch ms */
  start: number
  /** Epoch ms, or null while the session is running */
  end: number | null
}
