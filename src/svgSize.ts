export type SvgSize = { width: number; height: number }

export function parseSvgSize(svgText: string): SvgSize | null {
  const vb = svgText.match(
    /viewBox\s*=\s*["']\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s*["']/,
  )
  if (vb) {
    const width = Math.abs(Number(vb[3]))
    const height = Math.abs(Number(vb[4]))
    if (width > 0 && height > 0) return { width, height }
  }
  const w = svgText.match(/<svg\b[^>]*\bwidth\s*=\s*["']([\d.]+)/)
  const h = svgText.match(/<svg\b[^>]*\bheight\s*=\s*["']([\d.]+)/)
  if (w && h) {
    const width = Number(w[1])
    const height = Number(h[1])
    if (width > 0 && height > 0) return { width, height }
  }
  return null
}

export function svgRasterSize(svgText: string, maxSide = 1024): SvgSize {
  const parsed = parseSvgSize(svgText) ?? { width: 1024, height: 1024 }
  const aspect = parsed.width / parsed.height
  if (aspect >= 1) {
    return { width: maxSide, height: Math.max(1, Math.round(maxSide / aspect)) }
  }
  return { width: Math.max(1, Math.round(maxSide * aspect)), height: maxSide }
}

export function rewriteSvgPixelSize(svgText: string, width: number, height: number): string {
  return svgText.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = String(attrs)
      .replace(/\swidth\s*=\s*["'][^"']*["']/i, '')
      .replace(/\sheight\s*=\s*["'][^"']*["']/i, '')
    return `<svg width="${width}" height="${height}"${cleaned}>`
  })
}
