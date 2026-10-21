import { useState } from 'react'
import type { AppData } from './types'
import type { Update } from './store'
import { addDays, diffDays, md, todayKey, weekStart } from './date'

/** 7-day trailing average for each day that has (or follows) a weigh-in. */
function trend(weights: Record<string, number>) {
  const days = Object.keys(weights).sort()
  return days.map((d) => {
    const win = days.filter((x) => x <= d && diffDays(d, x) < 7)
    return { d, kg: weights[d], avg: win.reduce((a, x) => a + weights[x], 0) / win.length }
  })
}

export function Progress({ data, update }: { data: AppData; update: Update }) {
  const today = todayKey()
  const [kg, setKg] = useState(data.weights[today]?.toString() ?? '')
  const pts = trend(data.weights).filter((p) => diffDays(today, p.d) < 60)

  const save = () => {
    const n = Number(kg)
    if (!n || n < 20 || n > 300) return
    update((d) => ({ ...d, weights: { ...d.weights, [today]: n } }))
  }

  const last = pts.at(-1)
  const weekAgo = [...pts].reverse().find((p) => diffDays(last?.d ?? today, p.d) >= 7)
  const delta = last && weekAgo ? last.avg - weekAgo.avg : null

  // chart
  const W = 320
  const H = 140
  const vals = pts.flatMap((p) => [p.kg, p.avg])
  const lo = Math.min(...vals) - 0.5
  const hi = Math.max(...vals) + 0.5
  const first = pts[0]?.d ?? today
  const span = Math.max(7, diffDays(today, first))
  const x = (d: string) => 12 + (diffDays(d, first) / span) * (W - 24)
  const y = (v: number) => 12 + (1 - (v - lo) / (hi - lo)) * (H - 24)

  // training minutes, last 4 weeks
  const cards = new Map(data.cards.map((c) => [c.id, c]))
  const weeks = [3, 2, 1, 0].map((i) => {
    const s = addDays(weekStart(today), -7 * i)
    const mins = data.sessions
      .filter((x) => x.done && x.date >= s && x.date < addDays(s, 7) && cards.has(x.cardId))
      .reduce((a, x) => a + cards.get(x.cardId)!.minutes, 0)
    return { s, mins }
  })
  const maxMin = Math.max(150, ...weeks.map((w) => w.mins))

  return (
    <div className="page">
      <div className="weigh">
        <span className="hand-label">today</span>
        <div className="weigh-row">
          <input className="app-input weigh-input" type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="今天的体重" />
          <span className="weigh-unit">kg</span>
          <button className="btn btn--blue" onClick={save}>记下</button>
        </div>
        <p className="hint">早上起床、上完厕所后称最准。一天的数字会跳，看蓝线（7 天平均）就好。</p>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">体重趋势</h3>
          {last && (
            <span className="panel-meta">
              7 天平均 <b>{last.avg.toFixed(1)}</b> kg
              {delta !== null && ` · 比一周前 ${delta <= 0 ? '' : '+'}${delta.toFixed(1)}`}
            </span>
          )}
        </div>
        {pts.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="体重趋势">
            {pts.map((p) => (
              <circle key={p.d} cx={x(p.d)} cy={y(p.kg)} r={3} className="chart-dot" />
            ))}
            <polyline points={pts.map((p) => `${x(p.d)},${y(p.avg)}`).join(' ')} className="chart-line" />
            <text x={12} y={H - 2} className="chart-label">{md(first)}</text>
            <text x={W - 12} y={H - 2} className="chart-label" textAnchor="end">{md(today)}</text>
          </svg>
        ) : (
          <p className="empty">记两天以上就能看到趋势线啦</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">最近 4 周运动</h3>
          <span className="panel-meta">完成的分钟数</span>
        </div>
        <div className="bars">
          {weeks.map((w) => (
            <div key={w.s} className="bar-col">
              <span className="bar-num">{w.mins}</span>
              <div className="bar-track">
                <i style={{ height: `${(w.mins / maxMin) * 100}%` }} />
              </div>
              <span className="bar-label">{md(w.s)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
