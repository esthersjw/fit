import { describe, expect, it } from 'vitest'
import { extractBvids } from './bili'

describe('extractBvids (batch import)', () => {
  it('pulls BV ids out of links, share text and bare ids, deduped in order', () => {
    const text = [
      'https://www.bilibili.com/video/BV1sA411Q7R3/',
      '【周六野 30分钟有氧-哔哩哔哩】 https://b23.tv/AbCdEf BV1AE4ZecEfy',
      'BV1sA411Q7R3', // duplicate
      'BV1FZ421T7hn',
    ].join('\n')
    expect(extractBvids(text)).toEqual(['BV1sA411Q7R3', 'BV1AE4ZecEfy', 'BV1FZ421T7hn'])
  })

  it('returns nothing for text without BV ids', () => {
    expect(extractBvids('随便写点什么 https://example.com')).toEqual([])
  })
})
