import { describe, expect, it } from 'vitest'
import { LIMITS, clampSettings, defaultSettings } from '../src/validate'

describe('clampSettings', () => {
  it('uses defaults when raw is empty', () => {
    const s = clampSettings({})
    expect(s.widthMm).toBe(LIMITS.widthMm.default)
    expect(s.blackHeightMm).toBe(LIMITS.blackHeightMm.default)
    expect(s.capThicknessMm).toBe(LIMITS.capThicknessMm.default)
    expect(s.logoSizePercent).toBe(LIMITS.logoSizePercent.default)
    expect(s.style).toBe('square')
    expect(s.content).toBe('')
    expect(s.hasLogo).toBe(false)
  })

  it('snaps width below min to 30', () => {
    expect(clampSettings({ widthMm: 10 }).widthMm).toBe(30)
  })

  it('snaps width above max to 200', () => {
    expect(clampSettings({ widthMm: 900 }).widthMm).toBe(200)
  })

  it('snaps black height and cap to range', () => {
    expect(clampSettings({ blackHeightMm: 0.1 }).blackHeightMm).toBe(0.6)
    expect(clampSettings({ blackHeightMm: 9 }).blackHeightMm).toBe(4)
    expect(clampSettings({ capThicknessMm: 0.1 }).capThicknessMm).toBe(0.4)
    expect(clampSettings({ capThicknessMm: 9 }).capThicknessMm).toBe(3)
  })

  it('snaps logo percent to 10–30', () => {
    expect(clampSettings({ logoSizePercent: 1 }).logoSizePercent).toBe(10)
    expect(clampSettings({ logoSizePercent: 90 }).logoSizePercent).toBe(30)
  })

  it('keeps in-range values', () => {
    const s = clampSettings({
      content: 'https://example.com',
      style: 'dots',
      widthMm: 100,
      blackHeightMm: 2,
      capThicknessMm: 1,
      logoSizePercent: 25,
      hasLogo: true,
    })
    expect(s).toEqual({
      content: 'https://example.com',
      style: 'dots',
      widthMm: 100,
      blackHeightMm: 2,
      capThicknessMm: 1,
      logoSizePercent: 25,
      hasLogo: true,
    })
  })
})

describe('defaultSettings', () => {
  it('matches spec defaults', () => {
    expect(defaultSettings()).toEqual(clampSettings({}))
  })
})
