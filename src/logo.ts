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

export function clampLogoPercent(percent: number, matrixSize: number): number {
  return clampNumber(percent, 10, maxLogoPercent(matrixSize))
}

export function maskToPolygons(
  mask: boolean[][],
  originX: number,
  originY: number,
  widthMm: number,
  heightMm: number,
): Polygon[] {
  const rows = mask.length
  const cols = mask[0]?.length ?? 0
  if (rows === 0 || cols === 0) return []
  const cellW = widthMm / cols
  const cellH = heightMm / rows
  const polys: Polygon[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c]) continue
      polys.push(squarePoly(originX + c * cellW, originY + r * cellH, cellW))
      const last = polys[polys.length - 1]
      if (cellW !== cellH) {
        last[2] = { x: originX + (c + 1) * cellW, y: originY + (r + 1) * cellH }
        last[3] = { x: originX + c * cellW, y: originY + (r + 1) * cellH }
      }
    }
  }
  return polys
}
