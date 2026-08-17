import { encode } from 'uqr'
import type { EccLevel } from './types'

export type QrMatrix = {
  size: number
  version: number
  ecc: EccLevel
  modules: boolean[][]
}

export function eccForLogo(hasLogo: boolean): EccLevel {
  return hasLogo ? 'H' : 'Q'
}

export function encodeQr(content: string, hasLogo: boolean): QrMatrix {
  const ecc = eccForLogo(hasLogo)
  const result = encode(content, { ecc, border: 0 })
  return {
    size: result.size,
    version: result.version,
    ecc,
    modules: result.data,
  }
}

export function canEncode(content: string, hasLogo: boolean): boolean {
  if (content.length === 0) return false
  try {
    encodeQr(content, hasLogo)
    return true
  } catch {
    return false
  }
}
