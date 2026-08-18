import { dogtagHole } from './shapes'
import {
  FRAME_MODULES,
  QUIET_ZONE_MODULES,
  ROUNDED_TAG_RADIUS,
  type PlateShape,
} from './types'

export type Layout = {
  shape: PlateShape
  widthMm: number
  heightMm: number
  moduleMm: number
  frameMm: number
  quietZoneMm: number
  matrixSize: number
  matrixOriginX: number
  matrixOriginY: number
  qrOffsetXMm: number
  qrOffsetYMm: number
  qrSizePercent: number
}

const ALIGNMENT: Record<number, number[]> = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
  13: [6, 34, 62],
  14: [6, 26, 46, 66],
  15: [6, 26, 48, 70],
  16: [6, 26, 50, 74],
  17: [6, 30, 54, 78],
  18: [6, 30, 56, 82],
  19: [6, 30, 58, 86],
  20: [6, 34, 62, 90],
  21: [6, 28, 50, 72, 94],
  22: [6, 26, 50, 74, 98],
  23: [6, 30, 54, 78, 102],
  24: [6, 28, 54, 80, 106],
  25: [6, 32, 58, 84, 110],
  26: [6, 30, 58, 86, 114],
  27: [6, 34, 62, 90, 118],
  28: [6, 26, 50, 74, 98, 122],
  29: [6, 30, 54, 78, 102, 126],
  30: [6, 26, 52, 78, 104, 130],
  31: [6, 30, 56, 82, 108, 134],
  32: [6, 34, 60, 86, 112, 138],
  33: [6, 30, 58, 86, 114, 142],
  34: [6, 34, 62, 90, 118, 146],
  35: [6, 30, 54, 78, 102, 126, 150],
  36: [6, 24, 50, 76, 102, 128, 154],
  37: [6, 28, 54, 80, 106, 132, 158],
  38: [6, 32, 58, 84, 110, 136, 162],
  39: [6, 26, 54, 82, 110, 138, 166],
  40: [6, 30, 58, 86, 114, 142, 170],
}

export function plateBounds(
  shape: PlateShape,
  sizeMm: number,
  heightMm = sizeMm,
): { widthMm: number; heightMm: number } {
  if (shape === 'hexagon') {
    return { widthMm: (sizeMm * 2) / Math.sqrt(3), heightMm: sizeMm }
  }
  if (
    shape === 'rect' ||
    shape === 'dogtag' ||
    shape === 'custom' ||
    shape === 'cassette' ||
    shape === 'card'
  ) {
    return { widthMm: sizeMm, heightMm }
  }
  return { widthMm: sizeMm, heightMm: sizeMm }
}

function moduleMmFor(
  shape: PlateShape,
  sizeMm: number,
  matrixSize: number,
  heightMm: number,
): number {
  const content = matrixSize + 2 * QUIET_ZONE_MODULES
  const frameBoth = 2 * FRAME_MODULES
  if (shape === 'circle') {
    return sizeMm / (content * Math.SQRT2 + frameBoth)
  }
  if (shape === 'hexagon') {
    const k = Math.sqrt(3) - 1
    return (k * sizeMm) / (content + 4 * k)
  }
  if (shape === 'rounded') {
    const a = 1 - 1 / Math.SQRT2
    const m = (sizeMm * (1 - 0.3 * a)) / (content + 4 * (1 - a))
    if (2 * m < ROUNDED_TAG_RADIUS * sizeMm) return m
  }
  const short =
    shape === 'rect' ||
    shape === 'dogtag' ||
    shape === 'custom' ||
    shape === 'cassette' ||
    shape === 'card'
      ? Math.min(sizeMm, heightMm)
      : sizeMm
  return short / (content + frameBoth)
}

export function clampQrOffset(
  shape: PlateShape,
  widthMm: number,
  heightMm: number,
  frameMm: number,
  contentMm: number,
  offsetXMm: number,
  offsetYMm: number,
  hasDogtagHole = false,
  holeDiameterMm = 4,
): { x: number; y: number } {
  const maxX = Math.max(0, (widthMm - 2 * frameMm - contentMm) / 2)
  const maxY = Math.max(0, (heightMm - 2 * frameMm - contentMm) / 2)
  let minX = -maxX
  let minY = -maxY
  const xMax = maxX
  const yMax = maxY
  if (hasDogtagHole) {
    const hole = dogtagHole(widthMm, heightMm, holeDiameterMm)
    const clear = hole.diameter / 2 + 1.5 + contentMm / 2
    if (widthMm >= heightMm) {
      minX = Math.max(minX, hole.cx + clear - widthMm / 2)
    } else {
      minY = Math.max(minY, hole.cy + clear - heightMm / 2)
    }
  }
  return {
    x: Math.min(xMax, Math.max(minX, offsetXMm)),
    y: Math.min(yMax, Math.max(minY, offsetYMm)),
  }
}

