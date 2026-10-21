import { useState } from 'react'
import type { AppData, MealKey, Palm } from './types'
import type { Update } from './store'
import { addDays, md, todayKey, weekdayLabel } from './date'

const MEALS: [MealKey, string][] = [
  ['breakfast', '早餐'],
  ['lunch', '午餐'],
  ['dinner', '晚餐'],
  ['snack', '加餐'],
]

const PARTS: { k: keyof Palm; icon: string; label: string; unit: string; per: number }[] = [
  { k: 'protein', icon: '🤚', label: '蛋白质', unit: '掌', per: 1 },
  { k: 'veg', icon: '🥬', label: '蔬菜', unit: '拳', per: 1 },
  { k: 'carb', icon: '🍚', label: '主食', unit: '捧', per: 1 },
  { k: 'fat', icon: '👍', label: '油脂', unit: '拇指', per: 1 },
]

const EMPTY: Palm = { protein: 0, veg: 0, carb: 0, fat: 0 }

export function Diet({ data, update }: { data: AppData; update: Update }) {
  const today = todayKey()
  const [date, setDate] = useState(today)
  const day = data.meals[date] ?? { meals: {} }

  const setPart = (meal: MealKey, k: keyof Palm, delta: number) =>
    update((d) => {
      const cur = d.meals[date] ?? { meals: {} }
      const m = { ...EMPTY, ...cur.meals[meal] }
      m[k] = Math.max(0, Math.round((m[k] + delta) * 2) / 2)
      return { ...d, meals: { ...d.meals, [date]: { ...cur, meals: { ...cur.meals, [meal]: m } } } }
    })

  const setNote = (note: string) => update((d) => ({ ...d, meals: { ...d.meals, [date]: { ...(d.meals[date] ?? { meals: {} }), note } } }))

  const eaten = MEALS.filter(([k]) => {
    const m = day.meals[k]
    return m && Object.values(m).some((v) => v > 0)
  }).length
  const total = (k: keyof Palm) => MEALS.reduce((a, [m]) => a + (day.meals[m]?.[k] ?? 0), 0)

  return (
    <div className="page">
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="前一天">‹</button>
        <div className="week-title">
          <span className="hand-label">{date === today ? 'today' : 'that day'}</span>
          <strong>{weekdayLabel(date)} {md(date)}</strong>
        </div>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="后一天">›</button>
      </div>

      <div className="palm-guide">
        <span className="hand-label">palm method</span>
        <p>不用算卡路里，用自己的手估一估。<b>每顿正餐参考</b>：🤚 1 掌蛋白质 · 🥬 1–2 拳蔬菜 · 🍚 1 捧主食 · 👍 1 拇指油脂。</p>
      </div>

      <div className="day-total">
        {PARTS.map((p) => {
          const ref = p.per * Math.max(eaten, 1) * (p.k === 'veg' ? 1.5 : 1)
          return (
            <div key={p.k} className="total-cell">
              <span className="total-icon">{p.icon}</span>
              <span className="total-num">{total(p.k)}</span>
              <span className="total-label">{p.label}<small>{p.unit}</small></span>
              <div className="dots">
                <i style={{ width: `${Math.min(100, (total(p.k) / ref) * 100)}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="meals">
        {MEALS.map(([k, label]) => {
          const m = { ...EMPTY, ...day.meals[k] }
          return (
            <section key={k} className="meal">
              <h3 className="meal-title">{label}</h3>
              <div className="meal-parts">
                {PARTS.map((p) => (
                  <div key={p.k} className="counter">
                    <span className="counter-label">{p.icon} {p.label}</span>
                    <div className="counter-ctl">
                      <button onClick={() => setPart(k, p.k, -0.5)} disabled={!m[p.k]} aria-label="减">－</button>
                      <b>{m[p.k]}</b>
                      <button onClick={() => setPart(k, p.k, 0.5)} aria-label="加">＋</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <label className="field">
        <span>今天吃了啥（随手记）</span>
        <textarea className="app-input" rows={2} value={day.note ?? ''} onChange={(e) => setNote(e.target.value)} placeholder="比如：中午和朋友吃了火锅，很开心" />
      </label>
      <p className="foot-note">记录只是看见，不是打分 ✿</p>
    </div>
  )
}
