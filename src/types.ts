export type QrStyle = 'square' | 'rounded' | 'dots'
export type EccLevel = 'Q' | 'H'

export type QrSettings = {
  content: string
  style: QrStyle
  widthMm: number
  blackHeightMm: number
  capThicknessMm: number
  logoSizePercent: number
  hasLogo: boolean
}

export const GAP_MM = 0.2
export const FRAME_MODULES = 2
export const QUIET_ZONE_MODULES = 4

export const LIMITS = {
  widthMm: { min: 30, default: 80, max: 200 },
  blackHeightMm: { min: 0.6, default: 1.2, max: 4 },
  capThicknessMm: { min: 0.4, default: 0.8, max: 3 },
  logoSizePercent: { min: 10, default: 20, max: 30 },
} as const
