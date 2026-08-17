import { describe, expect, it } from 'vitest'
import { circlePoly, frameRing, modulePoly, roundedPoly, squarePoly } from '../src/shapes'

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
