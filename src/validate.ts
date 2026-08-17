import { CASSETTE_ASPECT, CASSETTE_DEFAULT_WIDTH_MM } from './cassette'
import { LIMITS, type PlateShape, type QrSettings, type QrStyle } from './types'

export { LIMITS, GAP_MM, FRAME_MODULES, QUIET_ZONE_MODULES } from './types'
export type { PlateShape, QrSettings, QrStyle } from './types'

const PLATES: PlateShape[] = [
  'square',
  'circle',
  'rounded',
  'hexagon',
  'rect',
  'dogtag',
  'custom',
  'cassette',
]

export function usesCustomSize(shape: PlateShape): boolean {
  return shape === 'rect' || shape === 'dogtag'
}

export function usesQrOffsetX(_shape: PlateShape): boolean {
  return true
}

export function usesQrOffsetY(_shape: PlateShape): boolean {
  return true
}

export function usesShapeUpload(shape: PlateShape): boolean {
  return shape === 'custom'
}

export function usesAspectHeight(shape: PlateShape): boolean {
  return shape === 'custom' || shape === 'cassette'
}

export function usesCassetteBody(shape: PlateShape): boolean {
  return shape === 'cassette'
}

export function usesQrOffset(shape: PlateShape): boolean {
  return usesQrOffsetX(shape)
}

export function usesDogtagHole(_shape: PlateShape): boolean {
  return true
}

export function usesInsetFrame(_shape: PlateShape): boolean {
  return true
}

export function customPlateHeightMm(widthMm: number, aspect: number): number {
  const ratio = aspect > 0 ? aspect : 1
  return widthMm * ratio
}

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
    plateShape: 'square',
    widthMm: LIMITS.widthMm.default,
    heightMm: LIMITS.heightMm.default,
    qrOffsetXMm: 0,
    qrOffsetYMm: 0,
    qrSizePercent: LIMITS.qrSizePercent.default,
    blackHeightMm: LIMITS.blackHeightMm.default,
    capThicknessMm: LIMITS.capThicknessMm.default,
    logoSizePercent: LIMITS.logoSizePercent.default,
    hasLogo: false,
    dogtagHole: false,
    holeDiameterMm: LIMITS.holeDiameterMm.default,
    customAspect: 1,
    insetFrame: false,
    blankLogo: false,
  }
}

export function clampSettings(raw: Partial<QrSettings>): QrSettings {
  const base = defaultSettings()
  const style: QrStyle =
    raw.style === 'rounded' || raw.style === 'dots' || raw.style === 'square'
      ? raw.style
      : base.style
  const plateShape: PlateShape = PLATES.includes(raw.plateShape as PlateShape)
    ? (raw.plateShape as PlateShape)
    : base.plateShape
  const widthMm = clampNumber(
    raw.widthMm ?? (plateShape === 'cassette' ? CASSETTE_DEFAULT_WIDTH_MM : base.widthMm),
    LIMITS.widthMm.min,
    LIMITS.widthMm.max,
  )
  const heightMm =
    plateShape === 'cassette'
      ? customPlateHeightMm(widthMm, CASSETTE_ASPECT)
      : clampNumber(raw.heightMm ?? base.heightMm, LIMITS.heightMm.min, LIMITS.heightMm.max)
  return {
    content: raw.content ?? base.content,
    style,
    plateShape,
    widthMm,
    heightMm,
    qrOffsetXMm: Number.isFinite(raw.qrOffsetXMm) ? (raw.qrOffsetXMm as number) : base.qrOffsetXMm,
    qrOffsetYMm: Number.isFinite(raw.qrOffsetYMm) ? (raw.qrOffsetYMm as number) : base.qrOffsetYMm,
    qrSizePercent: clampNumber(
      raw.qrSizePercent ?? base.qrSizePercent,
      LIMITS.qrSizePercent.min,
      LIMITS.qrSizePercent.max,
    ),
    blackHeightMm: clampNumber(
      raw.blackHeightMm ?? base.blackHeightMm,
      LIMITS.blackHeightMm.min,
      LIMITS.blackHeightMm.max,
    ),
    capThicknessMm:
      plateShape === 'cassette'
        ? clampNumber(
            raw.capThicknessMm === LIMITS.capThicknessMm.default || raw.capThicknessMm === undefined
              ? LIMITS.cassetteThicknessMm.default
              : raw.capThicknessMm,
            LIMITS.cassetteThicknessMm.min,
            LIMITS.cassetteThicknessMm.max,
          )
        : clampNumber(
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
    dogtagHole: raw.dogtagHole ?? base.dogtagHole,
    holeDiameterMm: clampNumber(
      raw.holeDiameterMm ?? base.holeDiameterMm,
      LIMITS.holeDiameterMm.min,
      LIMITS.holeDiameterMm.max,
    ),
    customAspect: raw.customAspect && raw.customAspect > 0 ? raw.customAspect : base.customAspect,
    insetFrame: raw.insetFrame ?? base.insetFrame,
    blankLogo: raw.blankLogo ?? base.blankLogo,
  }
}
