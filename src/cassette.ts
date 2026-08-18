import type { CustomPlate } from './contour'
import { circlePoly, rectPoly, roundedRectPoly, type Polygon } from './shapes'

/** Printed cassette body from /cassette STLs. */
export const CASSETTE_WIDTH_MM = 100.11
export const CASSETTE_HEIGHT_MM = 63.6
export const CASSETTE_ASPECT = CASSETTE_HEIGHT_MM / CASSETTE_WIDTH_MM
export const CASSETTE_DEFAULT_WIDTH_MM = CASSETTE_WIDTH_MM
export const CASSETTE_DEFAULT_HEIGHT_MM = CASSETTE_HEIGHT_MM
export const CASSETTE_QR_FACE_Z = 2
export const CASSETTE_PLATE_T_MM = 2
export const CASSETTE_LIP_H_MM = 0.676
export const CASSETTE_LIP_INSET_X_MM = 4.05
export const CASSETTE_LIP_INSET_Y_MM = 2.65
export const CASSETTE_WINDOW_DEPTH_MM = 1
export const CASSETTE_HEAD_STRIP_RAISE_MM = 1
export const CASSETTE_HEAD_STRIP_WIDTH_RATIO = 0.75
export const CASSETTE_HEAD_STRIP_HEIGHT_RATIO = 0.18
export const CASSETTE_HEAD_STRIP_TOP_CHAMFER_RATIO = 0.08
/** Corner radius 2 mm from cassette-basic.svg, as a fraction of width. */
export const CASSETTE_CORNER_RATIO = 2 / CASSETTE_WIDTH_MM
/** Pin holes on the lid plate, CAD XY. Flat plate should not keep these. */
export const CASSETTE_CORNER_HOLES_CAD_MM = [
  { x: 2.0, y: 1.8 },
  { x: 98.11, y: 1.8 },
  { x: 2.0, y: 61.8 },
  { x: 98.11, y: 61.8 },
] as const
export const CASSETTE_CORNER_PLUG_D_MM = 1.6

/** Hole centers and diameters on the 100.11 × 63.6 mm plate, mm. From cassette-basic.svg. */
export const CASSETTE_HOLES_MM = [
  { cx: 28.5, cy: 28.5, d: 11 },
  { cx: 71.61, cy: 28.5, d: 11 },
] as const

const HOLES = CASSETTE_HOLES_MM.map((h) => ({
  cx: h.cx / CASSETTE_WIDTH_MM,
  cy: h.cy / CASSETTE_WIDTH_MM,
  d: h.d / CASSETTE_WIDTH_MM,
}))

export function cassettePlate(): CustomPlate {
  return {
    outer: roundedRectPoly(0, 0, 1, CASSETTE_ASPECT, CASSETTE_CORNER_RATIO),
    holes: HOLES.map((h) => circlePoly(h.cx, h.cy, h.d, 32)),
    aspect: CASSETTE_ASPECT,
    mask: [[true]],
    pixelBBox: { minX: 0, minY: 0, maxX: CASSETTE_WIDTH_MM * 100, maxY: CASSETTE_HEIGHT_MM * 100 },
  }
}

const CASSETTE_CORNER_MM = CASSETTE_CORNER_RATIO * CASSETTE_WIDTH_MM
const CASSETTE_CORNER_STEPS = 12

/** Print-space plate outline. Same vertices as the inset-frame outer. */
export function cassetteOutline(): Polygon {
  return roundedRectPoly(
    0,
    0,
    CASSETTE_WIDTH_MM,
    CASSETTE_HEIGHT_MM,
    CASSETTE_CORNER_MM,
    CASSETTE_CORNER_STEPS,
  )
}

/** Inset frame as two rounded rects so corners stay clean (no miter chamfer). */
export function cassetteFrame(frameMm: number): { outer: Polygon; hole: Polygon } {
  const inset = Math.max(0, frameMm)
  return {
    outer: cassetteOutline(),
    hole: roundedRectPoly(
      inset,
      inset,
      CASSETTE_WIDTH_MM - 2 * inset,
      CASSETTE_HEIGHT_MM - 2 * inset,
      Math.max(0, CASSETTE_CORNER_MM - inset),
      CASSETTE_CORNER_STEPS,
    ),
  }
}

export function cassetteLipPoly(): Polygon {
  return roundedRectPoly(
    CASSETTE_LIP_INSET_X_MM,
    CASSETTE_LIP_INSET_Y_MM,
    CASSETTE_WIDTH_MM - 2 * CASSETTE_LIP_INSET_X_MM,
    CASSETTE_HEIGHT_MM - 2 * CASSETTE_LIP_INSET_Y_MM,
    Math.max(0, CASSETTE_CORNER_RATIO * CASSETTE_WIDTH_MM - 2),
  )
}

export function cassetteCornerHoles(): Polygon[] {
  return CASSETTE_CORNER_HOLES_CAD_MM.map((h) =>
    circlePoly(h.x, CASSETTE_HEIGHT_MM - h.y, CASSETTE_CORNER_PLUG_D_MM, 16),
  )
}

/**
 * Face art from cassette/cassette-basic.svg, mapped to print mm.
 * Magenta = white plate. Black = slightly inset wells (channel rim + window).
 */
const SVG_PLATE_X0 = 38.112
const SVG_PLATE_Y0 = 17.858
const SVG_PLATE_W = 321.888 - SVG_PLATE_X0
const SVG_TO_MM = CASSETTE_WIDTH_MM / SVG_PLATE_W
const SVG_CHANNEL_DY = 139.323
const SVG_WINDOW_DY = -18.708

