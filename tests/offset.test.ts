import { describe, expect, it } from 'vitest'
import { cleanRing, insetPolygon, offsetPolygon, pointInPolygon } from '../src/offset'
import { squarePoly } from '../src/shapes'

describe('cleanRing', () => {
  it('drops a collinear midpoint', () => {
    const ring = cleanRing([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ])
    expect(ring).toHaveLength(4)
  })
})

describe('offsetPolygon', () => {
  it('grows a 10 mm square by 0.2 mm on each side', () => {
    const grown = offsetPolygon(squarePoly(10, 10, 10), 0.2)
    expect(pointInPolygon({ x: 9.9, y: 15 }, grown)).toBe(true)
    expect(pointInPolygon({ x: 9.7, y: 15 }, grown)).toBe(false)
    expect(pointInPolygon({ x: 15, y: 15 }, grown)).toBe(true)
  })
})

describe('insetPolygon', () => {
  it('shrinks a square regardless of winding', () => {
    const ccw = squarePoly(0, 0, 10)
    const cw = [...ccw].reverse()
    for (const poly of [ccw, cw]) {
      const inner = insetPolygon(poly, 1)
      expect(pointInPolygon({ x: 5, y: 5 }, inner)).toBe(true)
      expect(pointInPolygon({ x: 0.5, y: 5 }, inner)).toBe(false)
    }
  })
})
