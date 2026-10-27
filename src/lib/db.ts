import Dexie, { type EntityTable } from 'dexie'
import type { Session, Task } from './types'

export const db = new Dexie('study-timer') as Dexie & {
  tasks: EntityTable<Task, 'id'>
  sessions: EntityTable<Session, 'id'>
}

db.version(1).stores({
  // `archived` is a boolean, which IndexedDB can't index, so it's filtered in code
  tasks: '++id, order',
  sessions: '++id, taskId, start, [taskId+start]',
})
