import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import { OLD_SEED_IDS, SEED_CARDS, SEED_VERSION } from './seed'
import { pull, push, sb, signOut as authSignOut } from './cloud'
import { buildSummary } from './summary'

const KEY = 'esther-body-workbench-v1'
const T = `${KEY}:t` // ms of the last local edit (or of the copy we adopted)
const U = `${KEY}:uid` // which account this device's data belongs to

const initial = (): AppData => ({
  cards: SEED_CARDS,
  sessions: [],
  meals: {},
  weights: {},
  feelings: {},
  daysPerWeek: 3,
  seedVersion: SEED_VERSION,
})

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = migrate({ ...initial(), seedVersion: 1, ...JSON.parse(raw) })
      // pre-cloud data on 不二's own phone (written before edit-times existed)
      if (!localStorage.getItem(T)) {
        localStorage.setItem(T, String(Date.now()))
        return withFirstWeight(d)
      }
      return d
    }
  } catch {
    /* corrupted storage → start fresh */
  }
  return initial()
}

/** 不二 told me her weight on 2026-10-20 — seed it once into her legacy local data if nothing was logged. */
const withFirstWeight = (d: AppData): AppData =>
  Object.keys(d.weights).length ? d : { ...d, weights: { '2026-10-20': 65 } }

export const hasContent = (d: AppData) => d.sessions.length > 0 || Object.keys(d.weights).length > 0 || Object.keys(d.meals).length > 0

/**
 * Which copy wins when a device meets its account's cloud copy.
 * - local data that belongs to another account is never mixed in
 * - an empty side never overwrites a side with real records
 * - otherwise the most recent edit wins
 */
export function reconcile(args: { uid: string; owner: string | null; local: AppData; localT: number; remote: { data: AppData; updatedAt: number } | null }): 'adopt' | 'push' | 'fresh' {
  const { uid, owner, local, localT, remote } = args
  if (owner && owner !== uid) return remote ? 'adopt' : 'fresh'
  if (!remote) return 'push'
  if (!hasContent(remote.data) && hasContent(local)) return 'push'
  if (!hasContent(local) && hasContent(remote.data)) return 'adopt'
  return remote.updatedAt >= localT ? 'adopt' : 'push'
}

/** Starter videos this person hasn't seen yet. They're offered, never auto-added; saying no archives them. */
export const recommended = (d: AppData) => {
  const have = new Set(d.cards.map((c) => c.id))
  return SEED_CARDS.filter((c) => c.kind === 'video' && !have.has(c.id))
}

/** Retire an older starter library; cards you added yourself are untouched. New starter cards arrive via `recommended`. */
export function migrate(d: AppData): AppData {
  if ((d.seedVersion ?? 1) >= SEED_VERSION) return d
  const fresh = new Set(SEED_CARDS.map((c) => c.id))
  const drop = new Set(OLD_SEED_IDS.filter((id) => !fresh.has(id)))
  const seedById = new Map(SEED_CARDS.map((c) => [c.id, c]))
  const used = new Set(d.sessions.filter((s) => s.done).map((s) => s.cardId))
  const kept = d.cards
    .filter((c) => !drop.has(c.id) || used.has(c.id))
    .map((c) => (drop.has(c.id) ? { ...c, archived: true } : c))
    .map((c) => (c.short || !seedById.get(c.id)?.short ? c : { ...c, short: seedById.get(c.id)!.short }))
  return {
    ...d,
    cards: kept,
    sessions: d.sessions.filter((s) => !drop.has(s.cardId) || s.done),
    seedVersion: SEED_VERSION,
  }
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error'
export interface Cloud {
  user: { id: string; email?: string } | null
  status: SyncStatus
  signOut: () => Promise<void>
}

const failed = (): SyncStatus => (navigator.onLine ? 'error' : 'offline')

export function useData() {
  const [data, setData] = useState<AppData>(load)
  const [user, setUser] = useState<Cloud['user']>(null)
  const [status, setStatus] = useState<SyncStatus>('local')
  const dataRef = useRef(data)
  const dirty = useRef(false)
  dataRef.current = data

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data))
  }, [data])

  const update = useCallback((fn: (d: AppData) => AppData) => {
    dirty.current = true
    localStorage.setItem(T, String(Date.now()))
    setData((d) => fn(d))
  }, [])

  const pushNow = useCallback(async (uid: string, d: AppData) => {
    const at = Date.now()
    await push(uid, d, buildSummary(d), at)
    localStorage.setItem(T, String(at))
    dirty.current = false
  }, [])

  const sync = useCallback(
    async (uid: string) => {
      setStatus('syncing')
      try {
        const remote = await pull(uid)
        const local = dataRef.current
        const verdict = reconcile({ uid, owner: localStorage.getItem(U), local, localT: Number(localStorage.getItem(T) ?? 0), remote })
        localStorage.setItem(U, uid)
        if (verdict === 'adopt') {
          const next = migrate({ ...initial(), seedVersion: 1, ...remote!.data })
          dirty.current = false
          localStorage.setItem(T, String(remote!.updatedAt))
          setData(next)
        } else if (verdict === 'fresh') {
          const next = initial()
          setData(next)
          await pushNow(uid, next)
        } else {
          await pushNow(uid, local)
        }
        setStatus('synced')
      } catch {
        setStatus(failed())
      }
    },
    [pushNow],
  )

  // auth state
  useEffect(() => {
    if (!sb) return
    const toUser = (s: { user: { id: string; email?: string } } | null) => (s ? { id: s.user.id, email: s.user.email } : null)
    sb.auth.getSession().then(({ data }) => setUser(toUser(data.session)))
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setUser((u) => (u?.id === s?.user.id ? u : toUser(s))))
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = user?.id
  // first contact after sign-in / app start
  useEffect(() => {
    if (uid) sync(uid)
    else setStatus('local')
  }, [uid, sync])

  // push local edits (debounced)
  useEffect(() => {
    if (!uid || !dirty.current) return
    setStatus('syncing')
    const t = setTimeout(() => pushNow(uid, data).then(() => setStatus('synced'), () => setStatus(failed())), 1200)
    return () => clearTimeout(t)
  }, [data, uid, pushNow])

  // pick up edits from the other device when coming back to the app / back online
  useEffect(() => {
    if (!uid) return
    const again = () => document.visibilityState === 'visible' && sync(uid)
    document.addEventListener('visibilitychange', again)
    window.addEventListener('online', again)
    return () => {
      document.removeEventListener('visibilitychange', again)
      window.removeEventListener('online', again)
    }
  }, [uid, sync])

  const signOut = useCallback(async () => {
    await authSignOut()
    for (const k of [KEY, T, U]) localStorage.removeItem(k)
    dirty.current = false
    setData(initial())
  }, [])

  const cloud: Cloud = { user, status, signOut }
  return [data, update, cloud] as const
}

export type Update = ReturnType<typeof useData>[1]
