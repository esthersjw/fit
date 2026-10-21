import { useEffect, useState } from 'react'
import type { AppData } from './types'
import type { Cloud } from './store'
import { Sheet } from './ui'
import { cloudEnabled, createKey, listKeys, revokeKey, signIn, signUp, supabaseAnonKey, supabaseUrl, type AgentKey } from './cloud'
import { buildSummary } from './summary'
import { todayKey } from './date'

const STATUS: Record<Cloud['status'], string> = {
  local: '只存在这台设备',
  syncing: '同步中…',
  synced: '已同步',
  offline: '离线，联网后自动同步',
  error: '同步失败，稍后会重试',
}

/** Header button: shows who's signed in / sync state, opens the account sheet. */
export function AccountButton({ cloud, onOpen }: { cloud: Cloud; onOpen: () => void }) {
  const dot = cloud.user ? (cloud.status === 'synced' ? 'ok' : cloud.status === 'syncing' ? 'busy' : 'warn') : 'off'
  return (
    <button className="acct-btn" onClick={onOpen} aria-label="账号与数据">
      <i className={`acct-dot acct-dot--${dot}`} />
      {cloud.user ? '我的' : cloudEnabled ? '登录' : '数据'}
    </button>
  )
}

export function AccountSheet({ open, onClose, cloud, data }: { open: boolean; onClose: () => void; cloud: Cloud; data: AppData }) {
  return (
    <Sheet open={open} onClose={onClose} title="账号与数据">
      {cloudEnabled && (cloud.user ? <SignedIn cloud={cloud} /> : <SignIn />)}
      {cloud.user && <AgentKeys />}
      <Export data={data} />
      {cloud.user && (
        <button
          className="btn btn--ghost-red"
          onClick={async () => {
            if (confirm('退出后，这台设备上的数据会清掉（云端的还在，重新登录就回来）。')) {
              await cloud.signOut()
              onClose()
            }
          }}
        >
          退出登录
        </button>
      )}
    </Sheet>
  )
}

