export type QrStyle = 'square' | 'rounded' | 'dots'
export type PlateShape =
  | 'square'
  | 'circle'
  | 'rounded'
  | 'hexagon'
  | 'rect'
  | 'dogtag'
  | 'custom'
  | 'cassette'
  | 'card'
export type EccLevel = 'Q' | 'H'

export type QrSettings = {
  content: string
  style: QrStyle
  plateShape: PlateShape
  widthMm: number
  heightMm: number
  qrOffsetXMm: number
  qrOffsetYMm: number
  qrSizePercent: number
  blackHeightMm: number
  capThicknessMm: number
  logoSizePercent: number
  hasLogo: boolean
  dogtagHole: boolean
  holeDiameterMm: number
  customAspect: number
  insetFrame: boolean
  blankLogo: boolean
  hollow: boolean
  lid: boolean
  cassetteLid: boolean
  cassetteSlider: boolean
  cassetteFlipSlider: boolean
  cassetteAccess: boolean
  cassetteBackRaised: boolean
  cassetteBackWindow: boolean
  extraQrs: ExtraQrStamp[]
  blackTexts: BlackTextStamp[]
  blackImages: BlackImageStamp[]
}

export type ExtraQrStamp = {
  content: string
  sizePercent: number
  xMm: number
  yMm: number
  blankLogo: boolean
  logoSizePercent: number
}

export type BlackTextStamp = {
  text: string
  font: string
  sizeMm: number
  xMm: number
  yMm: number
}

export type BlackImageStamp = {
  sizeMm: number
  xMm: number
  yMm: number
}

export const GAP_MM = 0.2
export const FRAME_MODULES = 2
export const QUIET_ZONE_MODULES = 4
export const ROUNDED_TAG_RADIUS = 0.15
export const WALL_THICKNESS_MM = 1.2
export const LID_THICKNESS_MM = 0.8

export const LIMITS = {
  widthMm: { min: 30, default: 80, max: 200 },
  heightMm: { min: 30, default: 50, max: 200 },
  blackHeightMm: { min: 0.6, default: 0.6, max: 4 },
  capThicknessMm: { min: 0.4, default: 0.8, max: 3 },
  logoSizePercent: { min: 10, default: 20, max: 50 },
  holeDiameterMm: { min: 2, default: 4, max: 12 },
  qrSizePercent: { min: 40, default: 100, max: 200 },
  cassetteThicknessMm: { min: 1, default: 8, max: 8 },
  blackTextSizeMm: { min: 2, default: 6, max: 40 },
  blackImageSizeMm: { min: 2, default: 12, max: 60 },
} as const
