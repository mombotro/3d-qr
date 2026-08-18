/** ISO/IEC 7810 ID-1 credit card. */
export const CARD_DEFAULT_WIDTH_MM = 85.6
export const CARD_DEFAULT_HEIGHT_MM = 53.98
export const CARD_ASPECT = CARD_DEFAULT_HEIGHT_MM / CARD_DEFAULT_WIDTH_MM
export const CARD_CORNER_MM = 3.18

export function cardCornerMm(widthMm: number): number {
  return CARD_CORNER_MM * (widthMm / CARD_DEFAULT_WIDTH_MM)
}
