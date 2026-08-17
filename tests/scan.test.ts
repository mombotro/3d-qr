import { describe, expect, it } from 'vitest'
import { encodeQr } from '../src/encode'
import { makeLayout } from '../src/layout'
import { applyLogoClear } from '../src/logo'
import { decodeBedFace, renderBedFace } from '../src/scan'
import type { PlateShape, QrStyle } from '../src/types'

const content = 'https://example.com'
const styles: QrStyle[] = ['square', 'rounded', 'dots']

function smallLogo(): boolean[][] {
  const mask = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => false))
  for (let r = 5; r < 11; r++) {
    for (let c = 5; c < 11; c++) {
      mask[r][c] = true
    }
  }
  return mask
}

describe('renderBedFace decode', () => {
  for (const style of styles) {
    it(`decodes ${style} without a logo`, () => {
      const matrix = encodeQr(content, false)
      const layout = makeLayout(80, matrix.size)
      const image = renderBedFace({ matrix, layout, style, pixels: 400 })
      expect(decodeBedFace(image)).toBe(content)
    })

    it(`decodes ${style} with a logo`, () => {
      const matrix = encodeQr(content, true)
      const cleared = { ...matrix, modules: applyLogoClear(matrix.modules, 20) }
      const layout = makeLayout(80, cleared.size)
      const image = renderBedFace({
        matrix: cleared,
        layout,
        style,
        logoMask: smallLogo(),
        logoPercent: 20,
        pixels: 400,
      })
      expect(decodeBedFace(image)).toBe(content)
    })
  }
})

describe('renderBedFace decode on tag shapes', () => {
  const plates: PlateShape[] = ['circle', 'rounded', 'hexagon', 'rect', 'dogtag']
  for (const plate of plates) {
    it(`decodes a square module code on a ${plate} tag`, () => {
      const matrix = encodeQr(content, false)
      const layout = makeLayout(80, matrix.size, plate)
      const image = renderBedFace({ matrix, layout, style: 'square', pixels: 500 })
      expect(decodeBedFace(image)).toBe(content)
    })
  }
})
