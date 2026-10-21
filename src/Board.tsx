import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { AppData, Card, Category, Feeling, Session } from './types'
import type { Update } from './store'
import { addDays, fromKey, md, todayKey, weekDates, weekStart, weekdayLabel } from './date'
import { autoSchedule, fits, gentleDay, swapSession, uid } from './scheduler'
import { Cover, Pill, Sheet, Stars } from './ui'
import { Block, Timetable } from './Timetable'
import { bodyWeight, kcal } from './energy'

/** Landscape (and wide screens) get the full timetable; portrait keeps the day list. */
export function useWide() {
  const q = '(orientation: landscape) and (min-width: 640px)'
  const [wide, setWide] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

const CARDIO: Category[] = ['aerobic', 'boxing', 'walk']

export function Board({ data, update }: { data: AppData; update: Update }) {
  const today = todayKey()
  const [start, setStart] = useState(weekStart(today))
  const week = weekDates(start)
  const cards = useMemo(() => new Map(data.cards.map((c) => [c.id, c])), [data.cards])
  const [openId, setOpenId] = useState<string | null>(null)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const wide = useWide()
  const { kg, logged } = bodyWeight(data)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  const inWeek = data.sessions.filter((s) => week.includes(s.date) && cards.has(s.cardId))
  const isTraining = (s: Session) => !['stretch', 'mind'].includes(cards.get(s.cardId)!.category) || cards.get(s.cardId)!.kind === 'coach'
  const plannedDays = new Set(inWeek.filter(isTraining).map((s) => s.date)).size
  const doneDays = new Set(inWeek.filter((s) => s.done && isTraining(s)).map((s) => s.date)).size
  const cardioMin = (f: (s: Session) => boolean) =>
    inWeek.filter((s) => f(s) && CARDIO.includes(cards.get(s.cardId)!.category) && cards.get(s.cardId)!.kind === 'video').reduce((a, s) => a + cards.get(s.cardId)!.minutes, 0)
  const cardioDone = cardioMin((s) => s.done)
  const cardioPlan = cardioMin(() => true)
  const weekKcal = inWeek.reduce((a, s) => a + kcal(cards.get(s.cardId)!, kg), 0)

  const flash = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2600)
  }

  const setSessions = (fn: (s: Session[]) => Session[]) => update((d) => ({ ...d, sessions: fn(d.sessions) }))

  function auto() {
    const restDays = week.filter((d) => data.feelings[d] === 'tired')
    setSessions((s) => autoSchedule({ cards: data.cards, sessions: s, week, today, daysPerWeek: data.daysPerWeek, restDays }))
    flash('排好啦～手动拖过的、私教课和已完成的都没动')
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null)
    const to = e.over?.id as string | undefined
    const s = data.sessions.find((x) => x.id === e.active.id)
    if (!to || !s || s.date === to) return
    setSessions((list) => list.map((x) => (x.id === s.id ? { ...x, date: to, locked: true } : x)))
    const card = cards.get(s.cardId)!
    const ctx = { cards, sessions: data.sessions, rng: Math.random }
    if (!fits(ctx, card, to, s.id)) flash('挪好了～不过和相邻那天练的部位撞了，注意休息哦')
  }

  function setFeeling(date: string, f: Feeling) {
    update((d) => {
      const feelings = { ...d.feelings, [date]: f }
      return f === 'tired' ? { ...d, feelings, sessions: gentleDay(d.cards, d.sessions, date) } : { ...d, feelings }
    })
    if (f === 'tired') flash('今天换成轻松的拉伸了，照顾好自己就是完成')
  }

  const dragging = dragId ? data.sessions.find((s) => s.id === dragId) : undefined
  const open = openId ? data.sessions.find((s) => s.id === openId) : undefined

  const nav = (
    <div className="week-nav">
      <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="上一周">‹</button>
      <div className="week-title">
        <span className="hand-label">{start === weekStart(today) ? 'this week' : start < weekStart(today) ? 'past week' : 'next week'}</span>
        <strong>{md(week[0])} – {md(week[6])}</strong>
      </div>
      <button className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="下一周">›</button>
    </div>
  )
  const controls = (
    <div className="auto-row">
      <div className="stepper" aria-label="每周练几天">
        <button onClick={() => update((d) => ({ ...d, daysPerWeek: Math.max(1, d.daysPerWeek - 1) }))}>－</button>
        <span>每周 <b>{data.daysPerWeek}</b> 练</span>
        <button onClick={() => update((d) => ({ ...d, daysPerWeek: Math.min(6, d.daysPerWeek + 1) }))}>＋</button>
      </div>
      <button className="btn btn--blue" onClick={auto} disabled={week[6] < today}>✨ 自动排这周</button>
    </div>
  )

  return (
    <div className={`page ${wide ? 'page--wide' : ''}`}>
      {wide ? (
        <div className="tt-toolbar">
          {nav}
          {!logged && <span className="hint">按 {kg}kg 估算 · 去「进度」记体重更准</span>}
          {controls}
        </div>
      ) : (
        <>
      {nav}
      <div className="stats">
        <div className="stat">
          <span className="stat-num">{doneDays}<small>/{Math.max(plannedDays, data.daysPerWeek)}</small></span>
          <span className="stat-label">本周练了几天</span>
        </div>
        <div className="stat stat--wide">
          <div className="stat-bar">
            <i style={{ width: `${Math.min(100, (cardioPlan / 150) * 100)}%` }} className="stat-bar-plan" />
            <i style={{ width: `${Math.min(100, (cardioDone / 150) * 100)}%` }} />
          </div>
          <span className="stat-label">有氧 {cardioDone} / 150 分钟 · 已排 {cardioPlan} · 约 {weekKcal} kcal</span>
        </div>
      </div>

      {controls}
      <p className="hint rotate-hint">↻ 把手机横过来，看整周课程表、练哪里和预估大卡</p>
        </>
      )}

      <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        {wide ? (
          <Timetable week={week} today={today} sessions={inWeek} cards={cards} kg={kg} onOpen={setOpenId} onAdd={setAddFor} />
        ) : (
        <div className="days">
          {week.map((date) => (
            <Day
              key={date}
              date={date}
              today={today}
              sessions={inWeek.filter((s) => s.date === date).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))}
              cards={cards}
              feeling={data.feelings[date]}
              kg={kg}
              onOpen={setOpenId}
              onAdd={() => setAddFor(date)}
              onToggle={(id) => setSessions((l) => l.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))}
              onFeeling={(f) => setFeeling(date, f)}
            />
          ))}
        </div>
        )}
        <DragOverlay>
          {dragging && (wide ? <Block session={dragging} card={cards.get(dragging.cardId)!} overlay /> : <Chip session={dragging} card={cards.get(dragging.cardId)!} overlay />)}
        </DragOverlay>
      </DndContext>

      <p className="foot-note">长按{wide ? '色块' : '卡片'}可以拖到别的日子 · 拖过的会 📌 固定，自动重排时不会被挪走</p>

      <SessionSheet
        session={open}
        card={open && cards.get(open.cardId)}
        onClose={() => setOpenId(null)}
        onChange={(s) => setSessions((l) => l.map((x) => (x.id === s.id ? s : x)))}
        onSwap={(id) => {
          setSessions((l) => swapSession(data.cards, l, id))
          flash('换了一个～')
        }}
        onDelete={(id) => {
          setSessions((l) => l.filter((x) => x.id !== id))
          setOpenId(null)
        }}
      />

      <AddPicker
        date={addFor}
        cards={data.cards.filter((c) => !c.archived)}
        onClose={() => setAddFor(null)}
        onPick={(card, time) => {
          setSessions((l) => [...l, { id: uid(), cardId: card.id, date: addFor!, done: false, locked: true, time }])
          setAddFor(null)
        }}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Day(props: {
  date: string
  today: string
  sessions: Session[]
  cards: Map<string, Card>
  feeling?: Feeling
  kg: number
  onOpen: (id: string) => void
  onAdd: () => void
  onToggle: (id: string) => void
  onFeeling: (f: Feeling) => void
}) {
  const { date, today, sessions, cards } = props
  const { setNodeRef, isOver } = useDroppable({ id: date })
  const mins = sessions.reduce((a, s) => a + cards.get(s.cardId)!.minutes, 0)
  const cal = sessions.reduce((a, s) => a + kcal(cards.get(s.cardId)!, props.kg), 0)
  const isToday = date === today
  return (
    <section ref={setNodeRef} className={`day ${isToday ? 'day--today' : ''} ${date < today ? 'day--past' : ''} ${isOver ? 'day--over' : ''}`}>
      <div className="day-head">
        <div className="day-date">
          <span className="day-wd">{weekdayLabel(date)}</span>
          <span className="day-num">{fromKey(date).getDate()}</span>
        </div>
        {isToday && <span className="today-tag">today</span>}
        <span className="day-meta">{mins ? `${mins} 分钟 · 约 ${cal} kcal` : ''}</span>
        <button className="icon-btn icon-btn--sm" onClick={props.onAdd} aria-label="添加">＋</button>
      </div>
      <div className="day-body">
        {sessions.map((s) => (
          <Chip key={s.id} session={s} card={cards.get(s.cardId)!} onOpen={() => props.onOpen(s.id)} onToggle={() => props.onToggle(s.id)} />
        ))}
        {!sessions.length && <p className="rest">休息日 · 散散步也算数</p>}
        {isToday && (
          <div className="feeling">
            <span>今天身体感觉</span>
            {(
              [
                ['good', '☀️ 元气'],
                ['ok', '🙂 还行'],
                ['tired', '🫠 有点累'],
              ] as [Feeling, string][]
            ).map(([k, l]) => (
              <button key={k} className={`chip ${props.feeling === k ? 'chip--on' : ''}`} onClick={() => props.onFeeling(k)}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Chip({ session, card, onOpen, onToggle, overlay }: { session: Session; card: Card; onOpen?: () => void; onToggle?: () => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: session.id, disabled: overlay })
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      className={`chip-card ${session.done ? 'chip-card--done' : ''} ${isDragging ? 'chip-card--ghost' : ''} ${overlay ? 'chip-card--overlay' : ''}`}
      onClick={onOpen}
    >
      <Cover card={card} small />
      <div className="chip-main">
        <p className="chip-title">{card.kind === 'coach' && card.coach ? `${card.title} · ${card.coach}` : card.title}</p>
        <p className="meta">
          <Pill card={card} /> {session.time && <b>{session.time}</b>} {card.minutes}′ {session.locked && card.kind !== 'coach' && '📌'}
        </p>
      </div>
      <button
        className={`check ${session.done ? 'check--on' : ''}`}
        aria-label="完成"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onToggle?.()
        }}
      />
    </div>
  )
}

function SessionSheet({
  session,
  card,
  onClose,
  onChange,
  onSwap,
  onDelete,
}: {
  session?: Session
  card?: Card
  onClose: () => void
  onChange: (s: Session) => void
  onSwap: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (!session || !card) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const link = card.bvid ? `https://www.bilibili.com/video/${card.bvid}` : card.url
  return (
    <Sheet open onClose={onClose} title={card.kind === 'coach' ? `${card.title}${card.coach ? ` · ${card.coach}` : ''}` : card.title}>
      {card.bvid ? (
        <Player bvid={card.bvid} title={card.title} />
      ) : card.kind === 'coach' ? (
        <div className="coach-ticket">
          <span className="hand-label">private class</span>
          <dl>
            <div><dt>日期</dt><dd>{weekdayLabel(session.date)} {md(session.date)}</dd></div>
            <div>
              <dt>时间</dt>
              <dd><input className="app-input app-input--inline" type="time" value={session.time ?? ''} onChange={(e) => onChange({ ...session, time: e.target.value })} /></dd>
            </div>
            <div><dt>地点</dt><dd>{card.place || '—'}</dd></div>
            <div><dt>时长</dt><dd>{card.minutes} 分钟</dd></div>
          </dl>
          {card.note && <p className="hint">{card.note}</p>}
        </div>
      ) : (
        <Cover card={card} />
      )}

      <p className="meta sheet-meta">
        <Pill card={card} /> {card.minutes} 分钟 · <Stars n={card.stars} /> {card.owner}
        {link && (
          <a className="link" href={link} target="_blank" rel="noreferrer">去 B站 看 ↗</a>
        )}
      </p>

      <div className="sheet-actions sheet-actions--stack">
        <button className={`btn ${session.done ? 'btn--ghost' : 'btn--yellow'} btn--big`} onClick={() => onChange({ ...session, done: !session.done })}>
          {session.done ? '撤销完成' : '✓ 练完啦'}
        </button>
        <div className="sheet-actions">
          {card.kind === 'video' && <button className="btn btn--ghost" onClick={() => onSwap(session.id)}>🎲 换一个</button>}
          <button className="btn btn--ghost" onClick={() => onChange({ ...session, locked: !session.locked })}>
            {session.locked ? '取消固定' : '📌 固定在这天'}
          </button>
          <button className="btn btn--ghost-red" onClick={() => onDelete(session.id)}>移出课表</button>
        </div>
        <p className="hint">
          {session.locked ? '📌 已固定：' : '固定后，'}再点「自动排这周」也不会把这节课挪走或换掉。拖动过的课会自动固定。
        </p>
      </div>
    </Sheet>
  )
}

function AddPicker({ date, cards, onClose, onPick }: { date: string | null; cards: Card[]; onClose: () => void; onPick: (c: Card, time?: string) => void }) {
  const [time, setTime] = useState('19:00')
  return (
    <Sheet open={!!date} onClose={onClose} title={date ? `加到 ${weekdayLabel(date)} ${md(date)}` : ''}>
      <div className="pick-list">
        {cards.map((c) => (
          <div key={c.id} className="pick-item">
            <Cover card={c} small />
            <div className="chip-main">
              <p className="chip-title">{c.kind === 'coach' && c.coach ? `${c.title} · ${c.coach}` : c.title}</p>
              <p className="meta"><Pill card={c} /> {c.minutes}′</p>
            </div>
            {c.kind === 'coach' && <input className="app-input app-input--inline" type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
            <button className="btn btn--blue btn--sm" onClick={() => onPick(c, c.kind === 'coach' ? time : undefined)}>加</button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

/** B站 player with a big full-screen button. Real Fullscreen API where available (Android / desktop), else a viewport-covering fallback (iPhone). */
function Player({ bvid, title }: { bvid: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [max, setMax] = useState(false)
  useEffect(() => {
    const onChange = () => setMax(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const enter = async () => {
    const el = ref.current
    if (el?.requestFullscreen) {
      try {
        await el.requestFullscreen()
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {})
        return
      } catch {
        /* fall through to the CSS fallback */
      }
    }
    setMax(true)
  }
  const exit = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else setMax(false)
  }
  return (
    <div ref={ref} className={`player ${max && !document.fullscreenElement ? 'player--max' : ''}`}>
      <iframe
        key={bvid}
        src={`https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=0&high_quality=1&danmaku=0`}
        allow="fullscreen; picture-in-picture; autoplay"
        allowFullScreen
        referrerPolicy="no-referrer"
        title={title}
      />
      <button className={`player-max ${max ? 'player--top' : ''}`} onClick={max ? exit : enter}>
        {max ? '× 退出全屏' : '⛶ 全屏'}
      </button>
    </div>
  )
}
