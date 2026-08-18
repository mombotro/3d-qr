import {
  CASSETTE_CORNER_HOLES_CAD_MM,
  CASSETTE_CORNER_PLUG_D_MM,
  CASSETTE_HEIGHT_MM,
  CASSETTE_QR_FACE_Z,
  CASSETTE_WIDTH_MM,
} from './cassette'
import { extrudeRing } from './extrude'
import type { Triangle } from './extrude'
import {
  flipFaceToBed,
  flipMeshX,
  flipMeshY,
  meshBBox,
  placeOnBed,
  translateMesh,
} from './mesh'
import { circlePoly } from './shapes'
import { readBinaryStl } from './stl'

export const CASSETTE_FILES = {
  topLid: 'cassette/top-plate-qr.stl',
  topFlat: 'cassette/top-plate-qr-flat.stl',
  bottomSlider: 'cassette/bottom-shell.stl',
  bottomPlain: 'cassette/bottom-shell-no-slider.stl',
  slider: 'cassette/slider.stl',
  access: 'cassette/shell-acces-1.stl',
} as const

export type CassetteKit = {
  top: Triangle[]
  bottom: Triangle[]
  slider: Triangle[]
  access: Triangle[]
}

export function trianglesFromStl(buffer: ArrayBuffer): Triangle[] {
  return readBinaryStl(buffer).triangles
}

export function plugFlatCornerHoles(tris: Triangle[]): Triangle[] {
  const plugs = CASSETTE_CORNER_HOLES_CAD_MM.flatMap((h) => {
    const y = CASSETTE_HEIGHT_MM - h.y
    return extrudeRing(circlePoly(h.x, y, CASSETTE_CORNER_PLUG_D_MM, 16), [], 0, 2)
  })
  return [...tris, ...plugs]
}

export function prepareTopPlate(tris: Triangle[], plugCorners = false): Triangle[] {
  const b = meshBBox(tris)
  const faceDown = flipFaceToBed(translateMesh(tris, -b.minX, -b.minY, 0), CASSETTE_QR_FACE_Z)
  const upright = flipMeshY(faceDown, CASSETTE_HEIGHT_MM / 2)
  return plugCorners ? plugFlatCornerHoles(upright) : upright
}

export function prepareBottomShell(tris: Triangle[], flipSlider: boolean): Triangle[] {
  const upright = flipMeshY(placeOnBed(tris), CASSETTE_HEIGHT_MM / 2)
  return flipSlider ? flipMeshX(upright, CASSETTE_WIDTH_MM / 2) : upright
}

export function prepareSlider(tris: Triangle[], flipSlider: boolean): Triangle[] {
  const ready = placeOnBed(tris)
  const box = meshBBox(ready)
  const flippedY = flipMeshY(ready, (box.minY + box.maxY) / 2)
  return flipSlider ? flipMeshX(flippedY, (box.minX + box.maxX) / 2) : flippedY
}

export function prepareAccess(tris: Triangle[]): Triangle[] {
  const ready = placeOnBed(tris)
  const box = meshBBox(ready)
  return flipMeshY(ready, (box.minY + box.maxY) / 2)
}

export async function fetchCassetteStl(path: string): Promise<Triangle[]> {
  const url = `${import.meta.env.BASE_URL}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`missing ${path}`)
  return trianglesFromStl(await res.arrayBuffer())
}

export async function loadCassetteKit(opts: {
  lid: boolean
  slider: boolean
  flipSlider: boolean
  access: boolean
}): Promise<CassetteKit> {
  const topPath = opts.lid ? CASSETTE_FILES.topLid : CASSETTE_FILES.topFlat
  const bottomPath = opts.slider ? CASSETTE_FILES.bottomSlider : CASSETTE_FILES.bottomPlain
  const [top, bottom, slider, access] = await Promise.all([
    fetchCassetteStl(topPath),
    fetchCassetteStl(bottomPath),
    opts.slider ? fetchCassetteStl(CASSETTE_FILES.slider) : Promise.resolve([]),
    opts.access ? fetchCassetteStl(CASSETTE_FILES.access) : Promise.resolve([]),
  ])
  return {
    top: prepareTopPlate(top, !opts.lid),
    bottom: prepareBottomShell(bottom, opts.flipSlider),
    slider: slider.length ? prepareSlider(slider, opts.flipSlider) : [],
    access: access.length ? prepareAccess(access) : [],
  }
}
