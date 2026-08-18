import { describe, expect, it } from 'vitest'
import { LIMITS, clampSettings, customPlateHeightMm, defaultSettings } from '../src/validate'

describe('clampSettings', () => {
  it('uses defaults when raw is empty', () => {
    const s = clampSettings({})
    expect(s.widthMm).toBe(LIMITS.widthMm.default)
    expect(s.heightMm).toBe(LIMITS.heightMm.default)
    expect(s.qrOffsetXMm).toBe(0)
    expect(s.qrOffsetYMm).toBe(0)
    expect(s.qrSizePercent).toBe(100)
    expect(s.blackHeightMm).toBe(LIMITS.blackHeightMm.min)
    expect(LIMITS.blackHeightMm.default).toBe(LIMITS.blackHeightMm.min)
    expect(s.capThicknessMm).toBe(LIMITS.capThicknessMm.default)
    expect(s.logoSizePercent).toBe(LIMITS.logoSizePercent.default)
    expect(s.style).toBe('square')
    expect(s.plateShape).toBe('square')
    expect(s.content).toBe('')
    expect(s.hasLogo).toBe(false)
    expect(s.dogtagHole).toBe(false)
    expect(s.holeDiameterMm).toBe(LIMITS.holeDiameterMm.default)
    expect(s.insetFrame).toBe(false)
    expect(s.blankLogo).toBe(false)
    expect(s.hollow).toBe(false)
    expect(s.lid).toBe(false)
    expect(s.cassetteLid).toBe(true)
    expect(s.cassetteSlider).toBe(true)
    expect(s.cassetteFlipSlider).toBe(false)
    expect(s.cassetteAccess).toBe(true)
    expect(s.extraQrs).toEqual([])
    expect(s.blackTexts).toEqual([])
    expect(s.blackImages).toEqual([])
    expect(s.plateShape).not.toBe('cassette')
    expect(s.blackHeightMm).toBe(LIMITS.blackHeightMm.min)
  })

  it('locks cassette to the printed 100.11 by 63.6 mm body', () => {
    const s = clampSettings({ plateShape: 'cassette' })
    expect(s.plateShape).toBe('cassette')
    expect(s.widthMm).toBeCloseTo(100.11)
    expect(s.heightMm).toBeCloseTo(63.6)
    expect(s.hollow).toBe(false)
    expect(s.lid).toBe(false)
    expect(s.dogtagHole).toBe(false)
    expect(clampSettings({ plateShape: 'cassette', widthMm: 80 }).widthMm).toBeCloseTo(100.11)
  })

  it('accepts a credit card plate at 85.6 by 53.98 mm', () => {
    const s = clampSettings({ plateShape: 'card' })
    expect(s.plateShape).toBe('card')
    expect(s.widthMm).toBeCloseTo(85.6)
    expect(s.heightMm).toBeCloseTo(53.98)
    expect(clampSettings({ plateShape: 'card', widthMm: 80 }).widthMm).toBe(80)
    expect(clampSettings({ plateShape: 'card', widthMm: 80 }).heightMm).toBeCloseTo(
      80 * (53.98 / 85.6),
    )
  })

  it('turns the lid off when the tag is not hollow', () => {
    expect(clampSettings({ lid: true }).lid).toBe(false)
    expect(clampSettings({ hollow: true, lid: true }).lid).toBe(true)
    expect(clampSettings({ hollow: true, lid: false }).lid).toBe(false)
  })

  it('snaps width below min to 30', () => {
    expect(clampSettings({ widthMm: 10 }).widthMm).toBe(30)
  })

  it('snaps width above max to 200', () => {
    expect(clampSettings({ widthMm: 900 }).widthMm).toBe(200)
  })

  it('snaps height to the same range as width', () => {
    expect(clampSettings({ heightMm: 10 }).heightMm).toBe(30)
    expect(clampSettings({ heightMm: 900 }).heightMm).toBe(200)
  })

  it('snaps black height and cap to range', () => {
    expect(clampSettings({ blackHeightMm: 0.1 }).blackHeightMm).toBe(0.6)
    expect(clampSettings({ blackHeightMm: 9 }).blackHeightMm).toBe(4)
    expect(clampSettings({ capThicknessMm: 0.1 }).capThicknessMm).toBe(0.4)
    expect(clampSettings({ capThicknessMm: 9 }).capThicknessMm).toBe(3)
  })

  it('snaps logo percent to 10–50', () => {
    expect(clampSettings({ logoSizePercent: 1 }).logoSizePercent).toBe(10)
    expect(clampSettings({ logoSizePercent: 90 }).logoSizePercent).toBe(50)
  })

  it('keeps in-range values', () => {
    const s = clampSettings({
      content: 'https://example.com',
      style: 'dots',
      plateShape: 'dogtag',
      widthMm: 100,
      heightMm: 50,
      qrOffsetXMm: 4,
      qrOffsetYMm: -2,
      qrSizePercent: 70,
      blackHeightMm: 2,
      capThicknessMm: 1,
      logoSizePercent: 25,
      hasLogo: true,
      dogtagHole: false,
      holeDiameterMm: 5,
      insetFrame: true,
      blankLogo: true,
      hollow: true,
      lid: true,
    })
    expect(s).toEqual({
      content: 'https://example.com',
      style: 'dots',
      plateShape: 'dogtag',
      widthMm: 100,
      heightMm: 50,
      qrOffsetXMm: 4,
      qrOffsetYMm: -2,
      qrSizePercent: 70,
      blackHeightMm: 2,
      capThicknessMm: 1,
      logoSizePercent: 25,
      hasLogo: true,
      dogtagHole: false,
      holeDiameterMm: 5,
      customAspect: 1,
      insetFrame: true,
      blankLogo: true,
      hollow: true,
      lid: true,
      cassetteLid: true,
      cassetteSlider: true,
      cassetteFlipSlider: false,
      cassetteAccess: true,
      extraQrs: [],
      blackTexts: [],
      blackImages: [],
    })
  })
})

describe('customPlateHeightMm', () => {
  it('uses width times aspect', () => {
    expect(customPlateHeightMm(80, 0.625)).toBeCloseTo(50)
    expect(customPlateHeightMm(80, 0)).toBeCloseTo(80)
  })
})

describe('defaultSettings', () => {
  it('matches spec defaults', () => {
    expect(defaultSettings()).toEqual(clampSettings({}))
  })
})
