import { describe, expect, it } from 'vitest'
import { offsetPolygon, pointInPolygon } from '../src/offset'
import { squarePoly } from '../src/shapes'

describe('offsetPolygon', () => {
  it('grows a 10 mm square by 0.2 mm on each side', () => {
    const grown = offsetPolygon(squarePoly(10, 10, 10), 0.2)
    expect(pointInPolygon({ x: 9.9, y: 15 }, grown)).toBe(true)
    expect(pointInPolygon({ x: 9.7, y: 15 }, grown)).toBe(false)
    expect(pointInPolygon({ x: 15, y: 15 }, grown)).toBe(true)
  })
})
