import { describe, expect, it } from 'vitest'
import { isTextFontId, maskToPlacedShapes, textFontCss, textToShapes } from '../src/text'
import { clampSettings } from '../src/validate'

describe('text fonts', () => {
  it('accepts the built-in ids and rejects others', () => {
    expect(isTextFontId('sans')).toBe(true)
    expect(isTextFontId('serif')).toBe(true)
    expect(isTextFontId('mono')).toBe(true)
    expect(isTextFontId('comic')).toBe(false)
    expect(textFontCss('nope')).toContain('sans-serif')
  })
})

describe('textToShapes', () => {
  it('returns nothing for empty text', () => {
    expect(textToShapes('', 'sans', 0, 0, 6)).toEqual([])
    expect(textToShapes('   ', 'sans', 0, 0, 6)).toEqual([])
  })
})

describe('maskToPlacedShapes', () => {
  it('places a dark block at the given origin and height', () => {
    const mask = Array.from({ length: 10 }, () => Array<boolean>(8).fill(false))
    for (let y = 2; y < 8; y++) {
      for (let x = 1; x < 7; x++) mask[y][x] = true
    }
    const shapes = maskToPlacedShapes(mask, 10, 20, 12)
    expect(shapes.length).toBe(1)
    const xs = shapes[0].outer.map((p) => p.x)
    const ys = shapes[0].outer.map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(10)
    expect(Math.min(...ys)).toBeCloseTo(20)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(12)
  })
})

describe('clampSettings text', () => {
  it('keeps a label and snaps size', () => {
    const s = clampSettings({
      blackTexts: [{ text: 'HELLO', font: 'mono', sizeMm: 80, xMm: 12, yMm: 8 }],
      blackImages: [{ sizeMm: 90, xMm: 3, yMm: 5 }],
    })
    expect(s.blackTexts).toHaveLength(1)
    expect(s.blackTexts[0]?.text).toBe('HELLO')
    expect(s.blackTexts[0]?.font).toBe('mono')
    expect(s.blackTexts[0]?.sizeMm).toBe(40)
    expect(s.blackTexts[0]?.xMm).toBe(12)
    expect(s.blackImages[0]?.sizeMm).toBe(60)
    expect(clampSettings({ blackTexts: [{ text: 'A', font: 'papyrus', sizeMm: 6, xMm: 0, yMm: 0 }] }).blackTexts[0]?.font).toBe(
      'sans',
    )
  })

  it('keeps several text and image stamps', () => {
    const s = clampSettings({
      blackTexts: [
        { text: 'ONE', font: 'sans', sizeMm: 6, xMm: 2, yMm: 2 },
        { text: 'TWO', font: 'mono', sizeMm: 8, xMm: 10, yMm: 4 },
      ],
      blackImages: [
        { sizeMm: 8, xMm: 1, yMm: 1 },
        { sizeMm: 12, xMm: 20, yMm: 8 },
      ],
    })
    expect(s.blackTexts).toHaveLength(2)
    expect(s.blackTexts[1]?.text).toBe('TWO')
    expect(s.blackImages).toHaveLength(2)
    expect(s.blackImages[1]?.xMm).toBe(20)
  })

  it('keeps several extra QR stamps and snaps size', () => {
    const s = clampSettings({
      extraQrs: [
        { content: 'https://a.example', sizePercent: 10, xMm: 8, yMm: -4 },
        { content: 'https://b.example', sizePercent: 300, xMm: 0, yMm: 6 },
      ],
    })
    expect(s.extraQrs).toHaveLength(2)
    expect(s.extraQrs[0]?.content).toBe('https://a.example')
    expect(s.extraQrs[0]?.sizePercent).toBe(40)
    expect(s.extraQrs[0]?.xMm).toBe(8)
    expect(s.extraQrs[0]?.blankLogo).toBe(false)
    expect(s.extraQrs[0]?.logoSizePercent).toBe(20)
    expect(s.extraQrs[1]?.sizePercent).toBe(200)
    expect(
      clampSettings({
        extraQrs: [{ content: 'https://c.example', sizePercent: 50, xMm: 0, yMm: 0, blankLogo: true, logoSizePercent: 80 }],
      }).extraQrs[0],
    ).toMatchObject({ blankLogo: true, logoSizePercent: 50 })
  })
})
