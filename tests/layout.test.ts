import { describe, expect, it } from 'vitest'
import { FRAME_MODULES, QUIET_ZONE_MODULES } from '../src/types'
import {
  isFinderCell,
  isReservedCell,
  makeLayout,
  maxLogoPercent,
  moduleOrigin,
} from '../src/layout'

describe('makeLayout', () => {
  it('uses the full width including frame and quiet zone', () => {
    const size = 25
    const layout = makeLayout(80, size)
    const modules = size + 2 * FRAME_MODULES + 2 * QUIET_ZONE_MODULES
    expect(layout.moduleMm).toBeCloseTo(80 / modules)
    expect(layout.frameMm).toBeCloseTo(2 * layout.moduleMm)
    expect(layout.quietZoneMm).toBeCloseTo(4 * layout.moduleMm)
    expect(layout.matrixOriginX).toBeCloseTo(6 * layout.moduleMm)
    expect(layout.matrixOriginY).toBeCloseTo(6 * layout.moduleMm)
    expect(layout.widthMm).toBe(80)
    expect(layout.heightMm).toBe(80)
    expect(layout.shape).toBe('square')
  })

  it('sizes a circle so the QR square fits inside the inner disk', () => {
    const size = 25
    const layout = makeLayout(80, size, 'circle')
    const content = (size + 2 * QUIET_ZONE_MODULES) * layout.moduleMm
    const inner = 80 - 2 * layout.frameMm
    expect(content).toBeCloseTo(inner / Math.SQRT2, 5)
    expect(layout.moduleMm).toBeLessThan(80 / (size + 2 * FRAME_MODULES + 2 * QUIET_ZONE_MODULES))
  })

  it('uses flat-to-flat width for a hexagon bounding height', () => {
    const layout = makeLayout(80, 25, 'hexagon')
    expect(layout.heightMm).toBeCloseTo(80)
    expect(layout.widthMm).toBeCloseTo((80 * 2) / Math.sqrt(3))
  })

  it('uses the shorter side of a custom rectangle for module size', () => {
    const size = 25
    const layout = makeLayout(80, size, 'rect', 50)
    const pitch = size + 2 * FRAME_MODULES + 2 * QUIET_ZONE_MODULES
    expect(layout.widthMm).toBe(80)
    expect(layout.heightMm).toBe(50)
    expect(layout.moduleMm).toBeCloseTo(50 / pitch)
    expect(layout.matrixOriginY).toBeCloseTo((50 - (size + 8) * layout.moduleMm) / 2 + 4 * layout.moduleMm)
  })

  it('shifts a rectangle QR by the given offset', () => {
    const centered = makeLayout(80, 25, 'rect', 50)
    const shifted = makeLayout(80, 25, 'rect', 50, 8, 0)
    expect(shifted.matrixOriginX).toBeCloseTo(centered.matrixOriginX + 8)
    expect(shifted.matrixOriginY).toBeCloseTo(centered.matrixOriginY)
  })

  it('allows X offset on a dog tag', () => {
    const centered = makeLayout(80, 25, 'dogtag', 40)
    const shifted = makeLayout(80, 25, 'dogtag', 40, 6, 0)
    expect(shifted.matrixOriginX).toBeGreaterThan(centered.matrixOriginX)
    expect(shifted.qrOffsetXMm).toBeCloseTo(6)
    expect(shifted.qrOffsetYMm).toBe(0)
  })

  it('allows X and Y offset on a square when the QR is smaller', () => {
    const centered = makeLayout(80, 25, 'square', undefined, 0, 0, false, 4, 50)
    const shifted = makeLayout(80, 25, 'square', undefined, 4, -3, false, 4, 50)
    expect(shifted.matrixOriginX).toBeCloseTo(centered.matrixOriginX + 4)
    expect(shifted.matrixOriginY).toBeCloseTo(centered.matrixOriginY - 3)
  })

  it('can grow a QR above 100 percent until it hits the frame', () => {
    const full = makeLayout(80, 25, 'square')
    const big = makeLayout(80, 25, 'square', undefined, 0, 0, false, 4, 150)
    expect(big.moduleMm).toBeGreaterThan(full.moduleMm)
    expect(big.qrSizePercent).toBeGreaterThan(100)
    expect(big.qrSizePercent).toBeLessThanOrEqual(150)
    const span = 25 * big.moduleMm + 2 * big.quietZoneMm + 2 * big.frameMm
    expect(span).toBeLessThanOrEqual(80 + 1e-6)
  })

  it('scales the QR down on every tag shape', () => {
    const full = makeLayout(80, 25, 'square')
    const half = makeLayout(80, 25, 'square', undefined, 0, 0, false, 4, 50)
    expect(half.moduleMm).toBeCloseTo(full.moduleMm * 0.5)
    expect(half.frameMm).toBeCloseTo(full.frameMm)
    const custom = makeLayout(80, 25, 'custom', 40, 0, 0, false, 4, 60)
    const customFull = makeLayout(80, 25, 'custom', 40)
    expect(custom.moduleMm).toBeCloseTo(customFull.moduleMm * 0.6)
  })

  it('sizes a credit card like a rectangle of the same aspect', () => {
    const height = 85.6 * (53.98 / 85.6)
    const card = makeLayout(85.6, 25, 'card', height)
    const rect = makeLayout(85.6, 25, 'rect', height)
    expect(card.widthMm).toBeCloseTo(85.6)
    expect(card.heightMm).toBeCloseTo(53.98)
    expect(card.moduleMm).toBeCloseTo(rect.moduleMm)
  })

  it('sizes a cassette like a custom plate of the same aspect', () => {
    const height = 80 * (63.6 / 100.11)
    const cassette = makeLayout(80, 25, 'cassette', height)
    const custom = makeLayout(80, 25, 'custom', height)
    expect(cassette.widthMm).toBe(80)
    expect(cassette.heightMm).toBeCloseTo(height)
    expect(cassette.moduleMm).toBeCloseTo(custom.moduleMm)
  })

  it('shifts a custom SVG QR on X and Y', () => {
    const centered = makeLayout(80, 25, 'custom', 80, 0, 0, false, 4, 60)
    const shifted = makeLayout(80, 25, 'custom', 80, 5, -3, false, 4, 60)
    expect(shifted.matrixOriginX).toBeCloseTo(centered.matrixOriginX + 5)
    expect(shifted.matrixOriginY).toBeCloseTo(centered.matrixOriginY - 3)
  })

  it('clamps the offset with a one-module edge margin', () => {
    const centered = makeLayout(80, 25, 'rect', 50)
    const shifted = makeLayout(80, 25, 'rect', 50, 1000, -1000)
    const matrix = 25 * shifted.moduleMm
    const edge = shifted.moduleMm
    const maxX = (80 - 2 * edge - matrix) / 2
    const maxY = (50 - 2 * edge - matrix) / 2
    expect(shifted.qrOffsetXMm).toBeCloseTo(maxX)
    expect(shifted.qrOffsetYMm).toBeCloseTo(-maxY)
    expect(shifted.matrixOriginX).toBeCloseTo(centered.matrixOriginX + maxX)
    expect(shifted.matrixOriginY).toBeCloseTo(centered.matrixOriginY - maxY)
  })

  it('lets a cassette QR reach a left spindle', () => {
    const height = 80 * (63.6 / 100.11)
    const holeX = (28.5 / 100.11) * 80 - 40
    const holeY = ((63.6 - 35) / 100.11) * 80 - height / 2
    const shifted = makeLayout(80, 25, 'cassette', height, holeX, holeY)
    expect(shifted.qrOffsetXMm).toBeCloseTo(holeX)
    expect(shifted.qrOffsetYMm).toBeCloseTo(holeY)
  })
})

