import type { Card, Category, Focus, Session } from './types'
import { diffDays } from './date'

/**
 * Rules (kept deliberately simple and explainable):
 * 1. Same muscle group needs ~48h: a card that "loads" legs/upper/core can't sit next to a day loading the same group.
 * 2. Two "暴汗" (intensity 3) days are never back-to-back.
 * 3. Coach classes / manually placed / done sessions are anchors and never move.
 * 4. Score = how much you like it + how long since you last did it + category variety + strength quota (≥2/week) + a bit of luck.
 */

const ALL: Focus[] = ['legs', 'upper', 'core']
const GENTLE: Category[] = ['stretch', 'mind']
const CARDIO: Category[] = ['aerobic', 'boxing']
export const MIN_CARDIO = 20

/** Muscle groups this card actually loads (cardio-ish moves at low/mid intensity don't count). */
export function loads(card: Card): Focus[] {
  const strengthy = card.category === 'strength' || card.category === 'pilates' || card.kind === 'coach' || card.intensity === 3
  if (!strengthy || card.category === 'stretch' || card.category === 'mind') return []
  return card.focus.includes('full') ? ALL : card.focus.filter((f) => f !== 'full')
}

export const isStrength = (c: Card) => loads(c).length > 0

let seq = 0
export const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

interface Ctx {
  cards: Map<string, Card>
  sessions: Session[]
  rng: () => number
}

const cardsOn = (ctx: Ctx, date: string) =>
  ctx.sessions.filter((s) => s.date === date).map((s) => ctx.cards.get(s.cardId)).filter(Boolean) as Card[]

/** Can `card` go on `date` given what's already around it? */
export function fits(ctx: Ctx, card: Card, date: string, ignoreId?: string): boolean {
  const near = ctx.sessions
    .filter((s) => s.id !== ignoreId && Math.abs(diffDays(s.date, date)) === 1)
    .map((s) => ctx.cards.get(s.cardId))
    .filter(Boolean) as Card[]
  const mine = loads(card)
  for (const c of near) {
    if (mine.some((f) => loads(c).includes(f))) return false
    if (card.intensity === 3 && c.intensity === 3) return false
  }
  return true
}

function score(ctx: Ctx, card: Card, date: string, week: string[]): number {
  const used = ctx.sessions.filter((s) => s.cardId === card.id && s.date <= date)
  const last = used.reduce<string | null>((a, s) => (!a || s.date > a ? s.date : a), null)
  const since = last ? diffDays(date, last) : 14
  const weekCards = ctx.sessions.filter((s) => week.includes(s.date)).map((s) => ctx.cards.get(s.cardId)!).filter(Boolean)
  const sameCat = weekCards.filter((c) => c.category === card.category).length
  const sameCard = weekCards.filter((c) => c.id === card.id).length
  const strengthCount = new Set(
    ctx.sessions.filter((s) => week.includes(s.date) && isStrength(ctx.cards.get(s.cardId)!)).map((s) => s.date),
  ).size
  return (
    card.stars * 1.5 +
    (Math.min(since, 14) / 14) * 3 -
    sameCat * 1.6 -
    sameCard * 6 +
    (strengthCount < 2 && isStrength(card) ? 2.2 : 0) +
    ctx.rng() * 1.5
  )
}

function best(ctx: Ctx, pool: Card[], date: string, week: string[]): Card | undefined {
  let top: Card | undefined
  let topScore = -Infinity
  for (const c of pool) {
    if (!fits(ctx, c, date)) continue
    const s = score(ctx, c, date, week)
    if (s > topScore) {
      topScore = s
      top = c
    }
  }
  return top
}

/** Spread `need` new training days across `free` days, keeping distance from `taken` days. */
function pickDays(free: string[], taken: string[], need: number, rng: () => number): string[] {
  const chosen: string[] = []
  const pool = [...free]
  while (chosen.length < need && pool.length) {
    const all = [...taken, ...chosen]
    let bestDay = pool[0]
    let bestGap = -1
    for (const d of pool) {
      const gap = all.length ? Math.min(...all.map((t) => Math.abs(diffDays(d, t)))) : 3
      const g = gap + rng() * 0.5
      if (g > bestGap) {
        bestGap = g
        bestDay = d
      }
    }
    chosen.push(bestDay)
    pool.splice(pool.indexOf(bestDay), 1)
  }
  return chosen.sort()
}

export interface AutoInput {
  cards: Card[]
  sessions: Session[]
  week: string[]
  today: string
  daysPerWeek: number
  /** days that must stay free (e.g. marked 有点累) */
  restDays?: string[]
  rng?: () => number
}

