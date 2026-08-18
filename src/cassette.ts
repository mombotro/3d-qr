import type { CustomPlate } from './contour'
import { circlePoly, roundedRectPoly, type Polygon } from './shapes'

/** Printed cassette body from /cassette STLs. */
export const CASSETTE_WIDTH_MM = 100.11
export const CASSETTE_HEIGHT_MM = 63.6
export const CASSETTE_ASPECT = CASSETTE_HEIGHT_MM / CASSETTE_WIDTH_MM
export const CASSETTE_DEFAULT_WIDTH_MM = CASSETTE_WIDTH_MM
export const CASSETTE_DEFAULT_HEIGHT_MM = CASSETTE_HEIGHT_MM
export const CASSETTE_QR_FACE_Z = 2
export const CASSETTE_HEAD_STRIP_RAISE_MM = 1
export const CASSETTE_HEAD_STRIP_WIDTH_RATIO = 0.75
export const CASSETTE_HEAD_STRIP_HEIGHT_RATIO = 0.18
export const CASSETTE_HEAD_STRIP_TOP_CHAMFER_RATIO = 0.08
export const CASSETTE_CORNER_RATIO = 0.035
/** Pin holes on the lid plate, CAD XY. Flat plate should not keep these. */
export const CASSETTE_CORNER_HOLES_CAD_MM = [
  { x: 2.0, y: 1.8 },
  { x: 98.11, y: 1.8 },
  { x: 2.0, y: 61.8 },
  { x: 98.11, y: 61.8 },
] as const
export const CASSETTE_CORNER_PLUG_D_MM = 1.6

/** Hole centers and diameters on the 100.11 × 63.6 mm plate, mm. */
export const CASSETTE_HOLES_MM = [
  { cx: 28.5, cy: CASSETTE_HEIGHT_MM - 35.0, d: 9.8 },
  { cx: 71.65, cy: CASSETTE_HEIGHT_MM - 35.0, d: 9.8 },
  { cx: 50.055, cy: CASSETTE_HEIGHT_MM - 14.78, d: 7.08 },
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
    pixelBBox: { minX: 0, minY: 0, maxX: CASSETTE_WIDTH_MM, maxY: CASSETTE_HEIGHT_MM },
  }
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
