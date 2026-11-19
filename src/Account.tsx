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
    if (!confirm('导入会用这份备份覆盖当前设备上的课表、卡片、饮食和体重记录。确定吗？\n（建议先在旧设备点「导出备份」留个底。）')) return
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
        备份就是一个 <b>JSON 文件</b>，里面装着你的全部数据（卡片库、课表、饮食、体重）。
        换手机/电脑时：在旧设备「导出备份」，在新设备「导入备份」即可。
      </p>
      <div className="sheet-actions">
        <button className="btn btn--blue" onClick={() => download(`身体课表-备份-${day}.json`, JSON.stringify({ exported_at: new Date().toISOString(), data }, null, 2), 'application/json')}>
          导出备份
        </button>
        <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>导入备份</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onPick} hidden />
      {msg && <p className={msg.ok ? 'acct-ok' : 'acct-err'}>{msg.text}</p>}
      <button className="btn btn--ghost" onClick={() => download(`身体课表周报-${day}.md`, buildSummary(data).markdown, 'text/markdown')}>
        导出周报（看 / 分享用，不能导回）
      </button>
    </div>
  )
}
