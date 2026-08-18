import { maskToShapes, rdp, type MaskShape } from './contour'
import { thresholdMask } from './logo'

export const BLACK_TEXT_FONTS = [
  { id: 'sans', label: 'Sans', css: 'Arial, Helvetica, sans-serif' },
  { id: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", Times, serif' },
  { id: 'mono', label: 'Mono', css: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
] as const

export type BlackTextFontId = (typeof BLACK_TEXT_FONTS)[number]['id']

export function textFontCss(id: string): string {
  return BLACK_TEXT_FONTS.find((f) => f.id === id)?.css ?? BLACK_TEXT_FONTS[0].css
}

export function isTextFontId(id: string): id is BlackTextFontId {
  return BLACK_TEXT_FONTS.some((f) => f.id === id)
}

export function renderTextMask(text: string, fontCss: string): boolean[][] | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const fontPx = 160
  ctx.font = `700 ${fontPx}px ${fontCss}`
  const width = Math.max(1, Math.ceil(ctx.measureText(t).width))
  const pad = Math.ceil(fontPx * 0.28)
  const w = Math.min(2048, width + pad * 2)
  const h = Math.min(1024, Math.ceil(fontPx * 1.35) + pad * 2)
  canvas.width = w
  canvas.height = h
  ctx.font = `700 ${fontPx}px ${fontCss}`
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#000000'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(t, pad, pad + fontPx)
  return thresholdMask(ctx.getImageData(0, 0, w, h).data, w, h)
}

export function maskToPlacedShapes(
  mask: boolean[][],
  originX: number,
  originY: number,
  heightMm: number,
): MaskShape[] {
  const shapes = maskToShapes(mask)
  if (!shapes.length) return []
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const shape of shapes) {
    for (const p of shape.outer) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  if (!Number.isFinite(minX)) return []
  const pixelH = Math.max(1e-6, maxY - minY)
  const scale = heightMm / pixelH
  const map = (p: { x: number; y: number }) => ({
    x: originX + (p.x - minX) * scale,
    y: originY + (p.y - minY) * scale,
  })
  const eps = Math.max(0.08, heightMm * 0.02)
  return shapes.map((shape) => ({
    outer: rdp(shape.outer.map(map), eps),
    holes: shape.holes.map((h) => rdp(h.map(map), eps)),
  }))
}

export function textToShapes(
  text: string,
  fontId: string,
  originX: number,
  originY: number,
  heightMm: number,
): MaskShape[] {
  const mask = renderTextMask(text, textFontCss(fontId))
  if (!mask) return []
  return maskToPlacedShapes(mask, originX, originY, heightMm)
}
