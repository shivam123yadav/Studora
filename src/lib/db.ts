import Dexie, { type EntityTable } from 'dexie'
import type { Session, Task } from './types'

// The database name is an internal identifier, not the app's display name. Don't rename it:
// the browser stores data under this name, so a new name would open an empty database and
// hide everything already saved. (The app was called "Study Timer" before "Studora".)
export const db = new Dexie('study-timer') as Dexie & {
  tasks: EntityTable<Task, 'id'>
  sessions: EntityTable<Session, 'id'>
}

db.version(1).stores({
  // `archived` is a boolean, which IndexedDB can't index, so it's filtered in code
  tasks: '++id, order',
  sessions: '++id, taskId, start, [taskId+start]',
})
