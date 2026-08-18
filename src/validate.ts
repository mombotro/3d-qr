import { CARD_ASPECT, CARD_DEFAULT_WIDTH_MM } from './card'
import { CASSETTE_ASPECT, CASSETTE_DEFAULT_WIDTH_MM, CASSETTE_WIDTH_MM } from './cassette'
import { isTextFontId } from './text'
import {
  LIMITS,
  type BlackImageStamp,
  type BlackTextStamp,
  type ExtraQrStamp,
  type PlateShape,
  type QrSettings,
  type QrStyle,
} from './types'

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
  'card',
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
  return shape === 'custom' || shape === 'cassette' || shape === 'card'
}

export function usesCassetteBody(shape: PlateShape): boolean {
  return shape === 'cassette'
}

export function usesFixedSize(shape: PlateShape): boolean {
  return shape === 'cassette'
}

export function usesQrOffset(shape: PlateShape): boolean {
  return usesQrOffsetX(shape)
}

export function usesDogtagHole(shape: PlateShape): boolean {
  return shape !== 'cassette'
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
    hollow: false,
    lid: false,
    cassetteLid: true,
    cassetteSlider: true,
    cassetteFlipSlider: false,
    cassetteAccess: true,
    extraQrs: [],
    blackTexts: [],
    blackImages: [],
  }
}

export function defaultExtraQr(): ExtraQrStamp {
  return {
    content: '',
    sizePercent: 50,
    xMm: 16,
    yMm: 0,
    blankLogo: false,
    logoSizePercent: LIMITS.logoSizePercent.default,
  }
}

export function defaultTextStamp(): BlackTextStamp {
  return {
    text: '',
    font: 'sans',
    sizeMm: LIMITS.blackTextSizeMm.default,
    xMm: 4,
    yMm: 4,
  }
}

export function defaultImageStamp(): BlackImageStamp {
  return {
    sizeMm: LIMITS.blackImageSizeMm.default,
    xMm: 4,
    yMm: 16,
  }
}

function clampExtraQr(raw: Partial<ExtraQrStamp>): ExtraQrStamp {
  const base = defaultExtraQr()
  return {
    content: String(raw.content ?? base.content),
    sizePercent: clampNumber(
      raw.sizePercent ?? base.sizePercent,
      LIMITS.qrSizePercent.min,
      LIMITS.qrSizePercent.max,
    ),
    xMm: Number.isFinite(raw.xMm) ? (raw.xMm as number) : base.xMm,
    yMm: Number.isFinite(raw.yMm) ? (raw.yMm as number) : base.yMm,
    blankLogo: raw.blankLogo ?? base.blankLogo,
    logoSizePercent: clampNumber(
      raw.logoSizePercent ?? base.logoSizePercent,
      LIMITS.logoSizePercent.min,
      LIMITS.logoSizePercent.max,
    ),
  }
}

function clampExtraQrList(raw: Partial<QrSettings>): ExtraQrStamp[] {
  if (!Array.isArray(raw.extraQrs)) return []
  return raw.extraQrs.slice(0, 8).map(clampExtraQr)
}

function clampTextStamp(raw: Partial<BlackTextStamp>): BlackTextStamp {
  const base = defaultTextStamp()
  return {
    text: String(raw.text ?? base.text).slice(0, 80),
    font: isTextFontId(raw.font ?? '') ? raw.font! : base.font,
    sizeMm: clampNumber(raw.sizeMm ?? base.sizeMm, LIMITS.blackTextSizeMm.min, LIMITS.blackTextSizeMm.max),
    xMm: Number.isFinite(raw.xMm) ? (raw.xMm as number) : base.xMm,
    yMm: Number.isFinite(raw.yMm) ? (raw.yMm as number) : base.yMm,
  }
}

function clampImageStamp(raw: Partial<BlackImageStamp>): BlackImageStamp {
  const base = defaultImageStamp()
  return {
    sizeMm: clampNumber(
      raw.sizeMm ?? base.sizeMm,
      LIMITS.blackImageSizeMm.min,
      LIMITS.blackImageSizeMm.max,
    ),
    xMm: Number.isFinite(raw.xMm) ? (raw.xMm as number) : base.xMm,
    yMm: Number.isFinite(raw.yMm) ? (raw.yMm as number) : base.yMm,
  }
}