describe('moduleOrigin', () => {
  it('places 0,0 at the matrix origin', () => {
    const layout = makeLayout(80, 21)
    const p = moduleOrigin(layout, 0, 0)
    expect(p.x).toBeCloseTo(layout.matrixOriginX)
    expect(p.y).toBeCloseTo(layout.matrixOriginY)
  })
})

describe('isFinderCell', () => {
  it('marks three 7x7 corners and not the center', () => {
    expect(isFinderCell(21, 0, 0)).toBe(true)
    expect(isFinderCell(21, 6, 6)).toBe(true)
    expect(isFinderCell(21, 0, 14)).toBe(true)
    expect(isFinderCell(21, 14, 0)).toBe(true)
    expect(isFinderCell(21, 10, 10)).toBe(false)
    expect(isFinderCell(21, 7, 7)).toBe(false)
  })
})

describe('isReservedCell', () => {
  it('keeps timing and finder-separator reserved', () => {
    expect(isReservedCell(21, 6, 10)).toBe(true)
    expect(isReservedCell(21, 10, 6)).toBe(true)
    expect(isReservedCell(21, 7, 0)).toBe(true)
  })
})

describe('maxLogoPercent', () => {
  it('allows up to 50 percent on small and large codes', () => {
    expect(maxLogoPercent(21)).toBe(50)
    expect(maxLogoPercent(25)).toBe(50)
  })
})
