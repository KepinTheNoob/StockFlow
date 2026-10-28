import { describe, it, expect } from 'vitest'
import { formatRupiah, formatTimeAgo } from './format'

describe('formatRupiah', () => {
  it('formats positive integers to Indonesian Rupiah without decimals', () => {
    const formatted = formatRupiah(18999000).replace(/\s/g, ' ')
    expect(formatted).toContain('18.999.000')
    expect(formatted).toContain('Rp')
  })

  it('formats zero correctly', () => {
    const formatted = formatRupiah(0).replace(/\s/g, ' ')
    expect(formatted).toContain('0')
    expect(formatted).toContain('Rp')
  })
})

describe('formatTimeAgo', () => {
  it('returns "-" for null or empty input', () => {
    expect(formatTimeAgo(null)).toBe('-')
    expect(formatTimeAgo('')).toBe('-')
  })

  it('returns "Just now" for dates within 60 seconds', () => {
    const now = new Date().toISOString()
    expect(formatTimeAgo(now)).toBe('Just now')
  })

  it('returns relative minutes for dates within an hour', () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(formatTimeAgo(tenMinutesAgo)).toBe('10m ago')
  })

  it('returns relative hours for dates within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago')
  })
})
