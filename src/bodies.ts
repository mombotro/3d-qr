import {
  difference,
  intersection,
  union,
  type Pair,
  type Polygon as ClipPolygon,
  type MultiPolygon,
} from 'polygon-clipping'
import type { CustomPlate } from './contour'
import { customFrame, scaleCustomPlate } from './contour'
import type { QrMatrix } from './encode'
import { capFaces, extrudeRing, ringWalls, type Triangle } from './extrude'
import { isReservedCell, makeLayout, moduleOrigin } from './layout'
import { applyLogoClear, logoClearRect, maskToPolygons } from './logo'
import { cleanRing, insetPolygon, offsetPolygon } from './offset'
import { dogtagHole, modulePoly, plateFrameAt, plateOutlineAt, type Polygon } from './shapes'
import {
  CASSETTE_ASPECT,
  CASSETTE_HEAD_STRIP_RAISE_MM,
  CASSETTE_LIP_H_MM,
  CASSETTE_PLATE_T_MM,
  cassetteCornerHoles,
  cassetteFaceWells,
  cassetteFrame,
  cassetteHeadStrip,
  cassetteLipPoly,
  cassetteOutline,
  cassettePlate,
  type CassetteFaceShape,
} from './cassette'
import type { CassetteKit } from './cassetteParts'
import { maskToPlacedShapes, textToShapes } from './text'
import { meshBBox, originPins, translateMesh } from './mesh'
import { customPlateHeightMm } from './validate'
import { GAP_MM, LID_THICKNESS_MM, WALL_THICKNESS_MM, type QrSettings } from './types'

export type ExtraStl = {
  filename: string
  triangles: Triangle[]
}

