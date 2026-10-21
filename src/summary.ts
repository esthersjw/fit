import type { AppData, Card, Palm } from './types'
import { CATEGORY, FOCUS, cardName } from './types'
import { addDays, diffDays, todayKey, weekStart } from './date'
import { bodyWeight, kcal } from './energy'

/**
 * A compact, agent-friendly snapshot of someone's progress. Written to the cloud on every sync,
 * returned by the `agent_summary` RPC, and used for the Markdown export. Facts only — no targets, no scores.
 */
export interface Summary {
  generated_at: string
  today: string
  this_week: WeekView
  next_week: WeekView
  last_4_weeks: { week_start: string; minutes_done: number; days_trained: number }[]
  weight: { latest?: { date: string; kg: number }; avg_7d?: number; avg_7d_a_week_ago?: number; last_30d: { date: string; kg: number }[] }
  diet_last_7d: { date: string; protein: number; veg: number; carb: number; fat: number; note?: string }[]
  markdown: string
}

interface WeekView {
  week_start: string
  days_planned: number
  days_trained: number
  minutes_planned: number
  minutes_done: number
  kcal_done_estimate: number
  sessions: { date: string; name: string; type: string; focus: string[]; minutes: number; done: boolean; time?: string }[]
}

const isTraining = (c: Card) => c.kind === 'coach' || !['stretch', 'mind'].includes(c.category)

function week(data: AppData, start: string, kg: number): WeekView {
  const cards = new Map(data.cards.map((c) => [c.id, c]))
  const list = data.sessions
    .filter((s) => s.date >= start && s.date < addDays(start, 7) && cards.has(s.cardId))
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  const items = list.map((s) => ({ s, c: cards.get(s.cardId)! }))
  const days = (pred: (x: (typeof items)[number]) => boolean) => new Set(items.filter(pred).map((x) => x.s.date)).size
  return {
    week_start: start,
    days_planned: days((x) => isTraining(x.c)),
    days_trained: days((x) => isTraining(x.c) && x.s.done),
    minutes_planned: items.reduce((a, x) => a + x.c.minutes, 0),
    minutes_done: items.filter((x) => x.s.done).reduce((a, x) => a + x.c.minutes, 0),
    kcal_done_estimate: items.filter((x) => x.s.done).reduce((a, x) => a + kcal(x.c, kg), 0),
    sessions: items.map(({ s, c }) => ({
      date: s.date,
      name: c.kind === 'coach' ? `私教 · ${c.title}` : cardName(c),
      type: c.kind === 'coach' ? '私教' : CATEGORY[c.category].label,
      focus: c.focus.map((f) => FOCUS[f]),
      minutes: c.minutes,
      done: s.done,
      ...(s.time ? { time: s.time } : {}),
    })),
  }
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : undefined)

export function buildSummary(data: AppData, today = todayKey()): Summary {
  const { kg } = bodyWeight(data)
  const ws = weekStart(today)
  const thisWeek = week(data, ws, kg)
  const nextWeek = week(data, addDays(ws, 7), kg)
  const last4 = [3, 2, 1, 0].map((i) => {
    const w = week(data, addDays(ws, -7 * i), kg)
    return { week_start: w.week_start, minutes_done: w.minutes_done, days_trained: w.days_trained }
  })

  const wdays = Object.keys(data.weights).sort()
  const within = (d: string, end: string, n: number) => d <= end && diffDays(end, d) < n
  const latestDay = wdays.at(-1)
  const weight: Summary['weight'] = {
    last_30d: wdays.filter((d) => within(d, today, 30)).map((d) => ({ date: d, kg: data.weights[d] })),
  }
  if (latestDay) {
    weight.latest = { date: latestDay, kg: data.weights[latestDay] }
    weight.avg_7d = avg(wdays.filter((d) => within(d, latestDay, 7)).map((d) => data.weights[d]))
    const ago = addDays(latestDay, -7)
    weight.avg_7d_a_week_ago = avg(wdays.filter((d) => within(d, ago, 7)).map((d) => data.weights[d]))
  }

  const diet = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i))
    .filter((d) => data.meals[d])
    .map((d) => {
      const day = data.meals[d]
      const sum = (k: keyof Palm) => Object.values(day.meals).reduce((a, m) => a + (m?.[k] ?? 0), 0)
      return { date: d, protein: sum('protein'), veg: sum('veg'), carb: sum('carb'), fat: sum('fat'), ...(day.note ? { note: day.note } : {}) }
    })

  const s: Omit<Summary, 'markdown'> = {
    generated_at: new Date().toISOString(),
    today,
    this_week: thisWeek,
    next_week: nextWeek,
    last_4_weeks: last4,
    weight,
    diet_last_7d: diet,
  }
  return { ...s, markdown: toMarkdown(s) }
}

function toMarkdown(s: Omit<Summary, 'markdown'>): string {
  const w = s.this_week
  const lines = [
    `# 身体课表 · ${s.today}`,
    '',
    `## 本周（${w.week_start} 起）`,
    `- 训练 ${w.days_trained} / ${w.days_planned} 天，完成 ${w.minutes_done} / ${w.minutes_planned} 分钟，约 ${w.kcal_done_estimate} kcal（估算）`,
    ...w.sessions.map((x) => `- ${x.done ? '[x]' : '[ ]'} ${x.date}${x.time ? ` ${x.time}` : ''} ${x.name}（${x.type} · ${x.minutes} 分钟）`),
    '',
    `## 下周已排`,
    ...(s.next_week.sessions.length ? s.next_week.sessions.map((x) => `- ${x.date}${x.time ? ` ${x.time}` : ''} ${x.name}（${x.type} · ${x.minutes} 分钟）`) : ['- 还没排']),
    '',
    `## 最近 4 周`,
    ...s.last_4_weeks.map((x) => `- ${x.week_start} 起：${x.days_trained} 天 · ${x.minutes_done} 分钟`),
    '',
    `## 体重`,
    s.weight.latest
      ? `- 最近一次 ${s.weight.latest.kg} kg（${s.weight.latest.date}）· 7 天平均 ${s.weight.avg_7d ?? '—'} kg${s.weight.avg_7d_a_week_ago ? `（一周前 ${s.weight.avg_7d_a_week_ago} kg）` : ''}`
      : '- 还没有记录',
    '',
    `## 最近 7 天饮食（手掌法份数：蛋白质掌 / 蔬菜拳 / 主食捧 / 油脂拇指）`,
    ...(s.diet_last_7d.length ? s.diet_last_7d.map((d) => `- ${d.date}：${d.protein} / ${d.veg} / ${d.carb} / ${d.fat}${d.note ? ` · ${d.note}` : ''}`) : ['- 还没有记录']),
    '',
    '> 这些是事实记录，不是考核。大卡为 MET 公式估算。',
  ]
  return lines.join('\n')
}
