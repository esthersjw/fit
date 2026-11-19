import { useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import type { Cloud, Update } from './store'
import { Sheet } from './ui'
import { cloudEnabled, createKey, listKeys, revokeKey, signIn, signUp, supabaseAnonKey, supabaseUrl, type AgentKey } from './cloud'
import { parseBackup } from './backup'
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

export function AccountSheet({ open, onClose, cloud, data, update }: { open: boolean; onClose: () => void; cloud: Cloud; data: AppData; update: Update }) {
  return (
    <Sheet open={open} onClose={onClose} title="账号与数据">
      {!cloud.user && (
        <p className="hint acct-localnote">
          你的课表、饮食和体重<b>默认只保存在这台设备上</b>，不用登录也能用，记得偶尔「导出」备份一下。{cloudEnabled ? '登录只是可选项——用来在手机和电脑之间自动同步。' : ''}
        </p>
      )}
      {cloudEnabled && (cloud.user ? <SignedIn cloud={cloud} /> : <SignIn />)}
      {cloud.user && <AgentKeys />}
      <DataBox data={data} update={update} signedIn={!!cloud.user} />
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
  // Supabase returns plain objects ({message, details, code}) for DB errors, not Error instances —
  // String() on those yields "[object Object]", so pull the human message out first.
  const raw =
    e instanceof Error
      ? e.message
      : e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e)
  const m = raw || '未知错误'
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
  return `【身体课表 · 只读数据接入说明】
你（AI）可以用下面这一个接口，「只读」地查看我的健身与饮食记录，用来帮我分析和陪伴。
请把这些当成事实记录：不要催促、不要打分；聊体重只看 7 天平均趋势，别盯着单次数字。

■ 怎么调用（需要你的运行环境能发 HTTP 请求，例如带代码执行/工具的 Agent）
POST ${supabaseUrl}/rest/v1/rpc/agent_summary
Headers:
  apikey: ${supabaseAnonKey}
  Content-Type: application/json
Body:
  {"token": "${token}", "include_data": false}
  · 想看完整原始数据（所有卡片、课表、记录）时，把 include_data 改成 true。

■ 返回结果怎么看
  · summary 为 null：说明我还没在「身体课表」里同步过数据，请提醒我先去登录。
  · summary.markdown：一份可直接读的人类周报，优先用它来回答我。
  · summary.this_week / next_week / last_4_weeks：本周/下周课表与完成情况、最近 4 周训练量。
  · summary.weight：体重（latest 最近一次、avg_7d 与 avg_7d_a_week_ago 两周 7 天均值、last_30d 明细）。
  · summary.diet_last_7d：最近 7 天手掌法饮食（蛋白质掌 / 蔬菜拳 / 主食捧 / 油脂拇指 的份数）。
  · include_data=true 时另有 data：完整原始数据。

■ 关于这把钥匙
  · 它只读、我随时可以作废；这是我的私密凭据，请不要原样回显给我，也不要写进任何公开内容或日志。

（如果你用的是支持 MCP 的客户端，也可以改用本项目自带的 mcp/server.mjs：
 配置环境变量 FIT_SUPABASE_URL / FIT_SUPABASE_KEY / FIT_TOKEN，效果相同，且无需手写请求。）`
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
      <p className="hint">
        让你的 AI 助手（ChatGPT / Claude / 通义 / QwenWork 等）<b>只读</b>地看你的健身记录，帮你分析。三步：
        <br />① 点「生成一把钥匙」→ ② 点「复制粘贴给 AI 的说明」，整段贴给 AI → ③ 它就能读你的课表、完成情况、体重趋势、饮食来陪你聊。
        <br />AI <b>改不了</b>任何东西，钥匙也随时能在下面作废。
      </p>
      {fresh ? (
        <div className="acct-fresh">
          <p className="hint">这把钥匙<b>只显示这一次</b>，先复制好；下面两个按钮，建议直接复制「粘贴给 AI 的说明」（已含钥匙和用法）。</p>
          <code className="acct-token">{fresh}</code>
          <div className="sheet-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => copy('key', fresh)}>{copied === 'key' ? '已复制 ✓' : '只复制钥匙'}</button>
            <button className="btn btn--yellow btn--sm" onClick={() => copy('prompt', agentPrompt(fresh))}>{copied === 'prompt' ? '已复制 ✓' : '复制粘贴给 AI 的说明'}</button>
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

function DataBox({ data, update, signedIn }: { data: AppData; update: Update; signedIn: boolean }) {
  const day = todayKey()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (!confirm('导入会用这份文件覆盖当前设备上的课表、饮食和体重记录（登录状态下也会覆盖云端）。确定吗？\n建议先点「完整数据 JSON」导出一个备份。')) return
    try {
      const parsed = parseBackup(await file.text())
      update(() => parsed)
      setMsg({ ok: true, text: `已导入 ${parsed.cards.length} 张卡片 · ${parsed.sessions.length} 节课${signedIn ? '，正在同步到云端…' : ''}` })
    } catch (err) {
      setMsg({ ok: false, text: friendly(err) })
    }
  }

  return (
    <div className="acct-box">
      <span className="hand-label">data</span>
      <p className="acct-title">备份与搬家</p>
      <p className="hint">完整数据（JSON）适合备份和换设备；导出后可以在任何设备用下面的「导入」还原。周报（Markdown）适合放进笔记，或直接丢给 AI 看。</p>
      <div className="sheet-actions">
        <button className="btn btn--ghost" onClick={() => download(`身体课表-${day}.json`, JSON.stringify({ exported_at: new Date().toISOString(), data }, null, 2), 'application/json')}>
          完整数据 JSON
        </button>
        <button className="btn btn--ghost" onClick={() => download(`身体课表周报-${day}.md`, buildSummary(data).markdown, 'text/markdown')}>
          周报 Markdown
        </button>
      </div>
      <button className="btn btn--blue" onClick={() => fileRef.current?.click()}>导入 JSON 备份</button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onPick} hidden />
      {msg && <p className={msg.ok ? 'acct-ok' : 'acct-err'}>{msg.text}</p>}
    </div>
  )
}
