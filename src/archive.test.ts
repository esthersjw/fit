import { describe, expect, it } from 'vitest'
import { autoSchedule } from './scheduler'
import { OLD_SEED_IDS, SEED_CARDS, SEED_VERSION } from './seed'
import { migrate, recommended } from './store'
import { buildSummary } from './summary'
import { weekDates } from './date'
import type { AppData } from './types'

const week = weekDates('2026-10-19')

describe('personal library: removing a starter video', () => {
  const gone = SEED_CARDS[0]
  const data: AppData = {
    cards: SEED_CARDS.map((c) => (c.id === gone.id ? { ...c, archived: true } : c)),
    sessions: [{ id: 's1', cardId: gone.id, date: '2026-10-19', done: true, locked: false }],
    meals: {},
    weights: { '2026-10-19': 65 },
    feelings: {},
    daysPerWeek: 3,
    seedVersion: SEED_VERSION,
  }

  it('is never auto-scheduled again', () => {
    for (let i = 0; i < 20; i++) {
      const out = autoSchedule({ cards: data.cards, sessions: data.sessions, week, today: '2026-10-20', daysPerWeek: 5 })
      expect(out.filter((s) => !s.done).some((s) => s.cardId === gone.id)).toBe(false)
    }
  })

  it('keeps finished sessions counting in the summary', () => {
    const s = buildSummary(data, '2026-10-20')
    expect(s.this_week.minutes_done).toBe(gone.minutes)
  })

  it('does not come back when the starter library is upgraded', () => {
    const out = migrate({ ...data, seedVersion: SEED_VERSION - 1 })
    expect(out.cards.filter((c) => c.id === gone.id)).toEqual([expect.objectContaining({ archived: true })])
  })
})

describe('不二推荐', () => {
  const base: AppData = { cards: SEED_CARDS.slice(0, 50), sessions: [], meals: {}, weights: {}, feelings: {}, daysPerWeek: 3, seedVersion: SEED_VERSION }
  it('offers starter videos you have never had', () => {
    expect(recommended(base).map((c) => c.id)).toEqual(SEED_CARDS.slice(50).filter((c) => c.kind === 'video').map((c) => c.id))
  })
  it('a fresh library has nothing to recommend', () => {
    expect(recommended({ ...base, cards: SEED_CARDS })).toEqual([])
  })
  it('saying no (or deleting) removes it from recommendations for good', () => {
    const no = SEED_CARDS[52]
    const d = { ...base, cards: [...base.cards, { ...no, archived: true }] }
    expect(recommended(d).some((c) => c.id === no.id)).toBe(false)
  })
})

describe('migrate', () => {
  it('archives (not drops) a retired starter card that has history', () => {
    const old = OLD_SEED_IDS.find((id) => !SEED_CARDS.some((c) => c.id === id))!
    const v1: AppData = {
      cards: [{ id: old, kind: 'video', title: 'old', category: 'aerobic', focus: ['full'], intensity: 2, minutes: 10, stars: 2 }],
      sessions: [{ id: 's', cardId: old, date: '2026-10-01', done: true, locked: false }],
      meals: {}, weights: {}, feelings: {}, daysPerWeek: 3, seedVersion: 1,
    }
    const out = migrate(v1)
    expect(out.cards.find((c) => c.id === old)?.archived).toBe(true)
    expect(out.sessions).toHaveLength(1)
  })
})