export type Bodies = {
  black: Triangle[]
  white: Triangle[]
  lid: Triangle[]
  extras: ExtraStl[]
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
  const pts: Polygon = ring.map(([x, y]) => ({ x: x ?? 0, y: y ?? 0 }))
  if (pts.length > 1) {
    const a = pts[0]
    const b = pts[pts.length - 1]
    if (a && b && a.x === b.x && a.y === b.y) pts.pop()
  }
  return cleanRing(pts)
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
  cassette?: CassetteKit | null,
  imageMask?: boolean[][],
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
    settings.plateShape === 'cassette'
      ? cassetteOutline()
      : isShaped && tagPlate
        ? customFrame(tagPlate, layout.widthMm, 0).outer
        : plateOutlineAt(layout.shape, layout.widthMm, layout.heightMm)
  const useInsetFrame = settings.insetFrame
  const frame = !useInsetFrame
    ? null
    : settings.plateShape === 'cassette'
      ? cassetteFrame(layout.frameMm)
      : isShaped && tagPlate
        ? customFrame(tagPlate, layout.widthMm, layout.frameMm)
        : plateFrameAt(layout.shape, layout.widthMm, layout.heightMm, layout.frameMm)
  const faceWells = settings.plateShape === 'cassette' ? cassetteFaceWells() : []
  const faceClips: ClipPolygon[] = faceWells.map((w) => [
    toRing(w.outer),
    ...w.holes.map((h) => toRing(h)),
  ])
  const holeClips: ClipPolygon[] = (scaled?.holes ?? []).map((h) => [toRing(h)])
  const modulesPolys = blackModulePolys(settings, modules, layout)
  const logos =
    logoMask && !settings.blankLogo
      ? logoPolys(matrix.size, layout, logoMask, percent)
      : []
  const textShapes = settings.blackText.trim()
    ? textToShapes(
        settings.blackText,
        settings.blackTextFont,
        settings.blackTextXMm,
        settings.blackTextYMm,
        settings.blackTextSizeMm,
      )
    : []
  const imageShapes = imageMask?.length
    ? maskToPlacedShapes(
        imageMask,
        settings.blackImageXMm,
        settings.blackImageYMm,
        settings.blackImageSizeMm,
      )
    : []
  const stampShapes = [...textShapes, ...imageShapes]
  const qrBlack = unionMany([
    ...[...modulesPolys, ...logos].map((p) => [toRing(offsetPolygon(p, 0.05))]),
    ...stampShapes.map((s) => [toRing(s.outer), ...s.holes.map((h) => toRing(h))]),
  ])
  const qrPunched = holeClips.length && qrBlack.length ? difference(qrBlack, ...holeClips) : qrBlack
  const blackGeom = frame
    ? unionMany([...qrPunched, [toRing(frame.outer), toRing(frame.hole)]])
    : qrPunched
  const black: Triangle[] = extrudeClipped(blackGeom, 0, settings.blackHeightMm)

  const grownModules = [...modulesPolys, ...logos].map((p) => offsetPolygon(p, GAP_MM))
  const stampClips: ClipPolygon[] = stampShapes.map((s) => [
    toRing(offsetPolygon(s.outer, GAP_MM)),
    ...s.holes.map((h) => toRing(h)),
  ])
  const subtractFrame = !useInsetFrame
    ? null
    : settings.plateShape === 'cassette'
      ? cassetteFrame(layout.frameMm + GAP_MM)
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
    ...faceClips,
    ...stampClips,
  ]
  if (tagHole) clips.push([toRing(tagHole.poly)])
  const fill =
    clips.length === 0
      ? [plate]
      : difference(plate, clips.length === 1 ? clips[0] : union(clips[0], ...clips.slice(1)))

  const throughHoles = [...svgHoles, ...(tagHole ? [tagHole.poly] : [])]
  if (settings.plateShape === 'cassette' && cassette) {
    const pins = settings.cassetteLid ? cassetteCornerHoles() : []
    const white = cassetteSolidPlate(
      outline,
      [...throughHoles, ...pins],
      grownModules,
      settings.blackHeightMm,
      settings.cassetteLid,
      subtractFrame,
      faceWells,
      stampClips,
    )
    const box = meshBBox(white)
    const whiteOnOrigin = translateMesh(white, -box.minX, -box.minY, -box.minZ)
    const placed = meshBBox(whiteOnOrigin)
    const blackPinned = [
      ...translateMesh(black, -box.minX, -box.minY, -box.minZ),
      ...originPins(placed.maxX, placed.maxY),
    ]
    const extras: ExtraStl[] = []
    if (cassette.bottom.length) {
      extras.push({ filename: 'cassette-bottom.stl', triangles: cassette.bottom })
    }
    if (cassette.slider.length) {
      extras.push({ filename: 'cassette-slider.stl', triangles: cassette.slider })
    }
    if (cassette.access.length) {
      extras.push({ filename: 'cassette-window.stl', triangles: cassette.access })
    }
    return { black: blackPinned, white: whiteOnOrigin, lid: [], extras }
  }

  const zFloor = settings.blackHeightMm
  const zTop = settings.blackHeightMm + settings.capThicknessMm
  const inner = insetPolygon(outline, WALL_THICKNESS_MM)
  const hollow = settings.hollow && inner.length >= 3
  const raised =
    !hollow && settings.plateShape === 'cassette'
      ? cassetteHeadStrip(layout.widthMm, layout.heightMm)
      : null

  const white = hollow
    ? whiteHollow(outline, inner, fill, throughHoles, 0, zFloor, zTop)
    : whiteSolid(outline, fill, throughHoles, 0, zFloor, zTop, raised)

  const lid = settings.lid ? extrudeRing(outline, throughHoles, 0, LID_THICKNESS_MM) : []

  return { black, white, lid, extras: [] }
}

function unionMany(geoms: ClipPolygon[]): MultiPolygon {
  if (geoms.length === 0) return []
  if (geoms.length === 1) return [geoms[0]]
  return union(geoms[0], ...geoms.slice(1))
}

function clipPieces(geom: MultiPolygon): { outer: Polygon; holes: Polygon[] }[] {
  const out: { outer: Polygon; holes: Polygon[] }[] = []
  for (const poly of geom) {
    if (!poly[0] || poly[0].length < 3) continue
    out.push({ outer: fromRing(poly[0]), holes: poly.slice(1).map(fromRing) })
  }
  return out
}

function extrudeClipped(geom: MultiPolygon, z0: number, z1: number): Triangle[] {
  return clipPieces(geom).flatMap((piece) => extrudeRing(piece.outer, piece.holes, z0, z1))
}