export function makeLayout(
  sizeMm: number,
  matrixSize: number,
  shape: PlateShape = 'square',
  heightMm?: number,
  offsetXMm = 0,
  offsetYMm = 0,
  hasDogtagHole = false,
  holeDiameterMm = 4,
  qrSizePercent = 100,
): Layout {
  const tagHeight = heightMm ?? sizeMm
  const fullModule = moduleMmFor(shape, sizeMm, matrixSize, tagHeight)
  const frameMm = FRAME_MODULES * fullModule
  const bounds = plateBounds(shape, sizeMm, tagHeight)
  const widthMm = bounds.widthMm
  const plateHeight = bounds.heightMm
  const content100 = (matrixSize + 2 * QUIET_ZONE_MODULES) * fullModule
  const guess = clampQrOffset(
    shape,
    widthMm,
    plateHeight,
    frameMm,
    content100,
    offsetXMm,
    offsetYMm,
    hasDogtagHole,
    holeDiameterMm,
  )
  const maxContent = maxContentAtOffset(
    widthMm,
    plateHeight,
    frameMm,
    guess.x,
    guess.y,
    hasDogtagHole,
    holeDiameterMm,
  )
  const minQuiet = 1
  const asked = Math.min(2, Math.max(0.4, qrSizePercent / 100))
  let moduleMm = fullModule * asked
  let quiet = QUIET_ZONE_MODULES
  let contentMm = (matrixSize + 2 * quiet) * moduleMm
  if (asked > 1) {
    quiet = (maxContent / moduleMm - matrixSize) / 2
    if (quiet < minQuiet) {
      quiet = minQuiet
      moduleMm = maxContent / (matrixSize + 2 * minQuiet)
    }
    contentMm = (matrixSize + 2 * quiet) * moduleMm
  } else if (contentMm > maxContent) {
    moduleMm = maxContent / (matrixSize + 2 * quiet)
    contentMm = (matrixSize + 2 * quiet) * moduleMm
  }
  const matrixMm = matrixSize * moduleMm
  const edgeMm = moduleMm
  const shift = clampQrOffset(
    shape,
    widthMm,
    plateHeight,
    edgeMm,
    matrixMm,
    offsetXMm,
    offsetYMm,
    hasDogtagHole,
    holeDiameterMm,
  )
  return {
    shape,
    widthMm,
    heightMm: plateHeight,
    moduleMm,
    frameMm,
    quietZoneMm: quiet * moduleMm,
    matrixSize,
    matrixOriginX: (widthMm - contentMm) / 2 + quiet * moduleMm + shift.x,
    matrixOriginY: (plateHeight - contentMm) / 2 + quiet * moduleMm + shift.y,
    qrOffsetXMm: shift.x,
    qrOffsetYMm: shift.y,
    qrSizePercent: fullModule > 0 ? (moduleMm / fullModule) * 100 : 100,
  }
}

function maxContentAtOffset(
  widthMm: number,
  heightMm: number,
  frameMm: number,
  offsetXMm: number,
  offsetYMm: number,
  hasHole: boolean,
  holeDiameterMm: number,
): number {
  const cx = widthMm / 2 + offsetXMm
  const cy = heightMm / 2 + offsetYMm
  const maxW = 2 * Math.min(cx - frameMm, widthMm - frameMm - cx)
  const maxH = 2 * Math.min(cy - frameMm, heightMm - frameMm - cy)
  let maxC = Math.max(0, Math.min(maxW, maxH))
  if (hasHole) {
    const hole = dogtagHole(widthMm, heightMm, holeDiameterMm)
    const clear = hole.diameter / 2 + 1.5
    if (widthMm >= heightMm) {
      maxC = Math.min(maxC, 2 * Math.max(0, cx - hole.cx - clear))
    } else {
      maxC = Math.min(maxC, 2 * Math.max(0, cy - hole.cy - clear))
    }
  }
  return maxC
}

export function moduleOrigin(layout: Layout, row: number, col: number): { x: number; y: number } {
  return {
    x: layout.matrixOriginX + col * layout.moduleMm,
    y: layout.matrixOriginY + row * layout.moduleMm,
  }
}

function inFinder(row: number, col: number, r0: number, c0: number): boolean {
  return row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7
}

export function isFinderCell(matrixSize: number, row: number, col: number): boolean {
  return (
    inFinder(row, col, 0, 0) ||
    inFinder(row, col, 0, matrixSize - 7) ||
    inFinder(row, col, matrixSize - 7, 0)
  )
}

function inSeparator(matrixSize: number, row: number, col: number): boolean {
  const last = matrixSize - 1
  const nearTl = (row === 7 && col <= 7) || (col === 7 && row <= 7)
  const nearTr = (row === 7 && col >= matrixSize - 8) || (col === matrixSize - 8 && row <= 7)
  const nearBl = (col === 7 && row >= matrixSize - 8) || (row === matrixSize - 8 && col <= 7)
  return nearTl || nearTr || nearBl || row < 0 || col < 0 || row > last || col > last
}

function inFormat(matrixSize: number, row: number, col: number): boolean {
  if (row === 8 && (col <= 8 || col >= matrixSize - 8)) return true
  if (col === 8 && (row <= 8 || row >= matrixSize - 7)) return true
  return false
}

function inVersion(matrixSize: number, row: number, col: number): boolean {
  if (matrixSize < 45) return false
  if (row <= 5 && col >= matrixSize - 11 && col <= matrixSize - 9) return true
  if (col <= 5 && row >= matrixSize - 11 && row <= matrixSize - 9) return true
  return false
}

function inAlignment(matrixSize: number, row: number, col: number): boolean {
  const version = (matrixSize - 17) / 4
  const centers = ALIGNMENT[version]
  if (!centers) return false
  for (const ar of centers) {
    for (const ac of centers) {
      if (isFinderCell(matrixSize, ar, ac)) continue
      if (Math.abs(row - ar) <= 2 && Math.abs(col - ac) <= 2) return true
    }
  }
  return false
}

export function isReservedCell(matrixSize: number, row: number, col: number): boolean {
  if (isFinderCell(matrixSize, row, col)) return true
  if (inSeparator(matrixSize, row, col)) return true
  if (row === 6 || col === 6) return true
  if (inFormat(matrixSize, row, col)) return true
  if (inVersion(matrixSize, row, col)) return true
  if (inAlignment(matrixSize, row, col)) return true
  return false
}

export function maxLogoPercent(_matrixSize: number): number {
  return 50
}
