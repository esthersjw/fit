export type Category = 'aerobic' | 'boxing' | 'strength' | 'pilates' | 'stretch' | 'mind' | 'walk'
export type Focus = 'legs' | 'upper' | 'core' | 'full'
export type Intensity = 1 | 2 | 3

export interface Card {
  id: string
  kind: 'video' | 'coach'
  title: string
  category: Category
  focus: Focus[]
  intensity: Intensity
  minutes: number
  stars: 1 | 2 | 3
  /** short name shown on timetable blocks */
  short?: string
  /** Removed from this person's library; kept so past sessions still count. */
  archived?: boolean
  // video
  bvid?: string
  url?: string
  cover?: string
  owner?: string
  // coach
  coach?: string
  place?: string
  note?: string
}

export interface Session {
  id: string
  cardId: string
  date: string // YYYY-MM-DD
  time?: string // HH:MM, used by coach classes
  done: boolean
  locked: boolean // manually placed — auto-schedule keeps it
}

export type MealKey = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export interface Palm { protein: number; veg: number; carb: number; fat: number }
export interface DayMeals { meals: Partial<Record<MealKey, Palm>>; note?: string }

export type Feeling = 'good' | 'ok' | 'tired'

export interface AppData {
  cards: Card[]
  sessions: Session[]
  meals: Record<string, DayMeals>
  weights: Record<string, number>
  feelings: Record<string, Feeling>
  daysPerWeek: number
  seedVersion?: number
}

export const CATEGORY: Record<Category, { label: string; color: string; ink: string }> = {
  aerobic: { label: '有氧·尊巴', color: '#F4D758', ink: '#7a6400' },
  boxing: { label: '拳击', color: '#E84A5F', ink: '#E84A5F' },
  strength: { label: '力量', color: '#2B7FD8', ink: '#2B7FD8' },
  pilates: { label: '普拉提·瑜伽', color: '#2d6a4f', ink: '#2d6a4f' },
  stretch: { label: '拉伸', color: '#c9a27a', ink: '#8a6440' },
  mind: { label: '冥想', color: '#b5838d', ink: '#8c5560' },
  walk: { label: '户外·爬坡', color: '#d98c4a', ink: '#a85f22' },
}

export const FOCUS: Record<Focus, string> = { legs: '腿臀', upper: '上肢', core: '核心', full: '全身' }
export const INTENSITY: Record<Intensity, string> = { 1: '轻松', 2: '适中', 3: '暴汗' }

/** A short name for tight spots (timetable blocks): the card's own `short`, else a trimmed title. */
export function cardName(c: Card): string {
  if (c.kind === 'coach') return c.coach ? `私教·${c.coach}` : c.title
  if (c.short?.trim()) return c.short.trim()
  const t = c.title.split(/[｜|【】\[\]]/).map((x) => x.trim()).filter(Boolean)[0] ?? c.title
  return t.replace(/\d+\s*(分钟|min|mins|分)/gi, '').trim().slice(0, 10) || c.title.slice(0, 10)
}
