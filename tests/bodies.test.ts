import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodeQr } from '../src/encode'
import { makeLayout, moduleOrigin } from '../src/layout'
import { customFrame, maskToCustomPlate } from '../src/contour'
import { buildBodies } from '../src/bodies'
import {
  prepareAccess,
  prepareBottomShell,
  prepareSlider,
  prepareTopPlate,
} from '../src/cassetteParts'
import { pointInPolygon } from '../src/offset'
import { logoClearRect } from '../src/logo'
import { clampSettings } from '../src/validate'
import { dogtagHole } from '../src/shapes'
import { readBinaryStl } from '../src/stl'
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
    insetFrame: true,
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

  it('does not put black pads on the plate corners', () => {
    const tag = clampSettings({
      ...settings,
      insetFrame: false,
      plateShape: 'square',
    })
    const { black, white } = buildBodies(tag, matrix)
    const atBed = (tris: typeof black) =>
      tris.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const covers = (tris: typeof black, p: { x: number; y: number }) =>
      tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    const corners = [
      { x: 0.5, y: 0.5 },
      { x: 79.5, y: 0.5 },
      { x: 0.5, y: 79.5 },
      { x: 79.5, y: 79.5 },
    ]
    for (const p of corners) {
      expect(covers(atBed(black), p)).toBe(false)
    }
    expect(xyOf(white).minX).toBeCloseTo(0)
    expect(xyOf(white).minY).toBeCloseTo(0)
  })

  it('stamps a second QR at its own offset', () => {
    const extra = { content: 'https://other.example', sizePercent: 40, xMm: 18, yMm: -12 }
    const tag = clampSettings({
      ...settings,
      insetFrame: false,
      qrSizePercent: 55,
      extraQrs: [extra],
    })
    const extraMatrix = encodeQr(extra.content, false)
    const extraLayout = makeLayout(
      tag.widthMm,
      extraMatrix.size,
      tag.plateShape,
      tag.heightMm,
      extra.xMm,
      extra.yMm,
      false,
      tag.holeDiameterMm,
      extra.sizePercent,
    )
    const { black, white } = buildBodies(tag, matrix)
    const atZ0 = (tris: typeof black) =>
      tris.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const covers = (tris: typeof black, p: { x: number; y: number }) =>
      tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    const samples: { x: number; y: number }[] = []
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (!extraMatrix.modules[r]?.[c]) continue
        const o = moduleOrigin(extraLayout, r, c)
        samples.push({ x: o.x + extraLayout.moduleMm / 2, y: o.y + extraLayout.moduleMm / 2 })
      }
    }
    expect(samples.length).toBeGreaterThan(0)
    expect(samples.some((p) => covers(atZ0(black), p))).toBe(true)
    expect(samples.every((p) => !covers(atZ0(white), p))).toBe(true)
  })

  it('cuts a blank window on an extra QR', () => {
    const extra = {
      content: 'https://other.example',
      sizePercent: 45,
      xMm: 16,
      yMm: 0,
      blankLogo: true,
      logoSizePercent: 20,
    }
    const tag = clampSettings({
      ...settings,
      insetFrame: false,
      qrSizePercent: 45,
      qrOffsetXMm: -16,
      extraQrs: [extra],
    })
    const extraMatrix = encodeQr(extra.content, true)
    const extraLayout = makeLayout(
      tag.widthMm,
      extraMatrix.size,
      tag.plateShape,
      tag.heightMm,
      extra.xMm,
      extra.yMm,
      false,
      tag.holeDiameterMm,
      extra.sizePercent,
    )
    const { r0, c0, r1 } = logoClearRect(extraMatrix.size, 20)
    const origin = moduleOrigin(extraLayout, r0, c0)
    const side = extraLayout.moduleMm * (r1 - r0)
    const mid = { x: origin.x + side / 2, y: origin.y + side / 2 }
    const { black, white } = buildBodies(tag, matrix)
    const atZ0 = (tris: typeof black) =>
      tris.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const covers = (tris: typeof black, p: { x: number; y: number }) =>
      tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    expect(covers(atZ0(black), mid)).toBe(false)
    expect(covers(atZ0(white), mid)).toBe(true)
  })

  it('stamps two black-layer images at separate origins', () => {
    const tag = clampSettings({
      ...settings,
      insetFrame: false,
      blackImages: [
        { sizeMm: 6, xMm: 2, yMm: 2 },
        { sizeMm: 6, xMm: 20, yMm: 30 },
      ],
    })
    const mask = Array.from({ length: 6 }, () => Array<boolean>(6).fill(true))
    const { black } = buildBodies(tag, matrix, undefined, null, null, [mask, mask])
    const atZ0 = black.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const covers = (p: { x: number; y: number }) =>
      atZ0.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    expect(covers({ x: 5, y: 5 })).toBe(true)
    expect(covers({ x: 23, y: 33 })).toBe(true)
  })

  it('stamps a black-layer image at the given origin', () => {
    const tag = clampSettings({
      ...settings,
      insetFrame: false,
      blackImages: [{ sizeMm: 8, xMm: 2, yMm: 2 }],
    })
    const mask = Array.from({ length: 8 }, () => Array<boolean>(8).fill(true))
    const { black, white } = buildBodies(tag, matrix, undefined, null, null, [mask])
    const mid = { x: 6, y: 6 }
    const atZ0 = (tris: typeof black) =>
      tris.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const covers = (tris: typeof black, p: { x: number; y: number }) =>
      tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    expect(covers(atZ0(black), mid)).toBe(true)
    expect(covers(atZ0(white), mid)).toBe(false)
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

  it('cuts a through-hole in a square tag when hole is on', () => {
    const tag = clampSettings({
      ...settings,
      plateShape: 'square',
      dogtagHole: true,
    })
    const { white } = buildBodies(tag, matrix)
    const hole = dogtagHole(80, 80)
    const cap = white.filter(
      (t) => t.a[2] >= 1.2 - 1e-6 && t.b[2] >= 1.2 - 1e-6 && t.c[2] >= 1.2 - 1e-6,
    )
    const p = { x: hole.cx, y: hole.cy }
    const inCap = cap.some((t) =>
      pointInPolygon(p, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(inCap).toBe(false)
  })

  it('builds a custom plate with an SVG-style hole', () => {
    const mask = Array.from({ length: 24 }, () => Array<boolean>(24).fill(false))
    for (let y = 2; y < 22; y++) {
      for (let x = 2; x < 22; x++) mask[y][x] = true
    }
    for (let y = 9; y < 15; y++) {
      for (let x = 9; x < 15; x++) mask[y][x] = false
    }
    const custom = maskToCustomPlate(mask)
    expect(custom).not.toBeNull()
    const tag = clampSettings({
      ...settings,
      plateShape: 'custom',
      customAspect: custom!.aspect,
      dogtagHole: false,
    })
    const { black, white } = buildBodies(tag, matrix, undefined, custom)
    expect(black.length).toBeGreaterThan(0)
    expect(white.length).toBeGreaterThan(0)
    const mid = { x: 40, y: 40 * custom!.aspect }
    const cap = white.filter(
      (t) => t.a[2] >= 1.2 - 1e-6 && t.b[2] >= 1.2 - 1e-6 && t.c[2] >= 1.2 - 1e-6,
    )
    const inCap = cap.some((t) =>
      pointInPolygon(mid, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(inCap).toBe(false)
  })

  it('omits the generated inset frame when the option is off', () => {
    const mask = Array.from({ length: 24 }, () => Array<boolean>(24).fill(false))
    for (let y = 2; y < 22; y++) {
      for (let x = 2; x < 22; x++) mask[y][x] = true
    }
    for (let y = 9; y < 15; y++) {
      for (let x = 9; x < 15; x++) mask[y][x] = false
    }
    const custom = maskToCustomPlate(mask)
    expect(custom).not.toBeNull()
    const tag = clampSettings({
      ...settings,
      plateShape: 'custom',
      customAspect: custom!.aspect,
      insetFrame: false,
      qrSizePercent: 60,
      dogtagHole: false,
    })
    const { black, white } = buildBodies(tag, matrix, undefined, custom)
    const outline = customFrame(custom!, 80, 0).outer
    const nearEdge = {
      x: Math.min(...outline.map((p) => p.x)) + 1,
      y: (Math.min(...outline.map((p) => p.y)) + Math.max(...outline.map((p) => p.y))) / 2,
    }
    const whiteFill = white.filter((t) => t.a[2] < 1.2 - 1e-6)
    function anyTriContains(tris: typeof black, p: { x: number; y: number }) {
      return tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    }
    expect(anyTriContains(black, nearEdge)).toBe(false)
    expect(anyTriContains(whiteFill, nearEdge)).toBe(true)
  })

  it('adds the generated inset frame when the option is on', () => {
    const mask = Array.from({ length: 24 }, () => Array<boolean>(24).fill(false))
    for (let y = 2; y < 22; y++) {
      for (let x = 2; x < 22; x++) mask[y][x] = true
    }
    for (let y = 9; y < 15; y++) {
      for (let x = 9; x < 15; x++) mask[y][x] = false
    }
    const custom = maskToCustomPlate(mask)
    expect(custom).not.toBeNull()
    const tag = clampSettings({
      ...settings,
      plateShape: 'custom',
      customAspect: custom!.aspect,
      insetFrame: true,
      qrSizePercent: 60,
      dogtagHole: false,
    })
    const { black, white } = buildBodies(tag, matrix, undefined, custom)
    const outline = customFrame(custom!, 80, 0).outer
    const nearEdge = {
      x: Math.min(...outline.map((p) => p.x)) + 1,
      y: (Math.min(...outline.map((p) => p.y)) + Math.max(...outline.map((p) => p.y))) / 2,
    }
    const whiteFill = white.filter((t) => t.a[2] < 1.2 - 1e-6)
    function anyTriContains(tris: typeof black, p: { x: number; y: number }) {
      return tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    }
    expect(anyTriContains(black, nearEdge)).toBe(true)
    expect(anyTriContains(whiteFill, nearEdge)).toBe(false)
  })

  it('omits the inset frame on a square when the option is off', () => {
    const tag = clampSettings({ ...settings, insetFrame: false })
    const { black, white } = buildBodies(tag, matrix)
    const nearEdge = { x: 1, y: 40 }
    const whiteFill = white.filter((t) => t.a[2] < 1.2 - 1e-6)
    function anyTriContains(tris: typeof black, p: { x: number; y: number }) {
      return tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    }
    expect(anyTriContains(black, nearEdge)).toBe(false)
    expect(anyTriContains(whiteFill, nearEdge)).toBe(true)
  })

  it('sizes a custom QR to the SVG height when settings height is stale', () => {
    const mask = Array.from({ length: 20 }, () => Array<boolean>(40).fill(false))
    for (let y = 1; y < 19; y++) {
      for (let x = 1; x < 39; x++) mask[y][x] = true
    }
    const custom = maskToCustomPlate(mask)
    expect(custom).not.toBeNull()
    expect(custom!.aspect).toBeLessThan(0.7)
    const tag = clampSettings({
      ...settings,
      plateShape: 'custom',
      widthMm: 80,
      heightMm: 80,
      customAspect: 1,
      insetFrame: false,
      qrSizePercent: 100,
      dogtagHole: false,
    })
    const { black } = buildBodies(tag, matrix, undefined, custom)
    let maxY = -Infinity
    for (const t of black) {
      for (const v of [t.a, t.b, t.c]) maxY = Math.max(maxY, v[1])
    }
    expect(maxY).toBeLessThan(80 * custom!.aspect + 1)
  })

  it('cuts a through-hole in the white dog tag', () => {
    const tag = clampSettings({
      ...settings,
      plateShape: 'dogtag',
      widthMm: 80,
      heightMm: 40,
      dogtagHole: true,
    })
    const { white } = buildBodies(tag, matrix)
    const hole = dogtagHole(80, 40)
    const fill = white.filter((t) => t.a[2] < 1.2 - 1e-6)
    const cap = white.filter(
      (t) => t.a[2] >= 1.2 - 1e-6 && t.b[2] >= 1.2 - 1e-6 && t.c[2] >= 1.2 - 1e-6,
    )
    const p = { x: hole.cx, y: hole.cy }
    const inFill = fill.some((t) =>
      pointInPolygon(p, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    const inCap = cap.some((t) =>
      pointInPolygon(p, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(inFill).toBe(false)
    expect(inCap).toBe(false)
  })

  it('keeps the dog tag solid when the hole is off', () => {
    const tag = clampSettings({
      ...settings,
      plateShape: 'dogtag',
      widthMm: 80,
      heightMm: 40,
      dogtagHole: false,
    })
    const { white } = buildBodies(tag, matrix)
    const hole = dogtagHole(80, 40)
    const cap = white.filter(
      (t) => t.a[2] >= 1.2 - 1e-6 && t.b[2] >= 1.2 - 1e-6 && t.c[2] >= 1.2 - 1e-6,
    )
    const p = { x: hole.cx, y: hole.cy }
    const inCap = cap.some((t) =>
      pointInPolygon(p, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(inCap).toBe(true)
  })

  it('builds a circle tag that still sits on the origin', () => {
    const circle = clampSettings({ ...settings, plateShape: 'circle' })
    const { black, white } = buildBodies(circle, matrix)
    const b = xyOf(black)
    const w = xyOf(white)
    expect(b.minX).toBeCloseTo(0, 0)
    expect(b.minY).toBeCloseTo(0, 0)
    expect(w.minX).toBeCloseTo(0, 0)
    expect(w.minY).toBeCloseTo(0, 0)
    expect(zRange(white).max).toBeCloseTo(2.0)
  })

  it('rebuilds with a large logo mask without hanging', () => {
    const logo = clampSettings({
      ...settings,
      hasLogo: true,
      logoSizePercent: 20,
    })
    const withLogo = encodeQr(logo.content, true)
    const n = 128
    const mask = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => r % 2 === 0 || c % 2 === 0),
    )
    const t0 = performance.now()
    const { black, white } = buildBodies(logo, withLogo, mask)
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(black.length).toBeGreaterThan(0)
    expect(white.length).toBeGreaterThan(0)
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

  it('builds a cassette body to thickness plus a 1 mm head strip', () => {
    const tag = clampSettings({
      ...settings,
      plateShape: 'cassette',
      capThicknessMm: 4,
      insetFrame: false,
      dogtagHole: false,
    })
    const { black, white } = buildBodies(tag, matrix)
    expect(black.length).toBeGreaterThan(0)
    const wz = zRange(white)
    expect(wz.max).toBeCloseTo(1.2 + 4 + 1)
    const height = 63.6
    const stripMid = { x: 50.055, y: height - height * 0.08 }
    const stripLayer = white.filter(
      (t) => t.a[2] >= 1.2 + 4 - 1e-6 && t.b[2] >= 1.2 + 4 - 1e-6 && t.c[2] >= 1.2 + 4 - 1e-6,
    )
    const inStrip = stripLayer.some((t) =>
      pointInPolygon(stripMid, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(inStrip).toBe(true)
    const leftHole = { x: 28.5, y: 63.6 - 35 }
    const cap = white.filter(
      (t) =>
        t.a[2] >= 1.2 - 1e-6 &&
        t.a[2] < 1.2 + 4 - 1e-6 &&
        t.b[2] >= 1.2 - 1e-6 &&
        t.c[2] >= 1.2 - 1e-6,
    )
    const holeInCap = cap.some((t) =>
      pointInPolygon(leftHole, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(holeInCap).toBe(false)
  })

  it('cuts a blank window in the QR when Blank is on, with no logo file', () => {
    const tag = clampSettings({
      ...settings,
      hasLogo: true,
      blankLogo: true,
      logoSizePercent: 20,
      insetFrame: true,
    })
    const withLogo = encodeQr(tag.content, true)
    const { black, white } = buildBodies(tag, withLogo)
    const layout = makeLayout(80, withLogo.size)
    const { r0, c0, r1 } = logoClearRect(withLogo.size, 20)
    const origin = moduleOrigin(layout, r0, c0)
    const side = layout.moduleMm * (r1 - r0)
    const mid = { x: origin.x + side / 2, y: origin.y + side / 2 }
    const whiteFill = white.filter((t) => t.a[2] < 1.2 - 1e-6)
    function anyTriContains(tris: typeof black, p: { x: number; y: number }) {
      return tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    }
    expect(anyTriContains(black, mid)).toBe(false)
    expect(anyTriContains(whiteFill, mid)).toBe(true)
  })

  it('connects fill to cap with walls so a solid cap cannot drop to the bed', () => {
    const { white } = buildBodies(settings, matrix)
    const low = white.some((t) => {
      const zs = [t.a[2], t.b[2], t.c[2]]
      return Math.min(...zs) < 0.1 && Math.max(...zs) > 1.1
    })
    const high = white.some((t) => {
      const zs = [t.a[2], t.b[2], t.c[2]]
      return Math.min(...zs) < 1.3 && Math.max(...zs) > 1.9
    })
    expect(low).toBe(true)
    expect(high).toBe(true)
  })

  it('leaves a hole at z=0 under a black module so the white first layer is not solid', () => {
    const { black, white } = buildBodies(settings, matrix)
    const layout = makeLayout(80, matrix.size)
    let mid: { x: number; y: number } | null = null
    outer: for (let r = 8; r < matrix.size - 8; r++) {
      for (let c = 8; c < matrix.size - 8; c++) {
        if (matrix.modules[r][c]) {
          const o = moduleOrigin(layout, r, c)
          mid = { x: o.x + layout.moduleMm / 2, y: o.y + layout.moduleMm / 2 }
          break outer
        }
      }
    }
    expect(mid).not.toBeNull()
    const bottom = white.filter((t) => t.a[2] < 1e-6 && t.b[2] < 1e-6 && t.c[2] < 1e-6)
    const inBlack = black.some((t) =>
      pointInPolygon(mid!, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    const inWhiteBottom = bottom.some((t) =>
      pointInPolygon(mid!, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(inBlack).toBe(true)
    expect(inWhiteBottom).toBe(false)
  })

  it('leaves the interior empty above the QR when hollow is on', () => {
    const tag = clampSettings({ ...settings, hollow: true, lid: false })
    const { white, lid } = buildBodies(tag, matrix)
    expect(lid).toEqual([])
    const ceiling = white.filter(
      (t) => t.a[2] > 1.2 + 1e-6 && t.b[2] > 1.2 + 1e-6 && t.c[2] > 1.2 + 1e-6,
    )
    const center = { x: 40, y: 40 }
    const hits = ceiling.some((t) =>
      pointInPolygon(center, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(hits).toBe(false)
    const wz = zRange(white)
    expect(wz.max).toBeCloseTo(2.0)
  })

  it('builds a lid that covers the plate when lid is on', () => {
    const tag = clampSettings({ ...settings, hollow: true, lid: true })
    const { lid } = buildBodies(tag, matrix)
    expect(lid.length).toBeGreaterThan(0)
    const z = zRange(lid)
    expect(z.min).toBeCloseTo(0)
    expect(z.max).toBeGreaterThan(0.4)
    const top = lid.filter(
      (t) =>
        Math.abs(t.a[2] - z.max) < 1e-6 &&
        Math.abs(t.b[2] - z.max) < 1e-6 &&
        Math.abs(t.c[2] - z.max) < 1e-6,
    )
    const center = { x: 40, y: 40 }
    const hits = top.some((t) =>
      pointInPolygon(center, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(hits).toBe(true)
  })

  it('builds a credit card body at ID-1 size', () => {
    const tag = clampSettings({
      content: settings.content,
      plateShape: 'card',
      blackHeightMm: 1.2,
      capThicknessMm: 0.8,
      insetFrame: true,
      dogtagHole: false,
    })
    const { black, white } = buildBodies(tag, matrix)
    expect(tag.widthMm).toBeCloseTo(85.6)
    expect(tag.heightMm).toBeCloseTo(53.98)
    const b = xyOf(black)
    const w = xyOf(white)
    expect(b.minX).toBeCloseTo(0, 0)
    expect(b.minY).toBeCloseTo(0, 0)
    expect(w.minX).toBeCloseTo(0, 0)
    expect(w.minY).toBeCloseTo(0, 0)
    expect(zRange(white).max).toBeCloseTo(2.0)
  })

  it('keeps spindle and pin holes open through the cassette lid', () => {
    const load = (name: string) => {
      const buf = readFileSync(join(process.cwd(), 'cassette', name))
      return readBinaryStl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        .triangles
    }
    const tag = clampSettings({
      content: settings.content,
      plateShape: 'cassette',
      blackHeightMm: 0.6,
      insetFrame: false,
      cassetteLid: true,
    })
    const kit = {
      top: prepareTopPlate(load('top-plate-qr.stl')),
      bottom: [],
      slider: [],
      access: [],
    }
    const { white } = buildBodies(tag, matrix, undefined, null, kit)
    const coversAt = (z: number, p: { x: number; y: number }) =>
      white.some((t) => {
        if (
          Math.abs(t.a[2] - z) > 0.08 ||
          Math.abs(t.b[2] - z) > 0.08 ||
          Math.abs(t.c[2] - z) > 0.08
        ) {
          return false
        }
        return pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ])
      })
    const spindle = { x: 28.5, y: 28.5 }
    const pin = { x: 2, y: 1.8 }
    for (const z of [0, 0.6, 2, 2.676]) {
      expect(coversAt(z, spindle)).toBe(false)
      expect(coversAt(z, pin)).toBe(false)
    }
    expect(coversAt(2.676, { x: 50, y: 32 })).toBe(true)
  })

  it('pockets the printed top plate and exports the shell parts', () => {
    const load = (name: string) => {
      const buf = readFileSync(join(process.cwd(), 'cassette', name))
      return readBinaryStl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)).triangles
    }
    const tag = clampSettings({
      content: settings.content,
      plateShape: 'cassette',
      blackHeightMm: 0.6,
      insetFrame: false,
      cassetteLid: true,
      cassetteSlider: true,
      cassetteFlipSlider: false,
      cassetteAccess: true,
    })
    const kit = {
      top: prepareTopPlate(load('top-plate-qr.stl')),
      bottom: prepareBottomShell(load('bottom-shell.stl'), false),
      slider: prepareSlider(load('slider.stl'), false),
      access: prepareAccess(load('shell-acces-1.stl')),
    }
    const { black, white, extras } = buildBodies(tag, matrix, undefined, null, kit)
    expect(black.length).toBeGreaterThan(0)
    expect(zRange(white).min).toBeCloseTo(0, 2)
    expect(zRange(white).max).toBeGreaterThan(2)
    const b = xyOf(black)
    const w = xyOf(white)
    expect(w.minX).toBeCloseTo(0, 1)
    expect(w.minY).toBeCloseTo(0, 1)
    expect(b.minX).toBeGreaterThanOrEqual(-0.05)
    expect(b.minY).toBeGreaterThanOrEqual(-0.05)
    expect(extras.map((e) => e.filename)).toEqual([
      'cassette-bottom.stl',
      'cassette-slider.stl',
      'cassette-window.stl',
    ])
  })

  it('plugs the four corner pin holes on the flat plate only', () => {
    const load = (name: string) => {
      const buf = readFileSync(join(process.cwd(), 'cassette', name))
      return readBinaryStl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        .triangles
    }
    const lid = prepareTopPlate(load('top-plate-qr.stl'), false)
    const flat = prepareTopPlate(load('top-plate-qr-flat.stl'), true)
    expect(flat.length).toBeGreaterThan(lid.length)
    const corner = { x: 2, y: 63.6 - 1.8 }
    const lidBed = lid.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const flatBed = flat.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const covers = (tris: typeof flat, p: { x: number; y: number }) =>
      tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    expect(covers(flatBed, corner)).toBe(true)
  })

  it('keeps the cassette inset as a border and does not fill the head window with black', () => {
    const load = (name: string) => {
      const buf = readFileSync(join(process.cwd(), 'cassette', name))
      return readBinaryStl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        .triangles
    }
    const tag = clampSettings({
      content: settings.content,
      plateShape: 'cassette',
      blackHeightMm: 0.6,
      insetFrame: true,
      cassetteLid: true,
    })
    const kit = {
      top: prepareTopPlate(load('top-plate-qr.stl')),
      bottom: [],
      slider: [],
      access: [],
    }
    const { black, white } = buildBodies(tag, matrix, undefined, null, kit)
    const atBed = (tris: typeof black) =>
      tris.filter((t) => t.a[2] < 0.05 && t.b[2] < 0.05 && t.c[2] < 0.05)
    const covers = (tris: typeof black, p: { x: number; y: number }) =>
      tris.some((t) =>
        pointInPolygon(p, [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]),
      )
    const blackBed = atBed(black)
    const whiteBed = atBed(white)
    let minY = Infinity
    let maxY = -Infinity
    for (const t of black) {
      for (const v of [t.a, t.b, t.c]) {
        minY = Math.min(minY, v[1])
        maxY = Math.max(maxY, v[1])
      }
    }
    const side = { x: 10, y: 2 }
    const window = { x: 50, y: 56 }
    expect(covers(blackBed, side)).toBe(true)
    expect(covers(whiteBed, side)).toBe(false)
    expect(covers(blackBed, window)).toBe(false)
    expect(covers(whiteBed, window)).toBe(true)
  })

  it('keeps QR modules in the cassette rim and window', () => {
    const load = (name: string) => {
      const buf = readFileSync(join(process.cwd(), 'cassette', name))
      return readBinaryStl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        .triangles
    }
    const tag = clampSettings({
      content: settings.content,
      plateShape: 'cassette',
      blackHeightMm: 0.6,
      insetFrame: false,
      cassetteLid: true,
    })
    const kit = {
      top: prepareTopPlate(load('top-plate-qr.stl')),
      bottom: [],
      slider: [],
      access: [],
    }
    const { black, white } = buildBodies(tag, matrix, undefined, null, kit)
    const layout = makeLayout(
      tag.widthMm,
      matrix.size,
      'cassette',
      63.6,
      tag.qrOffsetXMm,
      tag.qrOffsetYMm,
      false,
      4,
      tag.qrSizePercent,
    )
    const atZ = (tris: typeof white, z: number) =>
      tris.filter(
        (t) =>
          Math.abs(t.a[2] - z) < 0.08 &&
          Math.abs(t.b[2] - z) < 0.08 &&
          Math.abs(t.c[2] - z) < 0.08,
      )
    const covers = (tris: typeof white, p: { x: number; y: number }) =>
      tris.some((t) => {
        const x1 = t.a[0]
        const y1 = t.a[1]
        const x2 = t.b[0]
        const y2 = t.b[1]
        const x3 = t.c[0]
        const y3 = t.c[1]
        const denom = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
        if (Math.abs(denom) < 1e-12) return false
        const a = ((y2 - y3) * (p.x - x3) + (x3 - x2) * (p.y - y3)) / denom
        const b = ((y3 - y1) * (p.x - x3) + (x1 - x3) * (p.y - y3)) / denom
        const c = 1 - a - b
        return a >= -1e-6 && b >= -1e-6 && c >= -1e-6
      })
    const inWindow = (p: { x: number; y: number }) =>
      p.x > 40 && p.x < 60 && p.y > 23 && p.y < 34
    const inRim = (p: { x: number; y: number }) =>
      p.x > 25 && p.x < 75 && p.y > 48.2 && p.y < 49
    let windowMod: { x: number; y: number } | null = null
    let rimMod: { x: number; y: number } | null = null
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) {
        if (!matrix.modules[r][c]) continue
        const o = moduleOrigin(layout, r, c)
        const mid = { x: o.x + layout.moduleMm / 2, y: o.y + layout.moduleMm / 2 }
        if (!windowMod && inWindow(mid)) windowMod = mid
        if (!rimMod && inRim(mid)) rimMod = mid
      }
    }
    expect(windowMod).not.toBeNull()
    expect(covers(atZ(black, 0), windowMod!)).toBe(true)
    expect(covers(atZ(white, 0), windowMod!)).toBe(false)
    if (rimMod) {
      expect(covers(atZ(black, 0), rimMod)).toBe(true)
      expect(covers(atZ(white, 0), rimMod)).toBe(false)
    }
    const emptyWell = { x: 22, y: 48.5 }
    if (!covers(atZ(black, 0), emptyWell)) {
      expect(covers(atZ(white, 0), emptyWell)).toBe(false)
      expect(covers(atZ(white, 0.6), emptyWell)).toBe(true)
    }
  })
})
