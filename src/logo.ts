import { isReservedCell, maxLogoPercent } from './layout'
import { squarePoly, type Polygon } from './shapes'
import { clampNumber } from './validate'

export function luminance(r: number, g: number, b: number): number {
  return Number((0.2126 * r + 0.7152 * g + 0.0722 * b).toFixed(6))
}

export function thresholdMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): boolean[][] {
  const mask: boolean[][] = []
  for (let y = 0; y < height; y++) {
    const row: boolean[] = []
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      row.push(luminance(rgba[i], rgba[i + 1], rgba[i + 2]) <= 127.5)
    }
    mask.push(row)
  }
  return mask
}

export function logoClearRect(
  matrixSize: number,
  logoSizePercent: number,
): { r0: number; c0: number; r1: number; c1: number } {
  const side = Math.max(1, Math.round((matrixSize * logoSizePercent) / 100))
  const r0 = Math.floor((matrixSize - side) / 2)
  const c0 = Math.floor((matrixSize - side) / 2)
  return { r0, c0, r1: r0 + side, c1: c0 + side }
}

export function applyLogoClear(modules: boolean[][], percent: number): boolean[][] {
  const size = modules.length
  const { r0, c0, r1, c1 } = logoClearRect(size, percent)
  return modules.map((row, r) =>
    row.map((cell, c) => {
      if (r >= r0 && r < r1 && c >= c0 && c < c1 && !isReservedCell(size, r, c)) {
        return false
      }
      return cell
    }),
  )
}

export function clampLogoPercent(percent: number, matrixSize?: number): number {
  return clampNumber(percent, 10, maxLogoPercent(matrixSize ?? 25))
}

export function logoSizePercentForMm(
  targetMm: number,
  moduleMm: number,
  matrixSize: number,
): number {
  const pitch = Math.max(1e-6, moduleMm)
  const modules = Math.min(matrixSize, Math.max(1, Math.round(targetMm / pitch)))
  return (modules / Math.max(1, matrixSize)) * 100
}

export function clipMaskToCircle(mask: boolean[][]): boolean[][] {
  const rows = mask.length
  const cols = mask[0]?.length ?? 0
  if (rows === 0 || cols === 0) return mask
  const cx = (cols - 1) / 2
  const cy = (rows - 1) / 2
  const r = Math.min(cols, rows) / 2
  const r2 = r * r
  return mask.map((row, y) =>
    row.map((v, x) => {
      const dx = x - cx
      const dy = y - cy
      return v && dx * dx + dy * dy <= r2
    }),
  )
}

export const MAX_LOGO_MASK_SIDE = 32

function downsampleMask(mask: boolean[][], maxSide: number): boolean[][] {
  const rows = mask.length
  const cols = mask[0]?.length ?? 0
  if (rows === 0 || cols === 0) return mask
  if (rows <= maxSide && cols <= maxSide) return mask
  const outRows = Math.min(rows, maxSide)
  const outCols = Math.min(cols, maxSide)
  const out: boolean[][] = []
  for (let r = 0; r < outRows; r++) {
    const r0 = Math.floor((r * rows) / outRows)
    const r1 = Math.floor(((r + 1) * rows) / outRows)
    const row: boolean[] = []
    for (let c = 0; c < outCols; c++) {
      const c0 = Math.floor((c * cols) / outCols)
      const c1 = Math.floor(((c + 1) * cols) / outCols)
      let dark = 0
      let total = 0
      for (let y = r0; y < r1; y++) {
        for (let x = c0; x < c1; x++) {
          total += 1
          if (mask[y][x]) dark += 1
        }
      }
      row.push(dark * 2 >= total)
    }
    out.push(row)
  }
  return out
}

function mergeMaskRects(mask: boolean[][]): { r: number; c: number; h: number; w: number }[] {
  const rows = mask.length
  const cols = mask[0]?.length ?? 0
  const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false))
  const rects: { r: number; c: number; h: number; w: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c] || seen[r][c]) continue
      let w = 1
      while (c + w < cols && mask[r][c + w] && !seen[r][c + w]) w += 1
      let h = 1
      grow: while (r + h < rows) {
        for (let x = 0; x < w; x++) {
          if (!mask[r + h][c + x] || seen[r + h][c + x]) break grow
        }
        h += 1
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) seen[r + y][c + x] = true
      }
      rects.push({ r, c, h, w })
    }
  }
  return rects
}

function rectPoly(
  originX: number,
  originY: number,
  cellW: number,
  cellH: number,
  r: number,
  c: number,
  h: number,
  w: number,
): Polygon {
  const x = originX + c * cellW
  const y = originY + r * cellH
  const width = w * cellW
  const height = h * cellH
  if (width === height) return squarePoly(x, y, width)
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

export function maskToPolygons(
  mask: boolean[][],
  originX: number,
  originY: number,
  widthMm: number,
  heightMm: number,
): Polygon[] {
  const compact = downsampleMask(mask, MAX_LOGO_MASK_SIDE)
  const rows = compact.length
  const cols = compact[0]?.length ?? 0
  if (rows === 0 || cols === 0) return []
  const cellW = widthMm / cols
  const cellH = heightMm / rows
  return mergeMaskRects(compact).map((rect) =>
    rectPoly(originX, originY, cellW, cellH, rect.r, rect.c, rect.h, rect.w),
  )
}
