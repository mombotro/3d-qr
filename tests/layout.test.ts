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
    expect(layout.matrixOriginMm).toBeCloseTo(6 * layout.moduleMm)
    expect(layout.widthMm).toBe(80)
  })
})

describe('moduleOrigin', () => {
  it('places 0,0 at the matrix origin', () => {
    const layout = makeLayout(80, 21)
    const p = moduleOrigin(layout, 0, 0)
    expect(p.x).toBeCloseTo(layout.matrixOriginMm)
    expect(p.y).toBeCloseTo(layout.matrixOriginMm)
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
  it('caps version 1 below 30 so finders stay clear', () => {
    expect(maxLogoPercent(21)).toBe(23)
  })
  it('caps larger codes at 30', () => {
    expect(maxLogoPercent(25)).toBe(30)
  })
})
