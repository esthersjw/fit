import { describe, expect, it } from 'vitest'
import { autoSchedule, gentleDay, loads, swapSession } from './scheduler'
import { SEED_CARDS } from './seed'
import { diffDays, weekDates } from './date'
import type { AppData, Session } from './types'
import { cardName } from './types'
import { migrate, recommended } from './store'
import { OLD_SEED_IDS } from './seed'

const week = weekDates('2026-10-19') // Mon..Sun
const byId = new Map(SEED_CARDS.map((c) => [c.id, c]))
const seeded = (n: number) => {
  let x = n
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280)
}

function check(sessions: Session[]) {
  for (const a of sessions)
    for (const b of sessions) {
      if (Math.abs(diffDays(a.date, b.date)) !== 1) continue
      const ca = byId.get(a.cardId)!
      const cb = byId.get(b.cardId)!
      const overlap = loads(ca).filter((f) => loads(cb).includes(f))
      expect(overlap, `${ca.title} @${a.date} vs ${cb.title} @${b.date}`).toEqual([])
      expect(ca.intensity === 3 && cb.intensity === 3).toBe(false)
    }
}

describe('autoSchedule', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const days of [3, 4, 5]) {
      it(`seed ${seed}, ${days} days/week respects rules`, () => {
        const out = autoSchedule({ cards: SEED_CARDS, sessions: [], week, today: week[0], daysPerWeek: days, rng: seeded(seed) })
        const isMind = (s: Session) => byId.get(s.cardId)!.category === 'mind'
        const trainDays = new Set(out.filter((s) => !isMind(s)).map((s) => s.date))
        expect(trainDays.size).toBe(days)
        // meditation: only on rest days, at most 2 a week
        const mindDays = out.filter(isMind).map((s) => s.date)
        expect(mindDays.length).toBeLessThanOrEqual(2)
        for (const d of mindDays) expect(trainDays.has(d)).toBe(false)
        // 有氧/拳击 picked automatically are always ≥ 20 min
        for (const s of out) {
          const c = byId.get(s.cardId)!
          if (c.category === 'aerobic' || c.category === 'boxing') expect(c.minutes).toBeGreaterThanOrEqual(20)
        }
        check(out)
        // main (non-stretch) cards don't repeat in a week, and each day lands 25–60 min
        const main = out.filter((s) => !['stretch', 'mind'].includes(byId.get(s.cardId)!.category))
        // (with 5 days and a 13-card starter library a forced repeat is allowed)
        if (days <= 4) expect(new Set(main.map((s) => s.cardId)).size).toBe(main.length)
        for (const d of trainDays) {
          const mins = out.filter((s) => s.date === d).reduce((a, s) => a + byId.get(s.cardId)!.minutes, 0)
          expect(mins).toBeGreaterThanOrEqual(25)
          expect(mins).toBeLessThanOrEqual(70)
        }
      })
    }
  }

  it('keeps locked coach class and past days, only plans from today', () => {
    const coach: Session = { id: 'c', cardId: 'coach-sample', date: week[3], done: false, locked: true, time: '19:00' }
    const past: Session = { id: 'p', cardId: 'BV1AE4ZecEfy', date: week[0], done: true, locked: false }
    const out = autoSchedule({ cards: SEED_CARDS, sessions: [coach, past], week, today: week[1], daysPerWeek: 4, rng: seeded(3) })
    expect(out).toContainEqual(coach)
    expect(out).toContainEqual(past)
    expect(out.filter((s) => s.date === week[0])).toHaveLength(1)
    expect(new Set(out.filter((s) => byId.get(s.cardId)!.category !== 'mind').map((s) => s.date)).size).toBe(4)
    // coach class is full-body strength → no strength neighbours
    check(out)
  })

  it('re-running replaces unlocked plan instead of stacking', () => {
    const a = autoSchedule({ cards: SEED_CARDS, sessions: [], week, today: week[0], daysPerWeek: 3, rng: seeded(1) })
    const b = autoSchedule({ cards: SEED_CARDS, sessions: a, week, today: week[0], daysPerWeek: 3, rng: seeded(2) })
    expect(new Set(b.filter((s) => byId.get(s.cardId)!.category !== 'mind').map((s) => s.date)).size).toBe(3)
    expect(b.filter((s) => byId.get(s.cardId)!.category === 'mind').length).toBeLessThanOrEqual(2)
  })
})

