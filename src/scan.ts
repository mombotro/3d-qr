import jsQR from 'jsqr'
import type { QrMatrix } from './encode'
import { isReservedCell, moduleOrigin, type Layout } from './layout'
import { logoClearRect, maskToPolygons } from './logo'
import { pointInPolygon } from './offset'
import { frameRing, modulePoly, type Polygon } from './shapes'
import type { QrStyle } from './types'

export type Raster = {
  data: Uint8ClampedArray
  width: number
  height: number
}

function makeImage(pixels: number, fill: number): Raster {
  const data = new Uint8ClampedArray(pixels * pixels * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill
    data[i + 1] = fill
    data[i + 2] = fill
    data[i + 3] = 255
  }
  return { data, width: pixels, height: pixels }
}

function fillPoly(image: Raster, poly: Polygon, scale: number, rgb: number): void {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of poly) {
    minX = Math.min(minX, p.x * scale)
    minY = Math.min(minY, p.y * scale)
    maxX = Math.max(maxX, p.x * scale)
    maxY = Math.max(maxY, p.y * scale)
  }
  const x0 = Math.max(0, Math.floor(minX))
  const y0 = Math.max(0, Math.floor(minY))
  const x1 = Math.min(image.width - 1, Math.ceil(maxX))
  const y1 = Math.min(image.height - 1, Math.ceil(maxY))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!pointInPolygon({ x: (x + 0.5) / scale, y: (y + 0.5) / scale }, poly)) continue
      const i = (y * image.width + x) * 4
      image.data[i] = rgb
      image.data[i + 1] = rgb
      image.data[i + 2] = rgb
      image.data[i + 3] = 255
    }
  }
}

export function renderBedFace(args: {
  matrix: QrMatrix
  layout: Layout
  style: QrStyle
  logoMask?: boolean[][]
  logoPercent?: number
  pixels: number
}): Raster {
  const { matrix, layout, style, pixels } = args
  const image = makeImage(pixels, 255)
  const scale = pixels / layout.widthMm
  const frame = frameRing(layout.widthMm, layout.frameMm)
  fillPoly(image, frame.outer, scale, 0)
  fillPoly(image, frame.hole, scale, 255)
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!matrix.modules[r][c]) continue
      const o = moduleOrigin(layout, r, c)
      const poly = modulePoly(
        style,
        o.x,
        o.y,
        layout.moduleMm,
        isReservedCell(matrix.size, r, c),
      )
      fillPoly(image, poly, scale, 0)
    }
  }
  if (args.logoMask && args.logoPercent !== undefined) {
    const { r0, c0, r1 } = logoClearRect(matrix.size, args.logoPercent)
    const origin = moduleOrigin(layout, r0, c0)
    const side = layout.moduleMm * (r1 - r0)
    for (const poly of maskToPolygons(args.logoMask, origin.x, origin.y, side, side)) {
      fillPoly(image, poly, scale, 0)
    }
  }
  return image
}

export function decodeBedFace(image: Raster): string | null {
  const result = jsQR(image.data, image.width, image.height)
  return result ? result.data : null
}
