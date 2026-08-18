import { insetPolygon } from './offset'
import type { Point2, Polygon } from './shapes'

export type CustomPlate = {
  outer: Polygon
  holes: Polygon[]
  aspect: number
  mask: boolean[][]
  pixelBBox: { minX: number; minY: number; maxX: number; maxY: number }
}

const DX = [1, 1, 0, -1, -1, -1, 0, 1]
const DY = [0, 1, 1, 1, 0, -1, -1, -1]

function dark(mask: boolean[][], x: number, y: number): boolean {
  return y >= 0 && x >= 0 && y < mask.length && x < (mask[0]?.length ?? 0) && mask[y][x]
}

function flood(mask: boolean[][], sx: number, sy: number, want: boolean, mark: boolean[][]): void {
  const h = mask.length
  const w = mask[0]?.length ?? 0
  const stack = [[sx, sy]]
  while (stack.length) {
    const [x, y] = stack.pop()!
    if (y < 0 || x < 0 || y >= h || x >= w) continue
    if (mask[y][x] !== want || mark[y][x]) continue
    mark[y][x] = true
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
}

function trace(mask: boolean[][], sx: number, sy: number): Polygon {
  const path: Polygon = []
  let x = sx
  let y = sy
  let dir = 0
  for (let guard = 0; guard < 100000; guard++) {
    path.push({ x, y })
    let found = false
    for (let i = 0; i < 8; i++) {
      const nd = (dir + 6 + i) % 8
      const nx = x + DX[nd]
      const ny = y + DY[nd]
      if (dark(mask, nx, ny)) {
        x = nx
        y = ny
        dir = nd
        found = true
        break
      }
    }
    if (!found) break
    if (x === sx && y === sy && path.length > 2) break
  }
  return simplify(path)
}

function simplify(path: Polygon): Polygon {
  if (path.length < 4) return path
  const out: Polygon = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1]
    const b = path[i]
    const c = path[i + 1]
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (Math.abs(cross) > 1e-6) out.push(b)
  }
  out.push(path[path.length - 1])
  return out
}

function bbox(pts: Polygon): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

function mapWithBox(
  pts: Polygon,
  box: { minX: number; minY: number; maxX: number; maxY: number },
): Polygon {
  const w = Math.max(1e-6, box.maxX - box.minX)
  return pts.map((p) => ({ x: (p.x - box.minX) / w, y: (p.y - box.minY) / w }))
}

function normalize(
  outer: Polygon,
  holes: Polygon[],
  mask: boolean[][],
): CustomPlate {
  const box = bbox(outer)
  const w = Math.max(1e-6, box.maxX - box.minX)
  const h = Math.max(1e-6, box.maxY - box.minY)
  return {
    outer: mapWithBox(outer, box),
    holes: holes.map((hole) => mapWithBox(hole, box)),
    aspect: h / w,
    mask,
    pixelBBox: box,
  }
}

export function maskToCustomPlate(mask: boolean[][]): CustomPlate | null {
  const rows = mask.length
  const cols = mask[0]?.length ?? 0
  if (rows === 0 || cols === 0) return null

  const padded: boolean[][] = Array.from({ length: rows + 2 }, (_, y) =>
    Array.from({ length: cols + 2 }, (_, x) =>
      y > 0 && x > 0 && y <= rows && x <= cols ? mask[y - 1][x - 1] : false,
    ),
  )

  const background = padded.map((row) => row.map(() => false))
  flood(padded, 0, 0, false, background)

  let best: { x: number; y: number; count: number } | null = null
  const seen = padded.map((row) => row.map(() => false))
  for (let y = 0; y < padded.length; y++) {
    for (let x = 0; x < padded[0].length; x++) {
      if (!padded[y][x] || seen[y][x]) continue
      const mark = padded.map((row) => row.map(() => false))
      flood(padded, x, y, true, mark)
      let count = 0
      for (let yy = 0; yy < mark.length; yy++) {
        for (let xx = 0; xx < mark[0].length; xx++) {
          if (mark[yy][xx]) {
            seen[yy][xx] = true
            count += 1
          }
        }
      }
      if (!best || count > best.count) best = { x, y, count }
    }
  }
  if (!best) return null

  const component = padded.map((row) => row.map(() => false))
  flood(padded, best.x, best.y, true, component)
  const outer = trace(component, best.x, best.y)
  if (outer.length < 3) return null

  const holes: Polygon[] = []
  const holeSeen = padded.map((row) => row.map(() => false))
  for (let y = 0; y < padded.length; y++) {
    for (let x = 0; x < padded[0].length; x++) {
      if (padded[y][x] || background[y][x] || holeSeen[y][x]) continue
      const mark = padded.map((row) => row.map(() => false))
      flood(
        padded.map((row, yy) => row.map((v, xx) => !v && !background[yy][xx])),
        x,
        y,
        true,
        mark,
      )
      let seed: { x: number; y: number } | null = null
      for (let yy = 0; yy < mark.length; yy++) {
        for (let xx = 0; xx < mark[0].length; xx++) {
          if (mark[yy][xx]) {
            holeSeen[yy][xx] = true
            if (!seed) seed = { x: xx, y: yy }
          }
        }
      }
      if (!seed) continue
      const holeMask = mark
      const ring = trace(holeMask, seed.x, seed.y)
      if (ring.length >= 3) holes.push(ring)
    }
  }

  return normalize(outer, holes, component)
}

