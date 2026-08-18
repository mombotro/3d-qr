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
      blackText: 'HELLO',
      blackTextFont: 'mono',
      blackTextSizeMm: 80,
      blackTextXMm: 12,
      blackTextYMm: 8,
    })
    expect(s.blackText).toBe('HELLO')
    expect(s.blackTextFont).toBe('mono')
    expect(s.blackTextSizeMm).toBe(40)
    expect(s.blackTextXMm).toBe(12)
    expect(s.blackTextYMm).toBe(8)
    expect(clampSettings({ blackTextFont: 'papyrus' }).blackTextFont).toBe('sans')
    expect(clampSettings({ blackImageSizeMm: 1 }).blackImageSizeMm).toBe(2)
    expect(clampSettings({ blackImageSizeMm: 90 }).blackImageSizeMm).toBe(60)
  })
})