/** Re-plan the not-yet-happened, not-pinned part of a week. Returns the full new session list. */
export function autoSchedule({ cards, sessions, week, today, daysPerWeek, restDays = [], rng = Math.random }: AutoInput): Session[] {
  const keep = sessions.filter((s) => !week.includes(s.date) || s.date < today || s.locked || s.done)
  const ctx: Ctx = { cards: new Map(cards.map((c) => [c.id, c])), sessions: keep, rng }
  const videos = cards.filter((c) => c.kind === 'video' && !c.archived)
  // 有氧/拳击 under 20 min are never auto-picked (can still be added by hand)
  const main = videos.filter((c) => !GENTLE.includes(c.category) && !(CARDIO.includes(c.category) && c.minutes < MIN_CARDIO))
  const stretch = videos.filter((c) => c.category === 'stretch')
  const mind = videos.filter((c) => c.category === 'mind')

  const trainedDays = week.filter((d) => cardsOn(ctx, d).some((c) => !GENTLE.includes(c.category) || c.kind === 'coach'))
  const free = week.filter((d) => d >= today && !trainedDays.includes(d) && !restDays.includes(d))
  const days = pickDays(free, trainedDays, Math.max(0, daysPerWeek - trainedDays.length), rng)

  for (const date of days) {
    let total = 0
    const picked = new Set<string>()
    const add = (c: Card) => {
      ctx.sessions = [...ctx.sessions, { id: uid(), cardId: c.id, date, done: false, locked: false }]
      total += c.minutes
      picked.add(c.id)
    }
    // main block: aim for ~30 min, at most 3 pieces
    while (total < 28 && picked.size < 3) {
      const pool = main.filter((c) => !picked.has(c.id) && total + c.minutes <= 55)
      const usedThisWeek = new Set(ctx.sessions.filter((s) => week.includes(s.date)).map((s) => s.cardId))
      const c = best(ctx, pool.filter((x) => !usedThisWeek.has(x.id)), date, week) ?? best(ctx, pool, date, week)
      if (!c) break
      add(c)
    }
    // cool-down
    const cool = best(ctx, stretch.filter((c) => total + c.minutes <= 65), date, week)
    if (cool && total > 0) add(cool)
  }

  // rest days: a short meditation on up to 2 of them (spread out), so rest still has a little ritual
  const restFree = free.filter((d) => !days.includes(d) && !cardsOn(ctx, d).length)
  const hasMind = week.filter((d) => cardsOn(ctx, d).some((c) => c.category === 'mind')).length
  for (const date of pickDays(restFree, [], Math.max(0, 2 - hasMind), rng)) {
    const m = best(ctx, mind, date, week)
    if (m) ctx.sessions = [...ctx.sessions, { id: uid(), cardId: m.id, date, done: false, locked: false }]
  }
  return ctx.sessions
}

/** 🎲 Swap one session for another card that fits the same slot (prefer same category). */
export function swapSession(cards: Card[], sessions: Session[], id: string, rng = Math.random): Session[] {
  const s = sessions.find((x) => x.id === id)
  if (!s) return sessions
  const ctx: Ctx = { cards: new Map(cards.map((c) => [c.id, c])), sessions: sessions.filter((x) => x.id !== id), rng }
  const cur = ctx.cards.get(s.cardId)
  const onDay = new Set(cardsOn(ctx, s.date).map((c) => c.id))
  const pool = cards.filter((c) => c.kind === 'video' && !c.archived && c.id !== s.cardId && !onDay.has(c.id))
  const same = pool.filter((c) => c.category === cur?.category)
  const week = [s.date]
  const next = best(ctx, same, s.date, week) ?? best(ctx, pool, s.date, week)
  if (!next) return sessions
  return sessions.map((x) => (x.id === id ? { ...x, cardId: next.id, done: false } : x))
}

/** 有点累: replace the day's unpinned, undone sessions with one gentle card. */
export function gentleDay(cards: Card[], sessions: Session[], date: string, rng = Math.random): Session[] {
  const rest = sessions.filter((s) => !(s.date === date && !s.locked && !s.done))
  const ctx: Ctx = { cards: new Map(cards.map((c) => [c.id, c])), sessions: rest, rng }
  const gentle = cards.filter((c) => c.kind === 'video' && !c.archived && (GENTLE.includes(c.category) || (c.category === 'pilates' && c.intensity === 1)))
  const pick = best(ctx, gentle, date, [date])
  return pick ? [...rest, { id: uid(), cardId: pick.id, date, done: false, locked: true }] : rest
}