export type MaskShape = {
  outer: Polygon
  holes: Polygon[]
}

/** Trace every dark blob, including letter holes. Coordinates are in mask pixels. */
export function maskToShapes(mask: boolean[][]): MaskShape[] {
  const rows = mask.length
  const cols = mask[0]?.length ?? 0
  if (rows === 0 || cols === 0) return []
  const padded: boolean[][] = Array.from({ length: rows + 2 }, (_, y) =>
    Array.from({ length: cols + 2 }, (_, x) =>
      y > 0 && x > 0 && y <= rows && x <= cols ? Boolean(mask[y - 1]?.[x - 1]) : false,
    ),
  )
  const background = padded.map((row) => row.map(() => false))
  flood(padded, 0, 0, false, background)
  const seen = padded.map((row) => row.map(() => false))
  const shapes: MaskShape[] = []
  for (let y = 0; y < padded.length; y++) {
    for (let x = 0; x < (padded[0]?.length ?? 0); x++) {
      if (!padded[y]?.[x] || seen[y]?.[x]) continue
      const component = padded.map((row) => row.map(() => false))
      flood(padded, x, y, true, component)
      let seed: { x: number; y: number } | null = null
      for (let yy = 0; yy < component.length; yy++) {
        for (let xx = 0; xx < (component[0]?.length ?? 0); xx++) {
          if (!component[yy]?.[xx]) continue
          if (seen[yy]) seen[yy][xx] = true
          if (!seed) seed = { x: xx, y: yy }
        }
      }
      if (!seed) continue
      const outer = trace(component, seed.x, seed.y)
      if (outer.length < 3) continue
      const holes: Polygon[] = []
      const holeSeen = padded.map((row) => row.map(() => false))
      for (let yy = 0; yy < padded.length; yy++) {
        for (let xx = 0; xx < (padded[0]?.length ?? 0); xx++) {
          if (padded[yy]?.[xx] || background[yy]?.[xx] || holeSeen[yy]?.[xx]) continue
          if (!touches(component, xx, yy)) continue
          const mark = padded.map((row) => row.map(() => false))
          flood(padded, xx, yy, false, mark)
          let holeSeed: { x: number; y: number } | null = null
          for (let hy = 0; hy < mark.length; hy++) {
            for (let hx = 0; hx < (mark[0]?.length ?? 0); hx++) {
              if (!mark[hy]?.[hx]) continue
              if (holeSeen[hy]) holeSeen[hy][hx] = true
              if (!holeSeed) holeSeed = { x: hx, y: hy }
            }
          }
          if (!holeSeed) continue
          const ring = trace(mark, holeSeed.x, holeSeed.y)
          if (ring.length >= 3) holes.push(ring)
        }
      }
      shapes.push({ outer, holes })
    }
  }
  return shapes
}

function touches(mask: boolean[][], x: number, y: number): boolean {
  return (
    Boolean(mask[y]?.[x - 1]) ||
    Boolean(mask[y]?.[x + 1]) ||
    Boolean(mask[y - 1]?.[x]) ||
    Boolean(mask[y + 1]?.[x])
  )
}

export function scaleCustomPlate(plate: CustomPlate, widthMm: number): CustomPlate {
  const s = widthMm
  const eps = Math.max(0.15, widthMm * 0.002)
  return {
    outer: rdp(
      plate.outer.map((p) => ({ x: p.x * s, y: p.y * s })),
      eps,
    ),
    holes: plate.holes.map((hole) =>
      rdp(
        hole.map((p) => ({ x: p.x * s, y: p.y * s })),
        eps,
      ),
    ),
    aspect: plate.aspect,
    mask: plate.mask,
    pixelBBox: plate.pixelBBox,
  }
}

export function insetCustomOutline(plate: CustomPlate, widthMm: number, insetMm: number): Polygon {
  const outer = scaleCustomPlate(plate, widthMm).outer
  return insetPolygon(outer, insetMm)
}

export function customFrame(
  plate: CustomPlate,
  widthMm: number,
  frameMm: number,
): { outer: Polygon; hole: Polygon } {
  const scaled = scaleCustomPlate(plate, widthMm)
  const pixelW = Math.max(1e-6, plate.pixelBBox.maxX - plate.pixelBBox.minX)
  const halfPx = widthMm / pixelW / 2
  return {
    outer: insetPolygon(scaled.outer, halfPx),
    hole: insetPolygon(scaled.outer, halfPx + frameMm),
  }
}

export function rdp(points: Polygon, epsilon: number): Polygon {
  if (points.length < 3) return points
  const first = points[0]
  const last = points[points.length - 1]
  let maxDist = 0
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointLineDist(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      idx = i
    }
  }
  if (maxDist <= epsilon) return [first, last]
  const left = rdp(points.slice(0, idx + 1), epsilon)
  const right = rdp(points.slice(idx), epsilon)
  return [...left.slice(0, -1), ...right]
}

function pointLineDist(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
}
