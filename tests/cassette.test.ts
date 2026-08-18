import { describe, expect, it } from 'vitest'
import {
  CASSETTE_ASPECT,
  CASSETTE_HEAD_STRIP_RAISE_MM,
  cassetteHeadStrip,
  cassettePlate,
} from '../src/cassette'
import { pointInPolygon } from '../src/offset'

describe('cassettePlate', () => {
  it('uses the printed 100.11 by 63.6 mm plate', () => {
    expect(CASSETTE_ASPECT).toBeCloseTo(63.6 / 100.11)
    const plate = cassettePlate()
    expect(plate.aspect).toBeCloseTo(63.6 / 100.11)
  })

  it('rounds the outer corners a little', () => {
    const plate = cassettePlate()
    expect(plate.outer.length).toBeGreaterThan(8)
    expect(pointInPolygon({ x: 0, y: 0 }, plate.outer)).toBe(false)
    expect(pointInPolygon({ x: 0.5, y: plate.aspect / 2 }, plate.outer)).toBe(true)
  })

  it('has two spindle holes and no extra through-hole', () => {
    const plate = cassettePlate()
    expect(plate.holes).toHaveLength(2)
    const w = 100.11
    const left = { x: 28.5 / w, y: (63.6 - 35) / w }
    const right = { x: 71.65 / w, y: (63.6 - 35) / w }
    const inHole = (p: { x: number; y: number }) =>
      plate.holes.some((h) => pointInPolygon(p, h))
    expect(inHole(left)).toBe(true)
    expect(inHole(right)).toBe(true)
    expect(inHole({ x: 0.5, y: (63.6 - 14.78) / w })).toBe(false)
    expect(pointInPolygon({ x: 0.5, y: plate.aspect / 2 }, plate.outer)).toBe(true)
    expect(inHole({ x: 0.5, y: plate.aspect / 2 })).toBe(false)
  })
})

describe('cassetteHeadStrip', () => {
  it('is a centered cassette window, flush at the bottom, with angled top corners', () => {
    expect(CASSETTE_HEAD_STRIP_RAISE_MM).toBe(1)
    const width = 80
    const height = 80 * CASSETTE_ASPECT
    const strip = cassetteHeadStrip(width, height)
    const xs = strip.map((p) => p.x)
    const ys = strip.map((p) => p.y)
    expect(Math.max(...ys)).toBeCloseTo(height)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(width * 0.75)
    expect(Math.min(...xs)).toBeGreaterThan(width * 0.1)
    expect(Math.max(...xs)).toBeLessThan(width * 0.9)
    const topY = Math.min(...ys)
    const topXs = strip.filter((p) => Math.abs(p.y - topY) < 1e-6).map((p) => p.x)
    expect(Math.max(...topXs) - Math.min(...topXs)).toBeLessThan(width * 0.75 - 1)
    const leftHole = { x: (83.33 / 288) * width, y: (77.48 / 288) * width }
    expect(pointInPolygon(leftHole, strip)).toBe(false)
  })
})


