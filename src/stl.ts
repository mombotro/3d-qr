import type { Triangle } from './extrude'

export type { Triangle }

export function writeBinaryStl(triangles: Triangle[]): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + 50 * triangles.length)
  const view = new DataView(buffer)
  view.setUint32(80, triangles.length, true)
  let o = 84
  for (const t of triangles) {
    for (const v of [t.n, t.a, t.b, t.c]) {
      view.setFloat32(o, v[0], true)
      view.setFloat32(o + 4, v[1], true)
      view.setFloat32(o + 8, v[2], true)
      o += 12
    }
    view.setUint16(o, 0, true)
    o += 2
  }
  return buffer
}

export function readBinaryStl(buffer: ArrayBuffer): { triangleCount: number; triangles: Triangle[] } {
  const view = new DataView(buffer)
  const triangleCount = view.getUint32(80, true)
  const triangles: Triangle[] = []
  let o = 84
  for (let i = 0; i < triangleCount; i++) {
    const n: [number, number, number] = [
      view.getFloat32(o, true),
      view.getFloat32(o + 4, true),
      view.getFloat32(o + 8, true),
    ]
    o += 12
    const a: [number, number, number] = [
      view.getFloat32(o, true),
      view.getFloat32(o + 4, true),
      view.getFloat32(o + 8, true),
    ]
    o += 12
    const b: [number, number, number] = [
      view.getFloat32(o, true),
      view.getFloat32(o + 4, true),
      view.getFloat32(o + 8, true),
    ]
    o += 12
    const c: [number, number, number] = [
      view.getFloat32(o, true),
      view.getFloat32(o + 4, true),
      view.getFloat32(o + 8, true),
    ]
    o += 14
    triangles.push({ n, a, b, c })
  }
  return { triangleCount, triangles }
}
