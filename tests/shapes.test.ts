import { describe, expect, it } from 'vitest'
import {
  circlePoly,
  dogtagHole,
  frameRing,
  hexagonFlatTop,
  modulePoly,
  plateOutlineAt,
  roundedPoly,
  squarePoly,
} from '../src/shapes'

describe('squarePoly', () => {
  it('has four corners of the cell', () => {
    expect(squarePoly(1, 2, 3)).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 5 },
      { x: 1, y: 5 },
    ])
  })
})

describe('roundedPoly', () => {
  it('uses more than 4 points and stays inside the cell', () => {
    const p = roundedPoly(0, 0, 10, 0.3)
    expect(p.length).toBeGreaterThan(8)
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(-1e-9)
      expect(q.y).toBeGreaterThanOrEqual(-1e-9)
      expect(q.x).toBeLessThanOrEqual(10 + 1e-9)
      expect(q.y).toBeLessThanOrEqual(10 + 1e-9)
    }
  })
})

describe('circlePoly', () => {
  it('stays on a 9 mm diameter when size is 10', () => {
    const p = circlePoly(5, 5, 9, 24)
    expect(p.length).toBe(24)
    for (const q of p) {
      const d = Math.hypot(q.x - 5, q.y - 5)
      expect(d).toBeCloseTo(4.5, 5)
    }
  })
})

describe('modulePoly', () => {
  it('keeps finders square even for dots', () => {
    expect(modulePoly('dots', 0, 0, 2, true)).toEqual(squarePoly(0, 0, 2))
  })
  it('uses a circle for a data module in dots style', () => {
    const p = modulePoly('dots', 0, 0, 10, false)
    expect(p.length).toBe(24)
  })
})

describe('hexagonFlatTop', () => {
  it('has six vertices and height equal to flat-to-flat', () => {
    const h = hexagonFlatTop(80)
    expect(h).toHaveLength(6)
    const ys = h.map((p) => p.y)
    const xs = h.map((p) => p.x)
    expect(Math.min(...ys)).toBeCloseTo(0)
    expect(Math.max(...ys)).toBeCloseTo(80)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo((80 * 2) / Math.sqrt(3))
  })
})

describe('plateOutlineAt', () => {
  it('makes a circle of the given diameter', () => {
    const p = plateOutlineAt('circle', 80, 80)
    expect(p.length).toBe(64)
    for (const q of p) {
      expect(Math.hypot(q.x - 40, q.y - 40)).toBeCloseTo(40, 5)
    }
  })

  it('makes a rectangle of the given size', () => {
    const p = plateOutlineAt('rect', 80, 50)
    expect(p).toEqual([
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 50 },
      { x: 0, y: 50 },
    ])
  })

  it('puts the dog tag hole near the left end on a wide tag', () => {
    const hole = dogtagHole(80, 40)
    expect(hole.cx).toBeGreaterThan(6)
    expect(hole.cx).toBeLessThan(14)
    expect(hole.cy).toBeCloseTo(20)
    expect(hole.diameter).toBe(4)
    const wide = dogtagHole(80, 40, 8)
    expect(wide.diameter).toBe(8)
  })

  it('makes a dogtag that reaches both rounded ends', () => {
    const p = plateOutlineAt('dogtag', 80, 40)
    const xs = p.map((q) => q.x)
    const ys = p.map((q) => q.y)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(80)
    expect(Math.min(...ys)).toBeCloseTo(0)
    expect(Math.max(...ys)).toBeCloseTo(40)
    expect(p.length).toBeGreaterThan(8)
  })
})

describe('frameRing', () => {
  it('insets the hole by the frame width', () => {
    const f = frameRing(80, 4)
    expect(f.outer[0]).toEqual({ x: 0, y: 0 })
    expect(f.hole).toEqual([
      { x: 4, y: 4 },
      { x: 76, y: 4 },
      { x: 76, y: 76 },
      { x: 4, y: 76 },
    ])
  })
})
