import { describe, expect, it } from 'vitest'
import {
  customFrame,
  insetCustomOutline,
  maskToCustomPlate,
  maskToShapes,
  scaleCustomPlate,
} from '../src/contour'
import { pointInPolygon } from '../src/offset'
import { parseSvgSize, svgRasterSize } from '../src/svgSize'

function rectMask(w: number, h: number, hole?: { x: number; y: number; s: number }): boolean[][] {
  const mask = Array.from({ length: h }, () => Array<boolean>(w).fill(false))
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) mask[y][x] = true
  }
  if (hole) {
    for (let y = hole.y; y < hole.y + hole.s; y++) {
      for (let x = hole.x; x < hole.x + hole.s; x++) mask[y][x] = false
    }
  }
  return mask
}

describe('maskToCustomPlate', () => {
  it('reads a solid rectangle as one outer ring', () => {
    const plate = maskToCustomPlate(rectMask(20, 12))
    expect(plate).not.toBeNull()
    expect(plate!.holes).toHaveLength(0)
    expect(plate!.aspect).toBeGreaterThan(0.3)
    expect(plate!.aspect).toBeLessThan(0.8)
    expect(plate!.outer.length).toBeGreaterThan(3)
  })

  it('keeps an inner hole', () => {
    const plate = maskToCustomPlate(rectMask(24, 24, { x: 9, y: 9, s: 6 }))
    expect(plate).not.toBeNull()
    expect(plate!.holes.length).toBeGreaterThanOrEqual(1)
    const mid = { x: 0.5, y: plate!.aspect / 2 }
    expect(pointInPolygon(mid, plate!.outer)).toBe(true)
    expect(pointInPolygon(mid, plate!.holes[0])).toBe(true)
  })
})

describe('maskToShapes', () => {
  it('traces two separate blobs', () => {
    const mask = Array.from({ length: 12 }, () => Array<boolean>(20).fill(false))
    for (let y = 2; y < 8; y++) {
      for (let x = 2; x < 6; x++) mask[y][x] = true
      for (let x = 12; x < 16; x++) mask[y][x] = true
    }
    const shapes = maskToShapes(mask)
    expect(shapes.length).toBe(2)
    expect(shapes.every((s) => s.outer.length >= 3)).toBe(true)
  })
})

describe('scaleCustomPlate', () => {
  it('scales unit outline to the given width and keeps aspect', () => {
    const unit = maskToCustomPlate(rectMask(20, 10))!
    const scaled = scaleCustomPlate(unit, 80)
    const xs = scaled.outer.map((p) => p.x)
    const ys = scaled.outer.map((p) => p.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(80, 0)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(80 * unit.aspect, 0)
  })
})

describe('svg size', () => {
  it('reads the TEST tag viewBox as 1800 by 1200', () => {
    const svg =
      '<svg width="100%" height="100%" viewBox="0 0 1800 1200" version="1.1"></svg>'
    expect(parseSvgSize(svg)).toEqual({ width: 1800, height: 1200 })
    const raster = svgRasterSize(svg, 1024)
    expect(raster.width).toBe(1024)
    expect(raster.height).toBe(Math.round((1024 * 1200) / 1800))
    expect(raster.width / raster.height).toBeCloseTo(1800 / 1200, 2)
  })
})

describe('insetCustomOutline', () => {
  it('keeps the inset inside a rectangular outline', () => {
    const plate = maskToCustomPlate(rectMask(40, 20))!
    const outer = scaleCustomPlate(plate, 80).outer
    const inner = insetCustomOutline(plate, 80, 4)
    expect(inner.length).toBeGreaterThan(2)
    const mid = inner[0]
    expect(pointInPolygon({ x: mid.x, y: mid.y }, outer)).toBe(true)
    const ow = Math.max(...outer.map((p) => p.x)) - Math.min(...outer.map((p) => p.x))
    const iw = Math.max(...inner.map((p) => p.x)) - Math.min(...inner.map((p) => p.x))
    expect(iw).toBeLessThan(ow)
  })

  it('keeps the custom frame inside the SVG outline', () => {
    const plate = maskToCustomPlate(rectMask(40, 20))!
    const scaled = scaleCustomPlate(plate, 80)
    const frame = customFrame(plate, 80, 3)
    const ox = scaled.outer.map((p) => p.x)
    const fx = frame.outer.map((p) => p.x)
    expect(Math.min(...fx)).toBeGreaterThanOrEqual(Math.min(...ox) - 1e-6)
    expect(Math.max(...fx)).toBeLessThanOrEqual(Math.max(...ox) + 1e-6)
    const mid = frame.outer[0]
    expect(pointInPolygon({ x: mid.x, y: mid.y }, scaled.outer)).toBe(true)
  })

  it('insets a large custom mask quickly', () => {
    const mask = rectMask(200, 120)
    const plate = maskToCustomPlate(mask)!
    const t0 = performance.now()
    insetCustomOutline(plate, 80, 3)
    expect(performance.now() - t0).toBeLessThan(40)
  })
})