function cassetteSolidPlate(
  outline: Polygon,
  throughHoles: Polygon[],
  qrPockets: Polygon[],
  zQr: number,
  withLip: boolean,
  frame: { outer: Polygon; hole: Polygon } | null,
  faceWells: CassetteFaceShape[] = [],
  extraPockets: ClipPolygon[] = [],
): Triangle[] {
  const z0 = 0
  const zTop = CASSETTE_PLATE_T_MM
  const holeClips = throughHoles.map((h) => [toRing(h)] as ClipPolygon)
  const wellKeep = [toRing(insetPolygon(outline, 0.05))]
  const trimmedWells = faceWells.flatMap((w) =>
    clipPieces(intersection([toRing(w.outer)], wellKeep)).map(
      (piece) => [toRing(piece.outer), ...piece.holes.map((h) => toRing(h))] as ClipPolygon,
    ),
  )
  const pockets: ClipPolygon[] = [
    ...qrPockets.map((p) => [toRing(p)] as ClipPolygon),
    ...trimmedWells,
    ...extraPockets,
  ]
  if (frame) pockets.push([toRing(frame.outer), toRing(frame.hole)])
  const pocketUnion = unionMany(pockets)
  const cutters = [...pocketUnion, ...holeClips]
  const fill =
    cutters.length === 0
      ? [[toRing(outline)]]
      : difference([toRing(outline)], ...unionMany(cutters))
  const tris: Triangle[] = []
  for (const piece of clipPieces(fill)) {
    tris.push(...capFaces(piece.outer, piece.holes, z0, false))
    tris.push(...ringWalls(piece.outer, z0, zQr, true))
    for (const hole of piece.holes) {
      tris.push(...ringWalls(hole, z0, zQr, false))
    }
  }
  if (pocketUnion.length) {
    const qrCeil = holeClips.length
      ? difference(pocketUnion, ...holeClips)
      : pocketUnion
    for (const piece of clipPieces(qrCeil)) {
      tris.push(...capFaces(piece.outer, piece.holes, zQr, false))
    }
  }
  tris.push(...ringWalls(outline, zQr, zTop, true))
  const lip = withLip ? cassetteLipPoly() : null
  if (lip) {
    tris.push(...capFaces(outline, [...throughHoles, lip], zTop, true))
    tris.push(...capFaces(lip, throughHoles, zTop + CASSETTE_LIP_H_MM, true))
    tris.push(...ringWalls(lip, zTop, zTop + CASSETTE_LIP_H_MM, true))
  } else {
    tris.push(...capFaces(outline, throughHoles, zTop, true))
  }
  for (const hole of throughHoles) {
    tris.push(...ringWalls(hole, zQr, zTop, false))
  }
  return tris
}

function whiteSolid(
  outline: Polygon,
  fill: MultiPolygon,
  throughHoles: Polygon[],
  z0: number,
  zFloor: number,
  zTop: number,
  raised: Polygon | null,
): Triangle[] {
  const tris: Triangle[] = []
  for (const piece of clipPieces(fill)) {
    tris.push(...capFaces(piece.outer, piece.holes, z0, false))
    tris.push(...ringWalls(piece.outer, z0, zFloor, true))
    for (const hole of piece.holes) {
      tris.push(...ringWalls(hole, z0, zFloor, false))
    }
  }
  const stepSubs: ClipPolygon[] = [
    ...fill,
    ...throughHoles.map((h) => [toRing(h)]),
  ]
  const step =
    stepSubs.length === 0
      ? []
      : difference([toRing(outline)], ...unionMany(stepSubs))
  for (const piece of clipPieces(step)) {
    tris.push(...capFaces(piece.outer, piece.holes, zFloor, false))
  }
  if (raised && raised.length >= 3) {
    tris.push(...capFaces(outline, [...throughHoles, raised], zTop, true))
    tris.push(...capFaces(raised, [], zTop + CASSETTE_HEAD_STRIP_RAISE_MM, true))
    tris.push(...ringWalls(raised, zTop, zTop + CASSETTE_HEAD_STRIP_RAISE_MM, true))
  } else {
    tris.push(...capFaces(outline, throughHoles, zTop, true))
  }
  tris.push(...ringWalls(outline, zFloor, zTop, true))
  for (const hole of throughHoles) {
    tris.push(...ringWalls(hole, zFloor, zTop, false))
  }
  return tris
}

function whiteHollow(
  outline: Polygon,
  inner: Polygon,
  fill: MultiPolygon,
  throughHoles: Polygon[],
  z0: number,
  zFloor: number,
  zTop: number,
): Triangle[] {
  const tris: Triangle[] = []
  for (const piece of clipPieces(fill)) {
    tris.push(...capFaces(piece.outer, piece.holes, z0, false))
    tris.push(...ringWalls(piece.outer, z0, zFloor, true))
    for (const hole of piece.holes) {
      tris.push(...ringWalls(hole, z0, zFloor, false))
    }
  }
  const tops = fill.flatMap((piece) => intersection(piece, [toRing(inner)]))
  for (const piece of clipPieces(tops)) {
    tris.push(...capFaces(piece.outer, piece.holes, zFloor, true))
  }
  tris.push(...capFaces(outline, [inner], zTop, true))
  tris.push(...ringWalls(outline, zFloor, zTop, true))
  tris.push(...ringWalls(inner, zFloor, zTop, false))
  return tris
}