export const CASSETTE_CHANNEL_INNER_Y_MM = CASSETTE_HEIGHT_MM - 15.45
export const CASSETTE_CHANNEL_X0_MM = 15
export const CASSETTE_CHANNEL_X1_MM = 85.11
export const CASSETTE_CHANNEL_X_INNER0_MM = 18.75
export const CASSETTE_CHANNEL_X_INNER1_MM = 81.35

export type CassetteFaceShape = {
  outer: Polygon
  holes: Polygon[]
}

function svgToMm(x: number, y: number): { x: number; y: number } {
  return {
    x: (x - SVG_PLATE_X0) * SVG_TO_MM,
    y: (y - SVG_PLATE_Y0) * SVG_TO_MM,
  }
}

function cubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

function sampleCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  steps: number,
): Polygon {
  const pts: Polygon = []
  for (let i = 0; i <= steps; i++) {
    const p = cubic(p0, p1, p2, p3, i / steps)
    pts.push(svgToMm(p.x, p.y))
  }
  return pts
}

/** Outer trapezoid of the head-channel rim, print space, head at max Y. */
export function cassetteChannelPoly(): Polygon {
  return [
    svgToMm(80.631, 58.819 + SVG_CHANNEL_DY),
    svgToMm(91.261, 15.023 + SVG_CHANNEL_DY),
    svgToMm(268.709, 15.023 + SVG_CHANNEL_DY),
    svgToMm(279.369, 58.819 + SVG_CHANNEL_DY),
  ]
}

/** Inner opening of the head-channel rim. */
export function cassetteChannelInnerPoly(): Polygon {
  const right = sampleCubic(
    { x: 276.481, y: 58.819 + SVG_CHANNEL_DY },
    { x: 276.481, y: 58.819 + SVG_CHANNEL_DY },
    { x: 269.575, y: 30.567 + SVG_CHANNEL_DY },
    { x: 266.482, y: 17.858 + SVG_CHANNEL_DY },
    5,
  )
  const left = sampleCubic(
    { x: 93.49, y: 17.858 + SVG_CHANNEL_DY },
    { x: 90.406, y: 30.567 + SVG_CHANNEL_DY },
    { x: 83.516, y: 58.819 + SVG_CHANNEL_DY },
    { x: 83.516, y: 58.819 + SVG_CHANNEL_DY },
    5,
  )
  return [...left, ...right]
}

function channelOuter(): { bl: { x: number; y: number }; tl: { x: number; y: number }; tr: { x: number; y: number }; br: { x: number; y: number } } {
  return {
    bl: svgToMm(80.631, 58.819 + SVG_CHANNEL_DY),
    tl: svgToMm(91.261, 15.023 + SVG_CHANNEL_DY),
    tr: svgToMm(268.709, 15.023 + SVG_CHANNEL_DY),
    br: svgToMm(279.369, 58.819 + SVG_CHANNEL_DY),
  }
}

function channelInner(): { bl: { x: number; y: number }; tl: { x: number; y: number }; tr: { x: number; y: number }; br: { x: number; y: number } } {
  return {
    bl: svgToMm(83.516, 58.819 + SVG_CHANNEL_DY),
    tl: svgToMm(93.49, 17.858 + SVG_CHANNEL_DY),
    tr: svgToMm(266.482, 17.858 + SVG_CHANNEL_DY),
    br: svgToMm(276.481, 58.819 + SVG_CHANNEL_DY),
  }
}

/** Closed 1 mm rim as three simple bars so inset/triangulation stay valid. */
export function cassetteChannelRimPolys(): Polygon[] {
  const o = channelOuter()
  const i = channelInner()
  return [
    [o.tl, o.tr, i.tr, i.tl],
    [o.bl, o.tl, i.tl, i.bl],
    [o.tr, o.br, i.br, i.tr],
  ]
}

export function cassetteWindowPoly(): Polygon {
  const x = 149.505
  const y = 100.346 + SVG_WINDOW_DY
  const a = svgToMm(x, y)
  const b = svgToMm(x + 60.945, y + 34.016)
  return rectPoly(a.x, a.y, b.x - a.x, b.y - a.y)
}

/** White wells from cassette-basic.svg: channel rim + center window. */
export function cassetteFaceWells(): CassetteFaceShape[] {
  return [
    ...cassetteChannelRimPolys().map((outer) => ({ outer, holes: [] as Polygon[] })),
    { outer: cassetteWindowPoly(), holes: [] },
  ]
}



export function cassetteHeadStrip(widthMm: number, heightMm: number): Polygon {
  const w = widthMm * CASSETTE_HEAD_STRIP_WIDTH_RATIO
  const h = heightMm * CASSETTE_HEAD_STRIP_HEIGHT_RATIO
  const x0 = (widthMm - w) / 2
  const x1 = x0 + w
  const yTop = heightMm - h
  const yBottom = heightMm
  const chamfer = Math.min(w * CASSETTE_HEAD_STRIP_TOP_CHAMFER_RATIO, h * 0.45)
  return [
    { x: x0 + chamfer, y: yTop },
    { x: x1 - chamfer, y: yTop },
    { x: x1, y: yTop + chamfer },
    { x: x1, y: yBottom },
    { x: x0, y: yBottom },
    { x: x0, y: yTop + chamfer },
  ]
}
