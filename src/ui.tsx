import { useEffect, type ReactNode } from 'react'
import type { Card } from './types'
import { CATEGORY } from './types'
import { thumb } from './bili'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="sheet-grip" />
        <div className="sheet-head">
          {title && <h2 className="sheet-title">{title}</h2>}
          <button className="icon-btn" onClick={onClose} aria-label="关闭">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Pill({ card }: { card: Card }) {
  if (card.kind === 'coach') return <span className="pill pill--coach">私教</span>
  const c = CATEGORY[card.category]
  return (
    <span className="pill" style={{ color: c.ink, background: `${c.color}2e` }}>
      {c.label}
    </span>
  )
}

/** Hand-drawn covers for coach classes, matched by keyword in the class name / coach / note. */
const COACH_ART: [RegExp, string][] = [
  [/网球|tennis/i, '/coach/tennis.jpg'],
  [/泰拳|muay/i, '/coach/muaythai.jpg'],
]
const coachArt = (c: Card) => COACH_ART.find(([re]) => re.test(`${c.title} ${c.coach ?? ''} ${c.note ?? ''}`))?.[1]

export function Cover({ card, small }: { card: Card; small?: boolean }) {
  const art = card.kind === 'coach' ? coachArt(card) : undefined
  if (art) return <img className={`cover cover--art ${small ? 'cover--sm' : ''}`} src={art} alt="" loading="lazy" />
  if (card.kind === 'coach')
    return (
      <div className={`cover cover--coach ${small ? 'cover--sm' : ''}`}>
        <span>coach</span>
      </div>
    )
  if (!card.cover)
    return (
      <div className={`cover cover--blank ${small ? 'cover--sm' : ''}`} style={{ background: `${CATEGORY[card.category].color}40` }}>
        <span>{CATEGORY[card.category].label}</span>
      </div>
    )
  return (
    <img
      className={`cover ${small ? 'cover--sm' : ''}`}
      src={small ? thumb(card.cover, 160, 100) : thumb(card.cover)}
      referrerPolicy="no-referrer"
      loading="lazy"
      alt=""
    />
  )
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  multi,
}: {
  options: { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
  multi?: boolean
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.value)
        return (
          <button
            key={String(o.value)}
            type="button"
            className={`chip ${on ? 'chip--on' : ''}`}
            onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export const Stars = ({ n }: { n: number }) => <span className="stars">{'★'.repeat(n)}<i>{'★'.repeat(3 - n)}</i></span>
