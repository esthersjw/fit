import { describe, expect, it } from 'vitest'
import { parseBackup } from './backup'
import { SEED_VERSION } from './seed'
import type { AppData } from './types'

const sample: AppData = {
  cards: [{ id: 'mine-1', kind: 'video', bvid: 'BV1mine12345', title: '我的课', owner: 'me', minutes: 30, cover: '', category: 'strength', focus: ['legs'], intensity: 2, stars: 2 }],
  sessions: [{ id: 's1', cardId: 'mine-1', date: '2026-11-02', done: true, locked: false }],
  meals: { '2026-11-02': { meals: { lunch: { protein: 1, veg: 2, carb: 1, fat: 0 } } } },
  weights: { '2026-11-02': 64.5 },
  feelings: {},
  daysPerWeek: 4,
  seedVersion: SEED_VERSION,
}

describe('parseBackup (local-first restore)', () => {
  it('reads a wrapped app export back', () => {
    const out = parseBackup(JSON.stringify({ exported_at: '2026-11-02T00:00:00Z', data: sample }))
    expect(out.cards.map((c) => c.id)).toEqual(['mine-1'])
    expect(out.sessions[0].done).toBe(true)
    expect(out.weights['2026-11-02']).toBe(64.5)
    expect(out.daysPerWeek).toBe(4)
  })

  it('reads a bare data object (e.g. a cloud copy)', () => {
    const out = parseBackup(JSON.stringify(sample))
    expect(out.cards).toHaveLength(1)
  })

  it('drops sessions without a cardId/date instead of crashing', () => {
    const dirty = { ...sample, sessions: [...sample.sessions, { id: 'bad', date: '2026-11-03' }] }
    const out = parseBackup(JSON.stringify(dirty))
    expect(out.sessions.map((s) => s.id)).toEqual(['s1'])
  })

  it('clamps a nonsense daysPerWeek into 1..6', () => {
    const out = parseBackup(JSON.stringify({ ...sample, daysPerWeek: 99 }))
    expect(out.daysPerWeek).toBe(6)
  })

  it('rejects junk that is not a backup', () => {
    expect(() => parseBackup('not json')).toThrow()
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow()
    expect(() => parseBackup(JSON.stringify({ cards: [], sessions: [], weights: 'nope' }))).not.toThrow()
  })
})
