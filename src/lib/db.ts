// IndexedDB: a key/value snapshot of crew data (so the app opens with zero
// signal) and the outbox of rows waiting to be sent.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type Table = 'checkins' | 'messages' | 'members' | 'crews' | 'prefs'

export interface OutItem {
  key: string // `${table}:${id}` so a newer write replaces an older unsent one
  table: Table
  op: 'upsert' | 'update'
  id: string
  row: Record<string, unknown>
  blob?: Blob // photo waiting to upload before its message row
  createdAt: number
  v: number // changes on every put; lets the sync loop spot a newer write mid-send
}

interface Schema extends DBSchema {
  kv: { key: string; value: unknown }
  outbox: { key: string; value: OutItem }
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null
const db = () =>
  (dbp ??= openDB<Schema>('crew-finder', 1, {
    upgrade(d) {
      d.createObjectStore('kv')
      d.createObjectStore('outbox', { keyPath: 'key' })
    },
  }))

// Private browsing or blocked storage: keep working, just without persistence.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.warn('IndexedDB unavailable', e)
    return fallback
  }
}

export const kv = {
  get: <T>(k: string) => safe(async () => (await (await db()).get('kv', k)) as T | undefined, undefined),
  set: (k: string, v: unknown) => safe(async () => void (await (await db()).put('kv', v, k)), undefined),
  clear: () => safe(async () => void (await (await db()).clear('kv')), undefined),
}

export const outbox = {
  all: () => safe(async () => (await db()).getAll('outbox'), [] as OutItem[]),
  get: (key: string) => safe(async () => (await db()).get('outbox', key), undefined),
  put: (item: OutItem) => safe(async () => void (await (await db()).put('outbox', item)), undefined),
  del: (key: string) => safe(async () => void (await (await db()).delete('outbox', key)), undefined),
  clear: () => safe(async () => void (await (await db()).clear('outbox')), undefined),
}