function clampTextList(raw: Partial<QrSettings>): BlackTextStamp[] {
  if (Array.isArray(raw.blackTexts)) return raw.blackTexts.slice(0, 8).map(clampTextStamp)
  const legacy = raw as Partial<QrSettings> & {
    blackText?: string
    blackTextFont?: string
    blackTextSizeMm?: number
    blackTextXMm?: number
    blackTextYMm?: number
  }
  if (legacy.blackText?.trim()) {
    return [
      clampTextStamp({
        text: legacy.blackText,
        font: legacy.blackTextFont,
        sizeMm: legacy.blackTextSizeMm,
        xMm: legacy.blackTextXMm,
        yMm: legacy.blackTextYMm,
      }),
    ]
  }
  return []
}

function clampImageList(raw: Partial<QrSettings>): BlackImageStamp[] {
  if (Array.isArray(raw.blackImages)) return raw.blackImages.slice(0, 8).map(clampImageStamp)
  const legacy = raw as Partial<QrSettings> & {
    blackImageSizeMm?: number
    blackImageXMm?: number
    blackImageYMm?: number
  }
  if (
    legacy.blackImageSizeMm !== undefined ||
    legacy.blackImageXMm !== undefined ||
    legacy.blackImageYMm !== undefined
  ) {
    return [
      clampImageStamp({
        sizeMm: legacy.blackImageSizeMm,
        xMm: legacy.blackImageXMm,
        yMm: legacy.blackImageYMm,
      }),
    ]
  }
  return []
}

function defaultWidthMm(shape: PlateShape): number {
  if (shape === 'cassette') return CASSETTE_DEFAULT_WIDTH_MM
  if (shape === 'card') return CARD_DEFAULT_WIDTH_MM
  return LIMITS.widthMm.default
}

function aspectFor(shape: PlateShape): number | null {
  if (shape === 'cassette') return CASSETTE_ASPECT
  if (shape === 'card') return CARD_ASPECT
  return null
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
  const widthMm =
    plateShape === 'cassette'
      ? CASSETTE_WIDTH_MM
      : clampNumber(
          raw.widthMm ?? defaultWidthMm(plateShape),
          LIMITS.widthMm.min,
          LIMITS.widthMm.max,
        )
  const aspect = aspectFor(plateShape)
  const heightMm = aspect
    ? customPlateHeightMm(widthMm, aspect)
    : clampNumber(raw.heightMm ?? base.heightMm, LIMITS.heightMm.min, LIMITS.heightMm.max)
  const cassette = plateShape === 'cassette'
  const hollow = cassette ? false : (raw.hollow ?? base.hollow)
  const lid = cassette ? false : hollow && (raw.lid ?? base.lid)
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
    dogtagHole: plateShape === 'cassette' ? false : (raw.dogtagHole ?? base.dogtagHole),
    holeDiameterMm: clampNumber(
      raw.holeDiameterMm ?? base.holeDiameterMm,
      LIMITS.holeDiameterMm.min,
      LIMITS.holeDiameterMm.max,
    ),
    customAspect: raw.customAspect && raw.customAspect > 0 ? raw.customAspect : base.customAspect,
    insetFrame: raw.insetFrame ?? base.insetFrame,
    blankLogo: raw.blankLogo ?? base.blankLogo,
    hollow,
    lid,
    cassetteLid: raw.cassetteLid ?? base.cassetteLid,
    cassetteSlider: raw.cassetteSlider ?? base.cassetteSlider,
    cassetteFlipSlider: raw.cassetteFlipSlider ?? base.cassetteFlipSlider,
    cassetteAccess: raw.cassetteAccess ?? base.cassetteAccess,
    extraQrs: clampExtraQrList(raw),
    blackTexts: clampTextList(raw),
    blackImages: clampImageList(raw),
  }
}
