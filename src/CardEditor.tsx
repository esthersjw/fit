import { useState } from 'react'
import type { Card, Category, Focus, Intensity } from './types'
import { CATEGORY, FOCUS, INTENSITY, cardName } from './types'
import { Chips, Cover, Sheet } from './ui'

export function CardEditor({
  card,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  card: Card | null
  isNew?: boolean
  onSave: (c: Card) => void
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet open={!!card} onClose={onClose} title={isNew ? '新卡片' : '编辑卡片'}>
      {card && <Form key={card.id} card={card} isNew={isNew} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  )
}

function Form({ card, isNew, onSave, onDelete }: { card: Card; isNew?: boolean; onSave: (c: Card) => void; onDelete?: (id: string) => void }) {
  const [c, setC] = useState(card)
  const set = <K extends keyof Card>(k: K, v: Card[K]) => setC((x) => ({ ...x, [k]: v }))
  const coach = c.kind === 'coach'
  const shortLink = c.kind === 'video' && !c.bvid

  return (
    <div className="form">
      {!coach && (
        <div className="form-preview">
          <Cover card={c} />
          {shortLink && <p className="hint">这是 b23 短链，没法在页面里内嵌播放，点开会跳去 B站 看。想内嵌的话，在网页版复制带 BV 号的完整链接。</p>}
        </div>
      )}
      <label className="field">
        <span>{coach ? '课程名' : '标题'}</span>
        <input className="app-input" value={c.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      {!coach && (
        <label className="field">
          <span>课表里的短名</span>
          <input className="app-input" value={c.short ?? ''} onChange={(e) => set('short', e.target.value)} placeholder={cardName({ ...c, short: '' })} maxLength={12} />
        </label>
      )}
      {coach && (
        <div className="field-row">
          <label className="field">
            <span>教练</span>
            <input className="app-input" value={c.coach ?? ''} onChange={(e) => set('coach', e.target.value)} placeholder="比如：小林" />
          </label>
          <label className="field">
            <span>地点</span>
            <input className="app-input" value={c.place ?? ''} onChange={(e) => set('place', e.target.value)} placeholder="场馆 / 地址" />
          </label>
        </div>
      )}
      {!coach && (
        <div className="field">
          <span>类型</span>
          <Chips
            options={(Object.keys(CATEGORY) as Category[]).map((k) => ({ value: k, label: CATEGORY[k].label }))}
            value={[c.category]}
            onChange={([v]) => set('category', v)}
          />
        </div>
      )}
      <div className="field">
        <span>练哪里（可多选）</span>
        <Chips
          multi
          options={(Object.keys(FOCUS) as Focus[]).map((k) => ({ value: k, label: FOCUS[k] }))}
          value={c.focus}
          onChange={(v) => set('focus', v.length ? v : ['full'])}
        />
      </div>
      <div className="field">
        <span>强度</span>
        <Chips
          options={([1, 2, 3] as Intensity[]).map((k) => ({ value: k, label: INTENSITY[k] }))}
          value={[c.intensity]}
          onChange={([v]) => set('intensity', v)}
        />
      </div>
      {(c.category === 'aerobic' || c.category === 'boxing') && c.kind === 'video' && c.minutes < 20 && (
        <p className="hint">有氧和拳击不到 20 分钟的，自动排课不会选它，只能手动加。</p>
      )}
      <div className="field-row">
        <label className="field">
          <span>时长（分钟）</span>
          <input className="app-input" type="number" inputMode="numeric" min={1} value={c.minutes} onChange={(e) => set('minutes', Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <div className="field">
          <span>喜欢程度</span>
          <Chips
            options={[1, 2, 3].map((k) => ({ value: k, label: '★'.repeat(k) }))}
            value={[c.stars]}
            onChange={([v]) => set('stars', v as Card['stars'])}
          />
        </div>
      </div>
      <label className="field">
        <span>备注</span>
        <input className="app-input" value={c.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder={coach ? '课时、价格、要带的东西…' : '比如：第 8 分钟最累'} />
      </label>
      <div className="sheet-actions">
        {!isNew && onDelete && (
          <button
            className="btn btn--ghost-red"
            onClick={() => confirm('从你的卡片库删掉这张？课表里还没练的会一起移除，已经练过的记录都还在。') && onDelete(c.id)}
          >
            删除
          </button>
        )}
        <button className="btn btn--blue" onClick={() => onSave({ ...c, title: c.title.trim() || (coach ? '私教课' : '未命名视频') })}>
          {isNew ? '放进卡片库' : '保存'}
        </button>
      </div>
    </div>
  )
}
