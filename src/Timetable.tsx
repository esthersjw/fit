import type { CSSProperties, ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Card, Focus, Session } from './types'
import { CATEGORY, FOCUS, cardName } from './types'
import { fromKey, weekdayLabel } from './date'
import { loads } from './scheduler'
import { kcal } from './energy'

const GROUPS: Focus[] = ['legs', 'upper', 'core']

type Mark = 'main' | 'light' | null

/** ● = this day actually loads the group (strength-ish), ○ = only touched by cardio/light work. */
export function groupMarks(cards: Card[]): Record<Focus, Mark> {
  const out = { legs: null, upper: null, core: null, full: null } as Record<Focus, Mark>
  for (const c of cards) {
    if (c.category === 'stretch' || c.category === 'mind') continue
    const hit = loads(c)
    const touched = c.focus.includes('full') ? GROUPS : c.focus
    for (const g of GROUPS) {
      if (hit.includes(g)) out[g] = 'main'
      else if (touched.includes(g) && !out[g]) out[g] = 'light'
    }
  }
  return out
}

export const shortLabel = (c: Card) => (c.kind === 'coach' ? '私教' : CATEGORY[c.category].label.split('·')[0])

export function Timetable(props: {
  week: string[]
  today: string
  sessions: Session[]
  cards: Map<string, Card>
  kg: number
  onOpen: (id: string) => void
  onAdd: (date: string) => void
}) {
  const { week, today, cards, kg } = props
  const byDay = week.map((d) =>
    props.sessions.filter((s) => s.date === d).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99')),
  )
  const dayCards = byDay.map((list) => list.map((s) => cards.get(s.cardId)!))
  const mins = dayCards.map((l) => l.reduce((a, c) => a + c.minutes, 0))
  const cals = dayCards.map((l) => l.reduce((a, c) => a + kcal(c, kg), 0))
  const scale = Math.max(60, ...mins)
  const marks = dayCards.map(groupMarks)
  const groupCount = (g: Focus) => marks.filter((m) => m[g] === 'main').length

  return (
    <div className="tt">
      <div className="tt-grid">
        {/* header */}
        <div className="tt-corner" />
        {week.map((d) => (
          <button key={d} className={`tt-head ${d === today ? 'tt-head--today' : ''}`} onClick={() => props.onAdd(d)} aria-label={`给${weekdayLabel(d)}加课`}>
            <span>{weekdayLabel(d)}</span>
            <b>{fromKey(d).getDate()}</b>
            <i>＋</i>
          </button>
        ))}

        {/* blocks */}
        <div className="tt-rowlabel tt-rowlabel--blocks">
          <span className="hand-label">plan</span>
        </div>
        {week.map((d, i) => (
          <Column key={d} date={d} past={d < today} today={d === today}>
            {byDay[i].map((s) => (
              <Block key={s.id} session={s} card={cards.get(s.cardId)!} pct={(cards.get(s.cardId)!.minutes / scale) * 100} onOpen={() => props.onOpen(s.id)} />
            ))}
            {!byDay[i].length && <span className="tt-rest">休</span>}
          </Column>
        ))}

        {/* body-part dots */}
        {GROUPS.map((g) => (
          <Row key={g} label={FOCUS[g]}>
            {marks.map((m, i) => (
              <div key={week[i]} className={`tt-cell ${week[i] === today ? 'tt-cell--today' : ''}`}>
                {m[g] && <span className={`dot dot--${m[g]}`} />}
              </div>
            ))}
          </Row>
        ))}

        {/* kcal */}
        <Row label="大卡">
          {cals.map((c, i) => (
            <div key={week[i]} className={`tt-cell tt-kcal ${week[i] === today ? 'tt-cell--today' : ''}`}>
              {c ? c : '–'}
            </div>
          ))}
        </Row>
      </div>

      <p className="tt-sum">
        本周预计 <b>≈ {cals.reduce((a, b) => a + b, 0)}</b> kcal · {mins.reduce((a, b) => a + b, 0)} 分钟 ·{' '}
        {GROUPS.map((g) => `${FOCUS[g]} ${groupCount(g)} 次`).join(' / ')}
        <span className="tt-legend">
          <span className="dot dot--main" /> 重点练 <span className="dot dot--light" /> 顺带练到
        </span>
      </p>
    </div>
  )
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <div className="tt-rowlabel">{label}</div>
    {children}
  </>
)

function Column({ date, past, today, children }: { date: string; past: boolean; today: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  return (
    <div ref={setNodeRef} className={`tt-col ${past ? 'tt-col--past' : ''} ${today ? 'tt-col--today' : ''} ${isOver ? 'tt-col--over' : ''}`}>
      {children}
    </div>
  )
}

export function Block({ session, card, pct, onOpen, overlay }: { session: Session; card: Card; pct?: number; onOpen?: () => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: session.id, disabled: overlay })
  const coach = card.kind === 'coach'
  const color = coach ? '#1A1A2E' : CATEGORY[card.category].color
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      className={`tt-block ${coach ? 'tt-block--coach' : ''} ${session.done ? 'tt-block--done' : ''} ${isDragging ? 'tt-block--ghost' : ''} ${overlay ? 'tt-block--overlay' : ''}`}
      style={{ '--c': color, '--ci': coach ? color : CATEGORY[card.category].ink, height: overlay ? 44 : `${pct}%` } as CSSProperties}
      onClick={onOpen}
      title={card.title}
    >
      <span className="tt-block-label" style={{ color: coach ? '#F4D758' : CATEGORY[card.category].ink }}>
        {cardName(card)}
      </span>
      <span className="tt-block-min">
        {shortLabel(card)} · {session.time ?? `${card.minutes}′`}
      </span>
      {session.done && <span className="tt-block-done">✓</span>}
    </div>
  )
}