describe('rest days', () => {
  it('never plans on a day marked tired', () => {
    for (const seed of [1, 2, 3, 4]) {
      const out = autoSchedule({ cards: SEED_CARDS, sessions: [], week, today: week[0], daysPerWeek: 5, restDays: [week[0], week[1]], rng: seeded(seed) })
      expect(out.some((s) => s.date === week[0] || s.date === week[1])).toBe(false)
    }
  })
})

describe('swap & gentle', () => {
  it('swap changes the card and keeps the slot', () => {
    const s: Session = { id: 'x', cardId: 'BV1ga411C76U', date: week[2], done: false, locked: false }
    const out = swapSession(SEED_CARDS, [s], 'x', seeded(4))
    expect(out[0].cardId).not.toBe('BV1ga411C76U')
    expect(out[0].date).toBe(week[2])
    expect(byId.get(out[0].cardId)!.category).toBe('aerobic')
  })

  it('tired day swaps to one gentle card but keeps pinned ones', () => {
    const coach: Session = { id: 'c', cardId: 'coach-sample', date: week[2], done: false, locked: true }
    const hiit: Session = { id: 'h', cardId: 'BV1HcpueCEUE', date: week[2], done: false, locked: false }
    const out = gentleDay(SEED_CARDS, [coach, hiit], week[2], seeded(1))
    expect(out).toContainEqual(coach)
    expect(out.find((s) => s.id === 'h')).toBeUndefined()
    const added = out.filter((s) => s.id !== 'c')
    expect(added).toHaveLength(1)
    expect(byId.get(added[0].cardId)!.intensity).toBe(1)
  })
})

describe('starter library v2', () => {
  it('has no 有氧/拳击 under 20 minutes', () => {
    for (const c of SEED_CARDS) if (c.category === 'aerobic' || c.category === 'boxing') expect(c.minutes).toBeGreaterThanOrEqual(20)
  })

  it('migrates old data: retires old starter cards, keeps own cards and done history', () => {
    const mine = { ...SEED_CARDS[0], id: 'my-own', title: '我自己加的' }
    const old: AppData = {
      cards: [{ ...SEED_CARDS[0], id: 'BV1Pa411v7vg' }, mine],
      sessions: [
        { id: 'a', cardId: 'BV1Pa411v7vg', date: week[0], done: true, locked: false },
        { id: 'b', cardId: 'BV1Pa411v7vg', date: week[3], done: false, locked: false },
      ],
      meals: {}, weights: {}, feelings: {}, daysPerWeek: 3,
    }
    const out = migrate(old)
    expect(OLD_SEED_IDS).toContain('BV1Pa411v7vg')
    // has done history → kept but archived, so past minutes still count
    expect(out.cards.find((c) => c.id === 'BV1Pa411v7vg')?.archived).toBe(true)
    expect(out.cards.find((c) => c.id === 'my-own')).toBeDefined()
    // old starter + own card; the current starter videos are offered, not pushed in
    expect(out.cards.map((c) => c.id)).toEqual(['BV1Pa411v7vg', 'my-own'])
    expect(recommended(out).length).toBe(SEED_CARDS.filter((c) => c.kind === 'video').length)
    expect(out.sessions.map((s) => s.id)).toEqual(['a'])
    expect(migrate(out)).toBe(out)
  })
})

describe('timetable names', () => {
  it('every starter video has a short name that fits a block', () => {
    for (const c of SEED_CARDS) if (c.kind === 'video') expect(c.short && c.short.length <= 12).toBeTruthy()
  })
  it('falls back to a trimmed title for your own cards', () => {
    const c = { ...SEED_CARDS[0], short: undefined, title: '【跟练】30分钟 晨跑热身｜超简单' }
    expect(cardName(c)).toBe('跟练')
    expect(cardName({ ...c, title: '晨跑热身 20分钟｜超简单' })).toBe('晨跑热身')
  })
  it('v2 data keeps everything, gets short names, and is offered the new cards', () => {
    const v2: AppData = { cards: SEED_CARDS.slice(0, 35).map((c) => ({ ...c, short: undefined })), sessions: [], meals: {}, weights: {}, feelings: {}, daysPerWeek: 3, seedVersion: 2 }
    const out = migrate(v2)
    expect(out.cards.length).toBe(35)
    expect(recommended(out).map((c) => c.id)).toEqual(SEED_CARDS.slice(35).filter((c) => c.kind === 'video').map((c) => c.id))
    expect(out.cards[0].short).toBe(SEED_CARDS[0].short)
  })
})
