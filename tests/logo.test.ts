import { describe, expect, it } from 'vitest'
import {
  applyLogoClear,
  clampLogoPercent,
  clipMaskToCircle,
  logoClearRect,
  logoSizePercentForMm,
  luminance,
  maskToPolygons,
  thresholdMask,
} from '../src/logo'
import { encodeQr } from '../src/encode'
import { isFinderCell } from '../src/layout'

describe('thresholdMask', () => {
  it('marks dark pixels true and light pixels false', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])
    const mask = thresholdMask(rgba, 2, 1)
    expect(mask[0][0]).toBe(true)
    expect(mask[0][1]).toBe(false)
  })
})

describe('luminance', () => {
  it('is 0 for black and 255 for white', () => {
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(255, 255, 255)).toBe(255)
  })
})

describe('logoClearRect', () => {
  it('centers a 20 percent window on a 25 module code', () => {
    const r = logoClearRect(25, 20)
    expect(r.r1 - r.r0).toBe(5)
    expect(r.c1 - r.c0).toBe(5)
    expect(r.r0).toBe(10)
    expect(r.c0).toBe(10)
  })
})

describe('applyLogoClear', () => {
  it('clears center data cells and leaves finders dark', () => {
    const q = encodeQr('https://example.com', true)
    const cleared = applyLogoClear(q.modules, 20)
    const { r0, c0, r1, c1 } = logoClearRect(q.size, 20)
    let clearedData = 0
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        if (!isFinderCell(q.size, r, c) && q.modules[r][c] && !cleared[r][c]) {
          clearedData += 1
        }
      }
    }
    expect(clearedData).toBeGreaterThan(0)
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        expect(cleared[r][c]).toBe(q.modules[r][c])
      }
    }
  })
})

describe('logoSizePercentForMm', () => {
  it('picks a module window near the requested millimetres', () => {
    const percent = logoSizePercentForMm(10, 1, 25)
    expect(logoClearRect(25, percent).r1 - logoClearRect(25, percent).r0).toBe(10)
  })
})

describe('clipMaskToCircle', () => {
  it('keeps the center and clears a corner', () => {
    const n = 8
    const mask = Array.from({ length: n }, () => Array<boolean>(n).fill(true))
    const clipped = clipMaskToCircle(mask)
    expect(clipped[4][4]).toBe(true)
    expect(clipped[0][0]).toBe(false)
  })
})

describe('clampLogoPercent', () => {
  it('allows 50 percent on a version 1 code', () => {
    expect(clampLogoPercent(50, 21)).toBe(50)
    expect(clampLogoPercent(90, 21)).toBe(50)
  })
})

describe('maskToPolygons', () => {
  it('emits one square for a single dark pixel', () => {
    const mask = [[true]]
    const polys = maskToPolygons(mask, 10, 20, 5, 5)
    expect(polys).toEqual([
      [
        { x: 10, y: 20 },
        { x: 15, y: 20 },
        { x: 15, y: 25 },
        { x: 10, y: 25 },
      ],
    ])
  })

  it('merges a solid block into one rectangle', () => {
    const mask = [
      [true, true],
      [true, true],
    ]
    const polys = maskToPolygons(mask, 10, 20, 8, 8)
    expect(polys).toHaveLength(1)
    expect(polys[0]).toEqual([
      { x: 10, y: 20 },
      { x: 18, y: 20 },
      { x: 18, y: 28 },
      { x: 10, y: 28 },
    ])
  })

  it('caps a large photo mask so a rebuild stays small', () => {
    const n = 128
    const mask = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => (r + c) % 3 !== 0),
    )
    const polys = maskToPolygons(mask, 0, 0, 20, 20)
    expect(polys.length).toBeLessThan(800)
    expect(polys.length).toBeGreaterThan(0)
  })
})
