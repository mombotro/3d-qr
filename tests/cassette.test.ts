import { describe, expect, it } from 'vitest'
import {
  CASSETTE_ASPECT,
  CASSETTE_HEAD_STRIP_RAISE_MM,
  cassetteHeadStrip,
  cassettePlate,
} from '../src/cassette'
import { pointInPolygon } from '../src/offset'

describe('cassettePlate', () => {
  it('uses the cassette.svg viewBox aspect', () => {
    expect(CASSETTE_ASPECT).toBeCloseTo(180 / 288)
    const plate = cassettePlate()
    expect(plate.aspect).toBeCloseTo(180 / 288)
  })

  it('rounds the outer corners a little', () => {
    const plate = cassettePlate()
    expect(plate.outer.length).toBeGreaterThan(8)
    expect(pointInPolygon({ x: 0, y: 0 }, plate.outer)).toBe(false)
    expect(pointInPolygon({ x: 0.5, y: plate.aspect / 2 }, plate.outer)).toBe(true)
  })

  it('has two spindle holes from cassette.svg', () => {
    const plate = cassettePlate()
    expect(plate.holes).toHaveLength(2)
    const left = { x: 83.33 / 288, y: 77.48 / 288 }
    const right = { x: 203.67 / 288, y: 77.48 / 288 }
    expect(pointInPolygon(left, plate.holes[0]) || pointInPolygon(left, plate.holes[1])).toBe(true)
    expect(pointInPolygon(right, plate.holes[0]) || pointInPolygon(right, plate.holes[1])).toBe(true)
    expect(pointInPolygon({ x: 0.5, y: plate.aspect / 2 }, plate.outer)).toBe(true)
    expect(pointInPolygon({ x: 0.5, y: plate.aspect / 2 }, plate.holes[0])).toBe(false)
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


