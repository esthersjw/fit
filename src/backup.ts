import type { AppData } from './types'
import { migrate } from './store'

/**
 * Turn an exported backup file back into app data, so a local-first user can move devices
 * or restore a backup without ever logging in. Accepts both shapes we produce in-app:
 * the wrapped export (`{ exported_at, data }`) and a bare data object (e.g. cloud `user_data.data`).
 * Throws a Chinese message on anything that clearly isn't a 身体课表 backup.
 */
export function parseBackup(raw: string): AppData {
  let all: unknown
  try {
    all = JSON.parse(raw)
  } catch {
    throw new Error('这个文件不是有效的 JSON')
  }
  if (!all || typeof all !== 'object') throw new Error('文件内容是空的或不对')
  const wrapped = 'data' in all && (all as { data: unknown }).data && typeof (all as { data: unknown }).data === 'object'
  const d = (wrapped ? (all as { data: Record<string, unknown> }).data : (all as Record<string, unknown>)) as Record<string, unknown>

  if (!Array.isArray(d.cards) || !Array.isArray(d.sessions)) throw new Error('没找到课表或卡片，可能不是「身体课表」导出的 JSON')

  const isObj = (x: unknown): x is Record<string, never> => !!x && typeof x === 'object' && !Array.isArray(x)
  const dpw = typeof d.daysPerWeek === 'number' && Number.isFinite(d.daysPerWeek) ? d.daysPerWeek : 3

  const base: AppData = {
    cards: d.cards as AppData['cards'],
    sessions: d.sessions.filter((s) => s && typeof s === 'object' && 'cardId' in s && 'date' in s) as AppData['sessions'],
    meals: isObj(d.meals) ? (d.meals as AppData['meals']) : {},
    weights: isObj(d.weights) ? (d.weights as AppData['weights']) : {},
    feelings: isObj(d.feelings) ? (d.feelings as AppData['feelings']) : {},
    daysPerWeek: Math.min(6, Math.max(1, Math.round(dpw))),
    seedVersion: typeof d.seedVersion === 'number' ? d.seedVersion : 1,
  }
  return migrate(base)
}
