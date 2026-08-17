import { LIMITS, type QrSettings, type QrStyle } from './types'

export { LIMITS, GAP_MM, FRAME_MODULES, QUIET_ZONE_MODULES } from './types'
export type { QrSettings, QrStyle } from './types'

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

export function defaultSettings(): QrSettings {
  return {
    content: '',
    style: 'square',
    widthMm: LIMITS.widthMm.default,
    blackHeightMm: LIMITS.blackHeightMm.default,
    capThicknessMm: LIMITS.capThicknessMm.default,
    logoSizePercent: LIMITS.logoSizePercent.default,
    hasLogo: false,
  }
}

export function clampSettings(raw: Partial<QrSettings>): QrSettings {
  const base = defaultSettings()
  const style: QrStyle =
    raw.style === 'rounded' || raw.style === 'dots' || raw.style === 'square'
      ? raw.style
      : base.style
  return {
    content: raw.content ?? base.content,
    style,
    widthMm: clampNumber(raw.widthMm ?? base.widthMm, LIMITS.widthMm.min, LIMITS.widthMm.max),
    blackHeightMm: clampNumber(
      raw.blackHeightMm ?? base.blackHeightMm,
      LIMITS.blackHeightMm.min,
      LIMITS.blackHeightMm.max,
    ),
    capThicknessMm: clampNumber(
      raw.capThicknessMm ?? base.capThicknessMm,
      LIMITS.capThicknessMm.min,
      LIMITS.capThicknessMm.max,
    ),
    logoSizePercent: clampNumber(
      raw.logoSizePercent ?? base.logoSizePercent,
      LIMITS.logoSizePercent.min,
      LIMITS.logoSizePercent.max,
    ),
    hasLogo: raw.hasLogo ?? base.hasLogo,
  }
}
