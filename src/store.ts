import { useCallback, useEffect, useState } from 'react'
import type { AppData } from './types'
import { OLD_SEED_IDS, SEED_CARDS, SEED_VERSION } from './seed'

const KEY = 'esther-body-workbench-v1'

const initial = (): AppData => ({
  cards: SEED_CARDS,
  sessions: [],
  meals: {},
  weights: {},
  feelings: {},
  daysPerWeek: 3,
  busyDays: [],
  seedVersion: SEED_VERSION,
})

/** Everything lives in this device's localStorage. Backup & move happen via JSON export/import. */
function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate({ ...initial(), seedVersion: 1, ...JSON.parse(raw) })
  } catch {
    /* corrupted storage → start fresh */
  }
  return initial()
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

export function useData() {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data))
  }, [data])

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])

  return [data, update] as const
}

export type Update = ReturnType<typeof useData>[1]
