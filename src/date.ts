export const pad = (n: number) => String(n).padStart(2, '0')

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (k: string, n: number) => {
  const d = fromKey(k)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export const todayKey = () => toKey(new Date())

/** Monday of the week containing k */
export const weekStart = (k: string) => {
  const day = fromKey(k).getDay() // 0 = Sun
  return addDays(k, day === 0 ? -6 : 1 - day)
}

export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i))

export const diffDays = (a: string, b: string) =>
  Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86400000)

const WD = ['日', '一', '二', '三', '四', '五', '六']
export const weekdayLabel = (k: string) => `周${WD[fromKey(k).getDay()]}`
export const md = (k: string) => {
  const d = fromKey(k)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
