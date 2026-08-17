import { describe, expect, it } from 'vitest'
import { canEncode, eccForLogo, encodeQr } from '../src/encode'

describe('eccForLogo', () => {
  it('is H when a logo is present', () => {
    expect(eccForLogo(true)).toBe('H')
  })
  it('is Q when no logo', () => {
    expect(eccForLogo(false)).toBe('Q')
  })
})

describe('encodeQr', () => {
  it('encodes text and reports matching ECC', () => {
    const q = encodeQr('https://example.com', false)
    expect(q.ecc).toBe('Q')
    expect(q.size).toBeGreaterThanOrEqual(21)
    expect(q.modules.length).toBe(q.size)
    expect(q.modules[0].length).toBe(q.size)
  })

  it('uses High ECC when hasLogo is true', () => {
    expect(encodeQr('https://example.com', true).ecc).toBe('H')
  })

  it('places finder-like dark squares at three corners', () => {
    const { modules, size } = encodeQr('HELLO', false)
    const corners = [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ]
    for (const [r0, c0] of corners) {
      expect(modules[r0][c0]).toBe(true)
      expect(modules[r0 + 6][c0 + 6]).toBe(true)
      expect(modules[r0 + 3][c0 + 3]).toBe(true)
    }
  })
})

describe('canEncode', () => {
  it('is false for empty content', () => {
    expect(canEncode('', false)).toBe(false)
  })
  it('is true for a URL', () => {
    expect(canEncode('https://example.com', false)).toBe(true)
  })
  it('is false for text that does not fit version 40', () => {
    expect(canEncode('A'.repeat(4000), true)).toBe(false)
  })
})
