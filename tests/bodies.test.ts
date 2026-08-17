import { describe, expect, it } from 'vitest'
import { encodeQr } from '../src/encode'
import { makeLayout, moduleOrigin } from '../src/layout'
import { buildBodies } from '../src/bodies'
import { pointInPolygon } from '../src/offset'
import { clampSettings } from '../src/validate'
import { GAP_MM } from '../src/types'

function zRange(tris: { a: number[]; b: number[]; c: number[] }[]) {
  let min = Infinity
  let max = -Infinity
  for (const t of tris) {
    for (const v of [t.a, t.b, t.c]) {
      min = Math.min(min, v[2])
      max = Math.max(max, v[2])
    }
  }
  return { min, max }
}

function xyOf(tris: { a: number[]; b: number[]; c: number[] }[]) {
  let minX = Infinity
  let minY = Infinity
  for (const t of tris) {
    for (const v of [t.a, t.b, t.c]) {
      minX = Math.min(minX, v[0])
      minY = Math.min(minY, v[1])
    }
  }
  return { minX, minY }
}

describe('buildBodies', () => {
  const settings = clampSettings({
    content: 'https://example.com',
    widthMm: 80,
    blackHeightMm: 1.2,
    capThicknessMm: 0.8,
  })
  const matrix = encodeQr(settings.content, false)

  it('puts black on z 0..blackHeight and white up to cap', () => {
    const { black, white } = buildBodies(settings, matrix)
    const bz = zRange(black)
    const wz = zRange(white)
    expect(bz.min).toBeCloseTo(0)
    expect(bz.max).toBeCloseTo(1.2)
    expect(wz.min).toBeCloseTo(0)
    expect(wz.max).toBeCloseTo(2.0)
    expect(black.length).toBeGreaterThan(0)
    expect(white.length).toBeGreaterThan(0)
  })

  it('shares origin at the plate min corner', () => {
    const { black, white } = buildBodies(settings, matrix)
    const b = xyOf(black)
    const w = xyOf(white)
    expect(b.minX).toBeCloseTo(0)
    expect(b.minY).toBeCloseTo(0)
    expect(w.minX).toBeCloseTo(0)
    expect(w.minY).toBeCloseTo(0)
  })

  it('leaves a 0.20 mm gap around a square data module', () => {
    const square = clampSettings({ ...settings, style: 'square' })
    const { black, white } = buildBodies(square, matrix)
    let sample: { x: number; y: number } | null = null
    const layout = makeLayout(80, matrix.size)
    outer: for (let r = 8; r < matrix.size - 8; r++) {
      for (let c = 8; c < matrix.size - 8; c++) {
        if (matrix.modules[r][c] && !matrix.modules[r][c + 1]) {
          const o = moduleOrigin(layout, r, c)
          sample = {
            x: o.x + layout.moduleMm / 2,
            y: o.y + layout.moduleMm / 2,
          }
          break outer
        }
      }
    }
    expect(sample).not.toBeNull()
    const mid = sample!
    const justOutside = {
      x: mid.x + layout.moduleMm / 2 + GAP_MM / 2,
      y: mid.y,
    }
    const pastGap = {
      x: mid.x + layout.moduleMm / 2 + GAP_MM + 0.15,
      y: mid.y,
    }

    const whiteFillXy = white.filter((t) => t.a[2] < 1.2 - 1e-6)
    function anyTriContains(tris: typeof white, p: { x: number; y: number }) {
      return tris.some((t) => {
        const poly = [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]
        return pointInPolygon(p, poly)
      })
    }

    expect(anyTriContains(black, mid)).toBe(true)
    expect(anyTriContains(whiteFillXy, mid)).toBe(false)
    expect(anyTriContains(whiteFillXy, justOutside)).toBe(false)
    expect(anyTriContains(whiteFillXy, pastGap)).toBe(true)
  })

  it('keeps the cap solid: a center point exists at z above black height', () => {
    const { white } = buildBodies(settings, matrix)
    const cap = white.filter(
      (t) => t.a[2] >= 1.2 - 1e-6 && t.b[2] >= 1.2 - 1e-6 && t.c[2] >= 1.2 - 1e-6,
    )
    expect(cap.length).toBeGreaterThan(0)
    const center = { x: 40, y: 40 }
    const hits = cap.some((t) =>
      pointInPolygon(center, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(hits).toBe(true)
  })
})
