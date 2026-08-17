import { difference } from 'polygon-clipping'
import type { QrMatrix } from './encode'
import { extrudeRing, type Triangle } from './extrude'
import { isFinderCell, makeLayout, moduleOrigin } from './layout'
import { applyLogoClear, logoClearRect, maskToPolygons } from './logo'
import { offsetPolygon } from './offset'
import { frameRing, modulePoly, squarePoly, type Polygon } from './shapes'
import { GAP_MM, type QrSettings } from './types'

export type Bodies = {
  black: Triangle[]
  white: Triangle[]
}

function toRing(poly: Polygon): number[][] {
  const ring = poly.map((p) => [p.x, p.y])
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (!first || !last) return ring
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]])
  }
  return ring
}

function fromRing(ring: number[][]): Polygon {
  const pts: Polygon = ring.map(([x, y]) => ({ x, y }))
  if (pts.length > 1) {
    const a = pts[0]
    const b = pts[pts.length - 1]
    if (a.x === b.x && a.y === b.y) pts.pop()
  }
  return pts
}

function blackModulePolys(
  settings: QrSettings,
  modules: boolean[][],
  layout: ReturnType<typeof makeLayout>,
): Polygon[] {
  const polys: Polygon[] = []
  for (let r = 0; r < modules.length; r++) {
    for (let c = 0; c < modules[r].length; c++) {
      if (!modules[r][c]) continue
      const o = moduleOrigin(layout, r, c)
      polys.push(
        modulePoly(
          settings.style,
          o.x,
          o.y,
          layout.moduleMm,
          isFinderCell(layout.matrixSize, r, c),
        ),
      )
    }
  }
  return polys
}

function logoPolys(
  settings: QrSettings,
  matrixSize: number,
  layout: ReturnType<typeof makeLayout>,
  logoMask: boolean[][],
): Polygon[] {
  const { r0, c0, r1, c1 } = logoClearRect(matrixSize, settings.logoSizePercent)
  const origin = moduleOrigin(layout, r0, c0)
  const side = layout.moduleMm * (r1 - r0)
  return maskToPolygons(logoMask, origin.x, origin.y, side, side)
}

export function buildBodies(
  settings: QrSettings,
  matrix: QrMatrix,
  logoMask?: boolean[][],
): Bodies {
  const layout = makeLayout(settings.widthMm, matrix.size)
  const modules = logoMask
    ? applyLogoClear(matrix.modules, settings.logoSizePercent)
    : matrix.modules
  const frame = frameRing(layout.widthMm, layout.frameMm)
  const modulesPolys = blackModulePolys(settings, modules, layout)
  const logos = logoMask ? logoPolys(settings, matrix.size, layout, logoMask) : []

  const black: Triangle[] = [
    ...extrudeRing(frame.outer, [frame.hole], 0, settings.blackHeightMm),
    ...modulesPolys.flatMap((p) => extrudeRing(p, [], 0, settings.blackHeightMm)),
    ...logos.flatMap((p) => extrudeRing(p, [], 0, settings.blackHeightMm)),
  ]

  const grownModules = [...modulesPolys, ...logos].map((p) => offsetPolygon(p, GAP_MM))
  const subtractFrame = {
    outer: squarePoly(0, 0, layout.widthMm),
    hole: squarePoly(
      layout.frameMm + GAP_MM,
      layout.frameMm + GAP_MM,
      layout.widthMm - 2 * (layout.frameMm + GAP_MM),
    ),
  }

  const plate = [toRing(squarePoly(0, 0, layout.widthMm))]
  const clips = [
    [toRing(subtractFrame.outer), toRing(subtractFrame.hole)],
    ...grownModules.map((p) => [toRing(p)]),
  ]
  const fill = difference(plate, ...clips)

  const white: Triangle[] = []
  for (const poly of fill) {
    if (!poly[0] || poly[0].length < 3) continue
    const outer = fromRing(poly[0])
    const holes = poly.slice(1).map(fromRing)
    white.push(...extrudeRing(outer, holes, 0, settings.blackHeightMm))
  }
  white.push(
    ...extrudeRing(
      squarePoly(0, 0, layout.widthMm),
      [],
      settings.blackHeightMm,
      settings.blackHeightMm + settings.capThicknessMm,
    ),
  )

  return { black, white }
}
