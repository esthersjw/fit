import type { Card, Category, Focus, Intensity } from './types'

export interface Parsed { bvid?: string; url?: string; title?: string }

/** Accepts a bilibili URL, a bare BV id, or the app's share text "【标题-哔哩哔哩】 https://b23.tv/xxx". */
export function parseBiliInput(text: string): Parsed {
  const bvid = text.match(/BV[0-9A-Za-z]{10}/)?.[0]
  const url = text.match(/https?:\/\/[^\s【】]+/)?.[0]
  const title = text.match(/【(.+?)】/)?.[1]?.replace(/[-_]哔哩哔哩.*$/, '').trim()
  return { bvid, url: bvid && !url ? `https://www.bilibili.com/video/${bvid}` : url, title }
}

export interface BiliMeta { title: string; cover: string; minutes: number; owner: string }

/** B站 view API speaks JSONP, so this works from a static page without a proxy. */
export function fetchBiliMeta(bvid: string): Promise<BiliMeta> {
  return new Promise((resolve, reject) => {
    const cb = `__bili_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const w = window as unknown as Record<string, unknown>
    const done = () => {
      delete w[cb]
      script.remove()
      clearTimeout(timer)
    }
    const timer = setTimeout(() => (done(), reject(new Error('timeout'))), 8000)
    w[cb] = (res: { code: number; data?: { title: string; pic: string; duration: number; owner: { name: string } } }) => {
      done()
      if (res.code !== 0 || !res.data) return reject(new Error('not found'))
      const d = res.data
      resolve({
        title: d.title,
        cover: d.pic.replace(/^http:/, 'https:'),
        minutes: Math.max(1, Math.round(d.duration / 60)),
        owner: d.owner.name,
      })
    }
    script.onerror = () => (done(), reject(new Error('network')))
    script.src = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}&jsonp=jsonp&callback=${cb}`
    script.referrerPolicy = 'no-referrer'
    document.head.appendChild(script)
  })
}

/** Rough auto-tagging from the title — always editable afterwards. */
export function guessTags(title: string): Pick<Card, 'category' | 'focus' | 'intensity'> {
  const has = (re: RegExp) => re.test(title)
  const category: Category = has(/冥想|正念|NSDR|呼吸练习|身体扫描/i)
    ? 'mind'
    : has(/拳击|搏击|拳/)
    ? 'boxing'
    : has(/普拉提|瑜伽|pilates|yoga/i) && !has(/阴瑜伽|睡前/)
      ? 'pilates'
      : has(/拉伸|放松|舒缓|睡前|开肩|筋膜|阴瑜伽/)
        ? 'stretch'
        : has(/哑铃|壶铃|力量|增肌|无氧|塑形|练腿|练臀/)
          ? 'strength'
          : has(/爬坡|快走|徒步|跑步/)
            ? 'walk'
            : 'aerobic'
  const focus: Focus[] = []
  if (has(/腿|臀|下半身|下肢/)) focus.push('legs')
  if (has(/手臂|肩|背|上肢|拜拜肉|胸/)) focus.push('upper')
  if (has(/腰|腹|核心|马甲线/)) focus.push('core')
  if (!focus.length || has(/全身/)) focus.splice(0, focus.length, 'full')
  const intensity: Intensity = has(/HIIT|暴汗|高强度|燃爆|tabata/i) ? 3 : has(/新手|入门|睡前|无跳|温和|零基础|床上/) ? 1 : 2
  return { category, focus, intensity }
}

export const thumb = (cover?: string, w = 320, h = 200) =>
  cover && /hdslb\.com/.test(cover) ? `${cover}@${w}w_${h}h_1c.webp` : cover
