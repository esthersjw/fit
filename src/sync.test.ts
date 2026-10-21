import { describe, expect, it } from 'vitest'
import { reconcile } from './store'
import { buildSummary } from './summary'
import { SEED_CARDS } from './seed'
import type { AppData } from './types'

const empty = (): AppData => ({ cards: SEED_CARDS, sessions: [], meals: {}, weights: {}, feelings: {}, daysPerWeek: 3, seedVersion: 3 })
const withWeight = (): AppData => ({ ...empty(), weights: { '2026-10-20': 65 } })

describe('reconcile (device ↔ cloud)', () => {
  const base = { uid: 'me', owner: 'me' as string | null }
  it('first sign-in uploads this device', () => {
    expect(reconcile({ ...base, owner: null, local: withWeight(), localT: 5, remote: null })).toBe('push')
  })
  it("never mixes in another account's local data", () => {
    expect(reconcile({ ...base, owner: 'someone-else', local: withWeight(), localT: 9e12, remote: { data: empty(), updatedAt: 1 } })).toBe('adopt')
    expect(reconcile({ ...base, owner: 'someone-else', local: withWeight(), localT: 9e12, remote: null })).toBe('fresh')
  })
  it('an empty side never wipes real records', () => {
    expect(reconcile({ ...base, local: withWeight(), localT: 1, remote: { data: empty(), updatedAt: 9e12 } })).toBe('push')
    expect(reconcile({ ...base, local: empty(), localT: 9e12, remote: { data: withWeight(), updatedAt: 1 } })).toBe('adopt')
  })
  it('otherwise the newest edit wins', () => {
    expect(reconcile({ ...base, local: withWeight(), localT: 10, remote: { data: withWeight(), updatedAt: 20 } })).toBe('adopt')
    expect(reconcile({ ...base, local: withWeight(), localT: 30, remote: { data: withWeight(), updatedAt: 20 } })).toBe('push')
  })
})

describe('agent summary', () => {
  it('reports the week, weight trend and diet as plain facts', () => {
    const d: AppData = {
      ...empty(),
      sessions: [
        { id: 'a', cardId: 'BV1sA411Q7R3', date: '2026-10-19', done: true, locked: false },
        { id: 'b', cardId: 'BV1tv4y1371g', date: '2026-10-20', done: false, locked: false },
        { id: 'c', cardId: 'BV1Ea41187bp', date: '2026-10-27', done: false, locked: false },
      ],
      weights: { '2026-10-13': 66, '2026-10-20': 65 },
      meals: { '2026-10-20': { meals: { lunch: { protein: 1, veg: 2, carb: 1, fat: 1 }, dinner: { protein: 1, veg: 1, carb: 0, fat: 1 } } } },
    }
    const s = buildSummary(d, '2026-10-20')
    expect(s.this_week.week_start).toBe('2026-10-19')
    expect(s.this_week.days_planned).toBe(1) // 阴瑜伽 is stretch, not a training day
    expect(s.this_week.days_trained).toBe(1)
    expect(s.this_week.minutes_done).toBe(31)
    expect(s.this_week.kcal_done_estimate).toBeGreaterThan(200)
    expect(s.next_week.sessions[0].name).toBe('周六野·拳击操')
    expect(s.weight.latest).toEqual({ date: '2026-10-20', kg: 65 })
    expect(s.weight.avg_7d).toBe(65)
    expect(s.weight.avg_7d_a_week_ago).toBe(66)
    expect(s.diet_last_7d).toEqual([{ date: '2026-10-20', protein: 2, veg: 3, carb: 1, fat: 2 }])
    expect(s.markdown).toContain('[x] 2026-10-19 周六野·站立有氧')
    expect(s.markdown).not.toMatch(/目标|扣分|超标/)
  })
})