/** Supabase / network errors → plain Chinese. */
function friendly(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/failed to fetch|network|load failed/i.test(m)) return '连不上服务器，检查一下网络再试试。'
  if (/invalid login credentials/i.test(m)) return '邮箱或密码不对。'
  if (/already registered|already been registered/i.test(m)) return '这个邮箱已经注册过了，直接登录就好。'
  if (/password should be|weak password/i.test(m)) return '密码至少要 6 位。'
  if (/email not confirmed/i.test(m)) return '这个邮箱还没确认，去邮箱点一下确认链接。'
  if (/rate limit|too many/i.test(m)) return '试得太频繁了，等一分钟再来。'
  if (/signups not allowed/i.test(m)) return '现在还没开放注册。'
  return m
}

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const up = mode === 'up'
  const ok = /^\S+@\S+\.\S+$/.test(email) && pw.length >= 6 && (!up || pw === pw2)
  const submit = async () => {
    setBusy(true)
    setErr('')
    setNote('')
    try {
      if (!up) await signIn(email, pw)
      else if (!(await signUp(email, pw))) setNote('注册好了。去邮箱点一下确认链接，再回来登录。')
    } catch (e) {
      setErr(friendly(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="acct-box">
      <span className="hand-label">{up ? 'sign up' : 'sign in'}</span>
      <div className="filter-bar acct-tabs">
        <button className={`filter-tag${!up ? ' active' : ''}`} onClick={() => { setMode('in'); setErr(''); setNote('') }}>登录</button>
        <button className={`filter-tag${up ? ' active' : ''}`} onClick={() => { setMode('up'); setErr(''); setNote('') }}>注册</button>
      </div>
      <p className="hint">登录后数据存到云端，手机和电脑打开都是同一份。这台设备上已有的记录会一起带上去。</p>
      <form className="acct-form" onSubmit={(e) => { e.preventDefault(); if (ok && !busy) submit() }}>
        <label className="field">
          <span>邮箱</span>
          <input className="app-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="you@example.com" />
        </label>
        <label className="field">
          <span>{up ? '设一个密码（至少 6 位）' : '密码'}</span>
          <input className="app-input" type="password" autoComplete={up ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {up && (
          <label className="field">
            <span>再输一次</span>
            <input className="app-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            {pw2 && pw !== pw2 && <span className="acct-err">两次不一样</span>}
          </label>
        )}
        {err && <p className="acct-err">{err}</p>}
        {note && <p className="hint">{note}</p>}
        <button type="submit" className="btn btn--blue btn--big" disabled={busy || !ok}>
          {busy ? '稍等…' : up ? '注册并登录' : '登录'}
        </button>
      </form>
      {!up && <p className="meta meta--soft">忘记密码暂时还不能自助找回，记得存进手机的密码管理里。</p>}
    </div>
  )
}

function SignedIn({ cloud }: { cloud: Cloud }) {
  return (
    <div className="acct-box">
      <span className="hand-label">hi</span>
      <p className="acct-me">{cloud.user!.email}</p>
      <p className="meta">
        <i className={`acct-dot acct-dot--${cloud.status === 'synced' ? 'ok' : cloud.status === 'syncing' ? 'busy' : 'warn'}`} /> {STATUS[cloud.status]}
      </p>
    </div>
  )
}

function agentPrompt(token: string) {
  return `你可以读取我的「身体课表」健身进度（只读）。
调用方式：
POST ${supabaseUrl}/rest/v1/rpc/agent_summary
Headers: apikey: ${supabaseAnonKey}
         Content-Type: application/json
Body: {"token": "${token}"}
（要完整原始数据时 Body 加 "include_data": true）

返回 JSON：summary.markdown 是人能直接读的周报；summary.this_week / next_week / last_4_weeks / weight / diet_last_7d 是结构化数据。
这些是事实记录，不是考核：聊我的进度时别催、别打分，体重只看 7 天平均的趋势。`
}

function AgentKeys() {
  const [keys, setKeys] = useState<AgentKey[] | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState('')
  const [err, setErr] = useState('')
  const reload = () => listKeys().then(setKeys, (e) => setErr(friendly(e)))
  useEffect(() => {
    reload()
  }, [])
  const copy = async (what: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(what)
    setTimeout(() => setCopied(''), 1500)
  }
  return (
    <div className="acct-box">
      <span className="hand-label">agent</span>
      <p className="acct-title">连接我的 Agent</p>
      <p className="hint">生成一把只读钥匙给你的 Agent，它就能查你的课表、完成情况、体重趋势和饮食记录，改不了任何东西。随时可以作废。</p>
      {fresh ? (
        <div className="acct-fresh">
          <p className="hint">这把钥匙只显示这一次，先复制下来：</p>
          <code className="acct-token">{fresh}</code>
          <div className="sheet-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => copy('key', fresh)}>{copied === 'key' ? '已复制 ✓' : '复制钥匙'}</button>
            <button className="btn btn--yellow btn--sm" onClick={() => copy('prompt', agentPrompt(fresh))}>{copied === 'prompt' ? '已复制 ✓' : '复制给 Agent 的说明'}</button>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => setFresh(null)}>好了，收起来</button>
        </div>
      ) : (
        <button
          className="btn btn--blue"
          onClick={async () => {
            try {
              const label = `${new Date().toLocaleDateString('zh-CN')} 生成`
              setFresh(await createKey(label))
              reload()
            } catch (e) {
              setErr(friendly(e))
            }
          }}
        >
          ＋ 生成一把钥匙
        </button>
      )}
      {err && <p className="acct-err">{err}</p>}
      {keys && keys.length > 0 && (
        <div className="pick-list">
          {keys.map((k) => (
            <div key={k.id} className="pick-item acct-key">
              <div className="chip-main">
                <p className="chip-title">{k.label ?? '钥匙'}</p>
                <p className="meta meta--soft">{k.last_used_at ? `上次使用 ${new Date(k.last_used_at).toLocaleString('zh-CN')}` : '还没被用过'}</p>
              </div>
              <button className="btn btn--ghost-red btn--sm" onClick={() => revokeKey(k.id).then(reload)}>作废</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function Export({ data }: { data: AppData }) {
  const day = todayKey()
  return (
    <div className="acct-box">
      <span className="hand-label">export</span>
      <p className="acct-title">导出我的数据</p>
      <p className="hint">完整数据（JSON）适合备份和搬家；周报（Markdown）适合放进笔记，或者直接丢给 AI 看。</p>
      <div className="sheet-actions">
        <button className="btn btn--ghost" onClick={() => download(`身体课表-${day}.json`, JSON.stringify({ exported_at: new Date().toISOString(), data }, null, 2), 'application/json')}>
          完整数据 JSON
        </button>
        <button className="btn btn--ghost" onClick={() => download(`身体课表周报-${day}.md`, buildSummary(data).markdown, 'text/markdown')}>
          周报 Markdown
        </button>
      </div>
    </div>
  )
}
