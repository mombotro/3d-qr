import { difference, union, type Pair, type Polygon as ClipPolygon } from 'polygon-clipping'
import type { CustomPlate } from './contour'
import { customFrame, scaleCustomPlate } from './contour'
import type { QrMatrix } from './encode'
import { extrudeRing, type Triangle } from './extrude'
import { isReservedCell, makeLayout, moduleOrigin } from './layout'
import { applyLogoClear, logoClearRect, maskToPolygons } from './logo'
import { offsetPolygon } from './offset'
import { dogtagHole, modulePoly, plateFrameAt, plateOutlineAt, type Polygon } from './shapes'
import {
  CASSETTE_ASPECT,
  CASSETTE_HEAD_STRIP_RAISE_MM,
  cassetteHeadStrip,
  cassettePlate,
} from './cassette'
import { customPlateHeightMm } from './validate'
import { GAP_MM, type QrSettings } from './types'

export type Bodies = {
  black: Triangle[]
  white: Triangle[]
}

function toRing(poly: Polygon): Pair[] {
  const ring: Pair[] = poly.map((p) => [p.x, p.y])
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
          isReservedCell(layout.matrixSize, r, c),
        ),
      )
    }
  }
  return polys
}

function logoPolys(
  matrixSize: number,
  layout: ReturnType<typeof makeLayout>,
  logoMask: boolean[][],
  percent: number,
): Polygon[] {
  const { r0, c0, r1 } = logoClearRect(matrixSize, percent)
  const origin = moduleOrigin(layout, r0, c0)
  const side = layout.moduleMm * (r1 - r0)
  return maskToPolygons(logoMask, origin.x, origin.y, side, side)
}

function shapedPlate(
  settings: QrSettings,
  customPlate?: CustomPlate | null,
): CustomPlate | null {
  if (settings.plateShape === 'cassette') return cassettePlate()
  if (settings.plateShape === 'custom' && customPlate) return customPlate
  return null
}

export function buildBodies(
  settings: QrSettings,
  matrix: QrMatrix,
  logoMask?: boolean[][],
  customPlate?: CustomPlate | null,
): Bodies {
  const tagPlate = shapedPlate(settings, customPlate)
  const isShaped = Boolean(tagPlate)
  const tagHeight = isShaped && tagPlate
    ? customPlateHeightMm(
        settings.widthMm,
        settings.plateShape === 'cassette' ? CASSETTE_ASPECT : tagPlate.aspect,
      )
    : settings.heightMm
  const layout = makeLayout(
    settings.widthMm,
    matrix.size,
    settings.plateShape,
    tagHeight,
    settings.qrOffsetXMm,
    settings.qrOffsetYMm,
    settings.dogtagHole,
    settings.holeDiameterMm,
    settings.qrSizePercent,
  )
  const percent = settings.logoSizePercent
  const clearLogo = settings.blankLogo || Boolean(logoMask)
  const modules = clearLogo ? applyLogoClear(matrix.modules, percent) : matrix.modules
  const scaled = isShaped && tagPlate ? scaleCustomPlate(tagPlate, layout.widthMm) : null
  const outline =
    isShaped && tagPlate
      ? customFrame(tagPlate, layout.widthMm, 0).outer
      : plateOutlineAt(layout.shape, layout.widthMm, layout.heightMm)
  const useInsetFrame = settings.insetFrame
  const frame = !useInsetFrame
    ? null
    : isShaped && tagPlate
      ? customFrame(tagPlate, layout.widthMm, layout.frameMm)
      : plateFrameAt(layout.shape, layout.widthMm, layout.heightMm, layout.frameMm)
  const modulesPolys = blackModulePolys(settings, modules, layout)
  const logos =
    logoMask && !settings.blankLogo
      ? logoPolys(matrix.size, layout, logoMask, percent)
      : []

  const black: Triangle[] = [
    ...(frame ? extrudeRing(frame.outer, [frame.hole], 0, settings.blackHeightMm) : []),
    ...modulesPolys.flatMap((p) => extrudeRing(p, [], 0, settings.blackHeightMm)),
    ...logos.flatMap((p) => extrudeRing(p, [], 0, settings.blackHeightMm)),
  ]

  const grownModules = [...modulesPolys, ...logos].map((p) => offsetPolygon(p, GAP_MM))
  const subtractFrame = !useInsetFrame
    ? null
    : isShaped && tagPlate
      ? customFrame(tagPlate, layout.widthMm, layout.frameMm + GAP_MM)
      : plateFrameAt(
          layout.shape,
          layout.widthMm,
          layout.heightMm,
          layout.frameMm + GAP_MM,
        )

  const tagHole = settings.dogtagHole
    ? dogtagHole(layout.widthMm, layout.heightMm, settings.holeDiameterMm)
    : null
  const svgHoles = scaled?.holes ?? []
  const plate: ClipPolygon = [toRing(outline)]
  const clips: ClipPolygon[] = [
    ...(subtractFrame ? [[toRing(subtractFrame.outer), toRing(subtractFrame.hole)]] : []),
    ...grownModules.map((p) => [toRing(p)]),
    ...svgHoles.map((h) => [toRing(h)]),
  ]
  if (tagHole) clips.push([toRing(tagHole.poly)])
  const fill =
    clips.length === 0
      ? [plate]
      : difference(plate, clips.length === 1 ? clips[0] : union(clips[0], ...clips.slice(1)))

  const white: Triangle[] = []
  for (const poly of fill) {
    if (!poly[0] || poly[0].length < 3) continue
    const outer = fromRing(poly[0])
    const holes = poly.slice(1).map(fromRing)
    white.push(...extrudeRing(outer, holes, 0, settings.blackHeightMm))
  }
  const capHoles = [...svgHoles, ...(tagHole ? [tagHole.poly] : [])]
  const capTop = settings.blackHeightMm + settings.capThicknessMm
  white.push(...extrudeRing(outline, capHoles, settings.blackHeightMm, capTop))
  if (settings.plateShape === 'cassette') {
    const strip = cassetteHeadStrip(layout.widthMm, layout.heightMm)
    white.push(...extrudeRing(strip, [], capTop, capTop + CASSETTE_HEAD_STRIP_RAISE_MM))
  }

  return { black, white }
}
