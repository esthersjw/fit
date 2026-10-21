import { useState } from 'react'
import type { AppData, Card, Category } from './types'
import { CATEGORY, FOCUS, INTENSITY } from './types'
import { recommended, type Update } from './store'
import { fetchBiliMeta, guessTags, parseBiliInput } from './bili'
import { uid } from './scheduler'
import { CardEditor } from './CardEditor'
import { Cover, Pill, Stars } from './ui'

export function Library({ data, update }: { data: AppData; update: Update }) {
  const [filter, setFilter] = useState<Category | 'coach' | 'all'>('all')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState<{ card: Card; isNew: boolean } | null>(null)

  const [allRecs, setAllRecs] = useState(false)
  const live = data.cards.filter((c) => !c.archived)
  const trashed = data.cards.filter((c) => c.archived)
  const recs = recommended(data)
  const take = (list: Card[]) => update((d) => ({ ...d, cards: [...list, ...d.cards] }))
  const skip = (c: Card) => update((d) => ({ ...d, cards: [...d.cards, { ...c, archived: true }] }))
  const restore = (id: string) => update((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, archived: false } : c)) }))
  const shown = live.filter((c) => filter === 'all' || (filter === 'coach' ? c.kind === 'coach' : c.kind === 'video' && c.category === filter))

  async function addVideo() {
    const p = parseBiliInput(input)
    setMsg('')
    if (!p.bvid && !p.url) return setMsg('没认出链接～粘贴 B站 视频链接、BV 号或 App 里的分享文字都行')
    if (p.bvid && live.some((c) => c.bvid === p.bvid)) return setMsg('这个视频已经在卡片库里啦')
    const base: Card = {
      id: p.bvid ?? uid(),
      kind: 'video',
      title: p.title ?? '',
      url: p.url,
      bvid: p.bvid,
      minutes: 20,
      stars: 2,
      ...guessTags(p.title ?? ''),
    }
    if (p.bvid) {
      setBusy(true)
      try {
        const m = await fetchBiliMeta(p.bvid)
        Object.assign(base, { title: m.title, cover: m.cover, minutes: m.minutes, owner: m.owner }, guessTags(m.title))
      } catch {
        setMsg('B站信息没拉到，可以手动填一下')
      }
      setBusy(false)
    }
    setEditing({ card: base, isNew: true })
  }

  const addCoach = () =>
    setEditing({
      card: { id: uid(), kind: 'coach', title: '私教课', category: 'strength', focus: ['full'], intensity: 2, minutes: 60, stars: 2 },
      isNew: true,
    })

  function save(card: Card) {
    update((d) => ({ ...d, cards: d.cards.some((c) => c.id === card.id) ? d.cards.map((c) => (c.id === card.id ? card : c)) : [card, ...d.cards] }))
    if (editing?.isNew) setInput('')
    setEditing(null)
  }

  function remove(id: string) {
    // Archive, don't delete: finished sessions keep their minutes/kcal, and a later starter-library update won't bring it back.
    update((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, archived: true } : c)), sessions: d.sessions.filter((s) => s.cardId !== id || s.done) }))
    setEditing(null)
  }

  return (
    <div className="page">
      <div className="paste-box">
        <span className="hand-label">add a video</span>
        <textarea
          className="app-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="粘贴 B站 链接 / BV 号 / App 分享文字"
        />
        <div className="paste-actions">
          <button className="btn btn--ghost" onClick={addCoach}>＋ 私教课卡片</button>
          <button className="btn btn--yellow" disabled={busy || !input.trim()} onClick={addVideo}>
            {busy ? '读取中…' : '识别并添加'}
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </div>

      {recs.length > 0 && (
        <div className="rec-box">
          <span className="hand-label">new from 不二</span>
          <div className="rec-head">
            <p className="acct-title">不二推荐的新课 · {recs.length}</p>
            <button className="btn btn--yellow btn--sm" onClick={() => take(recs)}>全部加上</button>
          </div>
          <p className="hint">喜欢就加进你的库；不想要点「不要」，之后在最下面「已删除」里还能找回。</p>
          <div className="pick-list">
            {(allRecs ? recs : recs.slice(0, 3)).map((c) => (
              <div key={c.id} className="pick-item">
                <button className="rec-open" onClick={() => setEditing({ card: c, isNew: true })}>
                  <Cover card={c} small />
                  <div className="chip-main">
                    <p className="chip-title">{c.title}</p>
                    <p className="meta"><Pill card={c} /> {c.minutes}′ · {c.owner}</p>
                  </div>
                </button>
                <div className="rec-actions">
                  <button className="btn btn--blue btn--sm" onClick={() => take([c])}>加</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => skip(c)}>不要</button>
                </div>
              </div>
            ))}
          </div>
          {recs.length > 3 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setAllRecs(!allRecs)}>
              {allRecs ? '收起' : `看全部 ${recs.length} 个`}
            </button>
          )}
        </div>
      )}

      <div className="filter-bar">
        {(['all', ...Object.keys(CATEGORY), 'coach'] as const).map((k) => (
          <button key={k} className={`filter-tag ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k as typeof filter)}>
            {k === 'all' ? `全部 ${live.length}` : k === 'coach' ? '私教' : CATEGORY[k as Category].label}
          </button>
        ))}
      </div>

      <div className="lib-grid">
        {shown.map((c) => (
          <button key={c.id} className="lib-card" onClick={() => setEditing({ card: c, isNew: false })}>
            <Cover card={c} />
            <div className="lib-body">
              <Pill card={c} />
              <h3>{c.kind === 'coach' && c.coach ? `${c.title} · ${c.coach}` : c.title}</h3>
              <p className="meta">
                {c.minutes} 分钟 · {INTENSITY[c.intensity]} · {c.focus.map((f) => FOCUS[f]).join('/')}
              </p>
              <p className="meta meta--soft">
                <Stars n={c.stars} /> {c.kind === 'coach' ? c.place : c.owner}
              </p>
            </div>
          </button>
        ))}
        {!shown.length && <p className="empty">这一类还没有卡片</p>}
      </div>

      {trashed.length > 0 && (
        <details className="trash">
          <summary>已删除的 {trashed.length} 个</summary>
          <p className="hint">删掉的卡不会再被排进课表；以前练过的记录一直都算数。</p>
          <div className="pick-list">
            {trashed.map((c) => (
              <div key={c.id} className="pick-item">
                <Cover card={c} small />
                <div className="chip-main">
                  <p className="chip-title">{c.kind === 'coach' && c.coach ? `${c.title} · ${c.coach}` : c.title}</p>
                  <p className="meta"><Pill card={c} /> {c.minutes}′</p>
                </div>
                <button className="btn btn--ghost btn--sm" onClick={() => restore(c.id)}>恢复</button>
              </div>
            ))}
          </div>
        </details>
      )}

      <CardEditor card={editing?.card ?? null} isNew={editing?.isNew} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />
    </div>
  )
}
