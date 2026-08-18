import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildBodies } from '../src/bodies'
import { prepareTopPlate } from '../src/cassetteParts'
import { encodeQr } from '../src/encode'
import { readBinaryStl, writeBinaryStl } from '../src/stl'
import { clampSettings } from '../src/validate'

function edgeKey(p: number[], q: number[]): string {
  const a = `${p[0].toFixed(5)},${p[1].toFixed(5)},${p[2].toFixed(5)}`
  const b = `${q[0].toFixed(5)},${q[1].toFixed(5)},${q[2].toFixed(5)}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function countBadEdges(tris: { a: number[]; b: number[]; c: number[] }[]) {
  const counts = new Map<string, { n: number; p: number[]; q: number[] }>()
  for (const t of tris) {
    for (const [p, q] of [
      [t.a, t.b],
      [t.b, t.c],
      [t.c, t.a],
    ]) {
      const k = edgeKey(p, q)
      const prev = counts.get(k)
      if (prev) prev.n += 1
      else counts.set(k, { n: 1, p, q })
    }
  }
  let open = 0
  let multi = 0
  const samples: { n: number; p: number[]; q: number[] }[] = []
  for (const v of counts.values()) {
    if (v.n === 2) continue
    if (v.n === 1) open++
    else multi++
    if (samples.length < 6) samples.push(v)
  }
  return { open, multi, samples, edges: [...counts.values()].filter((v) => v.n !== 2) }
}

describe('cassette meshes', () => {
  const load = (name: string) => {
    const buf = readFileSync(join(process.cwd(), 'cassette', name))
    return readBinaryStl(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      .triangles
  }
  const matrix = encodeQr('https://example.com', false)
  const kit = {
    top: prepareTopPlate(load('top-plate-qr.stl')),
    bottom: [],
    slider: [],
    access: [],
  }

  it.each([
    { insetFrame: true, cassetteLid: true },
    { insetFrame: false, cassetteLid: true },
    { insetFrame: false, cassetteLid: false },
  ])('has manifold plates inset=$insetFrame lid=$cassetteLid', (opts) => {
    const tag = clampSettings({
      content: 'https://example.com',
      plateShape: 'cassette',
      blackHeightMm: 0.6,
      ...opts,
    })
    const { black, white } = buildBodies(tag, matrix, undefined, null, kit)
    const b = countBadEdges(black)
    const w = countBadEdges(white)
    expect({
      blackOpen: b.open,
      blackMulti: b.multi,
      whiteOpen: w.open,
      whiteMulti: w.multi,
    }).toEqual({
      blackOpen: 0,
      blackMulti: 0,
      whiteOpen: 0,
      whiteMulti: 0,
    })
    const blackStl = countBadEdges(readBinaryStl(writeBinaryStl(black)).triangles)
    const whiteStl = countBadEdges(readBinaryStl(writeBinaryStl(white)).triangles)
    expect({
      blackOpen: blackStl.open,
      blackMulti: blackStl.multi,
      whiteOpen: whiteStl.open,
      whiteMulti: whiteStl.multi,
    }).toEqual({
      blackOpen: 0,
      blackMulti: 0,
      whiteOpen: 0,
      whiteMulti: 0,
    })
  })

  it('keeps a square tag manifold after an STL round trip', () => {
    const tag = clampSettings({
      content: 'https://example.com',
      plateShape: 'square',
      widthMm: 80,
      blackHeightMm: 0.6,
      insetFrame: true,
    })
    const { black, white } = buildBodies(tag, matrix)
    const b = countBadEdges(readBinaryStl(writeBinaryStl(black)).triangles)
    const w = countBadEdges(readBinaryStl(writeBinaryStl(white)).triangles)
    expect({
      blackOpen: b.open,
      blackMulti: b.multi,
      whiteOpen: w.open,
      whiteMulti: w.multi,
    }).toEqual({
      blackOpen: 0,
      blackMulti: 0,
      whiteOpen: 0,
      whiteMulti: 0,
    })
  })
})
