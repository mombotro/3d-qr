import { describe, expect, it } from 'vitest'
import {
  CARD_ASPECT,
  CARD_CORNER_MM,
  CARD_DEFAULT_HEIGHT_MM,
  CARD_DEFAULT_WIDTH_MM,
} from '../src/card'
import { plateOutlineAt } from '../src/shapes'
import { pointInPolygon } from '../src/offset'

describe('credit card template', () => {
  it('uses ISO ID-1 size 85.6 by 53.98 mm', () => {
    expect(CARD_DEFAULT_WIDTH_MM).toBeCloseTo(85.6)
    expect(CARD_DEFAULT_HEIGHT_MM).toBeCloseTo(53.98)
    expect(CARD_ASPECT).toBeCloseTo(53.98 / 85.6)
    expect(CARD_CORNER_MM).toBeCloseTo(3.18)
  })

  it('rounds the card corners so the sharp corner is outside the outline', () => {
    const p = plateOutlineAt('card', CARD_DEFAULT_WIDTH_MM, CARD_DEFAULT_HEIGHT_MM)
    expect(p.length).toBeGreaterThan(8)
    expect(pointInPolygon({ x: 0, y: 0 }, p)).toBe(false)
    expect(
      pointInPolygon({ x: CARD_DEFAULT_WIDTH_MM / 2, y: CARD_DEFAULT_HEIGHT_MM / 2 }, p),
    ).toBe(true)
  })
})
