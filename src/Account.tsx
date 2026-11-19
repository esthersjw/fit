import { useRef, useState } from 'react'
import type { AppData } from './types'
import type { Update } from './store'
import { Sheet } from './ui'
import { parseBackup } from './backup'
import { buildSummary } from './summary'
import { todayKey } from './date'

/** Header button → opens the local data panel. */
export function AccountButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="acct-btn" onClick={onOpen} aria-label="数据">
      <i className="acct-dot" />
      数据
    </button>
  )
}

export function AccountSheet({ open, onClose, data, update }: { open: boolean; onClose: () => void; data: AppData; update: Update }) {
  return (
    <Sheet open={open} onClose={onClose} title="数据">
      <p className="hint acct-localnote">
        你的课表、饮食和体重<b>只保存在这台设备上</b>，不用登录、离线也能用。换设备或想备份，就用下面的「导出 / 导入」。
      </p>
      <DataBox data={data} update={update} />
    </Sheet>
  )
}

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Surface a plain message from an Error or a Supabase-style {message} object (never "[object Object]"). */
function friendly(e: unknown): string {
  const m =
    e instanceof Error
      ? e.message
      : e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e)
  return m || '未知错误'
}

function DataBox({ data, update }: { data: AppData; update: Update }) {
  const day = todayKey()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (!confirm('导入会用这份文件覆盖当前设备上的课表、饮食和体重记录。确定吗？\n建议先点「完整数据 JSON」导出一个备份。')) return
    try {
      const parsed = parseBackup(await file.text())
      update(() => parsed)
      setMsg({ ok: true, text: `已导入 ${parsed.cards.length} 张卡片 · ${parsed.sessions.length} 节课` })
    } catch (err) {
      setMsg({ ok: false, text: friendly(err) })
    }
  }

  return (
    <div className="acct-box">
      <span className="hand-label">data</span>
      <p className="acct-title">备份与搬家</p>
      <p className="hint">
        完整数据（JSON）才是能<b>还原/搬家</b>的备份：导出后在任何设备点「导入」就能恢复。
        周报（Markdown）只是给人看的摘要，<b>不能</b>导回来。
      </p>
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
