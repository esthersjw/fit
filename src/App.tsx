import { useState } from 'react'
import { recommended, useData } from './store'
import { Board } from './Board'
import { Library } from './Library'
import { Diet } from './Diet'
import { Progress } from './Progress'
import { AccountButton, AccountSheet } from './Account'

const TABS = [
  { k: 'board', label: '课表', en: 'plan' },
  { k: 'library', label: '卡片库', en: 'cards' },
  { k: 'diet', label: '饮食', en: 'food' },
  { k: 'progress', label: '进度', en: 'trend' },
] as const
type Tab = (typeof TABS)[number]['k']

export default function App() {
  const [data, update, cloud] = useData()
  const [tab, setTab] = useState<Tab>('board')
  const [acct, setAcct] = useState(false)
  return (
    <div className={`app app--${tab}`}>
      <header className="app-header">
        <h1>
          身体课表<span className="hl-dot">.</span>
        </h1>
        <span className="tagline">move &amp; nourish</span>
        <AccountButton cloud={cloud} onOpen={() => setAcct(true)} />
      </header>
      <AccountSheet open={acct} onClose={() => setAcct(false)} cloud={cloud} data={data} />

      <main className="app-content">
        {tab === 'board' && <Board data={data} update={update} />}
        {tab === 'library' && <Library data={data} update={update} />}
        {tab === 'diet' && <Diet data={data} update={update} />}
        {tab === 'progress' && <Progress data={data} update={update} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.k} className={`tabbar-item ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)}>
            <span className="tabbar-en">{t.en}</span>
            <span>
              {t.label}
              {t.k === 'library' && recommended(data).length > 0 && <i className="tab-new" aria-label="有新推荐" />}
            </span>
          </button>
        ))}
      </nav>
    </div>
  )
}
