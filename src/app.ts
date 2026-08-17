import { buildBodies } from './bodies'
import { canEncode, encodeQr } from './encode'
import { clampLogoPercent, thresholdMask } from './logo'
import { PRINT_HELP_ORIGIN, PRINT_HELP_STEPS } from './printHelp'
import { createPreview } from './preview'
import { writeBinaryStl } from './stl'
import type { QrSettings, QrStyle } from './types'
import { clampSettings } from './validate'

export function downloadStl(filename: string, buffer: ArrayBuffer): void {
  const blob = new Blob([buffer], { type: 'model/stl' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function logoMaskFromFile(file: File): Promise<boolean[][] | 'error'> {
  const ok = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg']
  if (file.type && !ok.includes(file.type) && !/\.(svg|png|jpe?g)$/i.test(file.name)) {
    return 'error'
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'error'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 512)
    const scale = Math.min(512 / img.width, 512 / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h)
    const data = ctx.getImageData(0, 0, 512, 512)
    return thresholdMask(data.data, 512, 512)
  } catch {
    return 'error'
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = url
  })
}

export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <h1>3D QR</h1>

    <section>
      <label for="content">Content</label>
      <input id="content" type="text" placeholder="URL or text" autocomplete="off" />
      <p class="note" id="note"></p>
    </section>

    <section>
      <div class="section-label">Style</div>
      <div class="choices">
        <label><input type="radio" name="style" value="square" checked /> square</label>
        <label><input type="radio" name="style" value="rounded" /> rounded</label>
        <label><input type="radio" name="style" value="dots" /> dots</label>
      </div>
    </section>

    <section>
      <div class="section-label">Size</div>
      <div class="row">
        <div>
          <label for="width">Width mm</label>
          <input id="width" type="number" step="1" />
        </div>
        <div>
          <label for="black">Black height mm</label>
          <input id="black" type="number" step="0.1" />
        </div>
        <div>
          <label for="cap">Cap thickness mm</label>
          <input id="cap" type="number" step="0.1" />
        </div>
      </div>
    </section>

    <section>
      <div class="section-label">Logo</div>
      <input id="logo" type="file" accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg" />
      <div style="margin-top:1rem">
        <label for="logoSize">Logo size %</label>
        <input id="logoSize" type="number" min="10" max="30" step="1" />
      </div>
      <p class="error" id="logoError"></p>
    </section>

    <section>
      <div class="section-label">Preview</div>
      <div class="preview-wrap" id="preview"></div>
      <div class="toggles">
        <label><input id="showBlack" type="checkbox" checked /> show black</label>
        <label><input id="showWhite" type="checkbox" checked /> show white</label>
      </div>
    </section>

    <section>
      <div class="section-label">Export</div>
      <div class="export-row">
        <button type="button" id="dlBlack" disabled>qr-black.stl</button>
        <button type="button" id="dlWhite" disabled>qr-white.stl</button>
      </div>
    </section>

    <section>
      <div class="section-label">How to print</div>
      <ol>
        ${PRINT_HELP_STEPS.map((s) => `<li>${s}</li>`).join('')}
      </ol>
      <p class="hint">${PRINT_HELP_ORIGIN}</p>
    </section>
  `

  const content = root.querySelector<HTMLInputElement>('#content')!
  const width = root.querySelector<HTMLInputElement>('#width')!
  const black = root.querySelector<HTMLInputElement>('#black')!
  const cap = root.querySelector<HTMLInputElement>('#cap')!
  const logo = root.querySelector<HTMLInputElement>('#logo')!
  const logoSize = root.querySelector<HTMLInputElement>('#logoSize')!
  const logoError = root.querySelector<HTMLElement>('#logoError')!
  const note = root.querySelector<HTMLElement>('#note')!
  const dlBlack = root.querySelector<HTMLButtonElement>('#dlBlack')!
  const dlWhite = root.querySelector<HTMLButtonElement>('#dlWhite')!
  const showBlack = root.querySelector<HTMLInputElement>('#showBlack')!
  const showWhite = root.querySelector<HTMLInputElement>('#showWhite')!
  const previewEl = root.querySelector<HTMLElement>('#preview')!

  const preview = createPreview(previewEl)
  let logoMask: boolean[][] | undefined
  let last: { settings: QrSettings; black: ArrayBuffer; white: ArrayBuffer } | null = null

  function readForm(): Partial<QrSettings> {
    const styleInput = root.querySelector<HTMLInputElement>('input[name="style"]:checked')
    const style = (styleInput?.value ?? 'square') as QrStyle
    return {
      content: content.value,
      style,
      widthMm: Number(width.value),
      blackHeightMm: Number(black.value),
      capThicknessMm: Number(cap.value),
      logoSizePercent: Number(logoSize.value),
      hasLogo: Boolean(logoMask),
    }
  }

  function writeClampedForm(settings: QrSettings) {
    width.value = String(settings.widthMm)
    black.value = String(settings.blackHeightMm)
    cap.value = String(settings.capThicknessMm)
    logoSize.value = String(settings.logoSizePercent)
  }

  function setExportEnabled(on: boolean) {
    dlBlack.disabled = !on
    dlWhite.disabled = !on
  }

  function rebuild() {
    const settings = clampSettings(readForm())
    writeClampedForm(settings)
    if (!settings.content) {
      note.textContent = 'Type a URL or some text.'
      setExportEnabled(false)
      last = null
      return
    }
    if (!canEncode(settings.content, settings.hasLogo)) {
      note.textContent = `This text is too long for one QR code. (${settings.content.length} characters)`
      setExportEnabled(false)
      last = null
      return
    }
    note.textContent = ''
    const matrix = encodeQr(settings.content, settings.hasLogo)
    settings.logoSizePercent = clampLogoPercent(settings.logoSizePercent, matrix.size)
    logoSize.max = String(clampLogoPercent(30, matrix.size))
    writeClampedForm(settings)
    const bodies = buildBodies(settings, matrix, logoMask)
    preview.setMeshes(bodies.black, bodies.white)
    preview.setVisible('black', showBlack.checked)
    preview.setVisible('white', showWhite.checked)
    last = {
      settings,
      black: writeBinaryStl(bodies.black),
      white: writeBinaryStl(bodies.white),
    }
    setExportEnabled(true)
  }

  const defaults = clampSettings({})
  writeClampedForm(defaults)
  note.textContent = 'Type a URL or some text.'

  content.addEventListener('input', rebuild)
  width.addEventListener('change', rebuild)
  black.addEventListener('change', rebuild)
  cap.addEventListener('change', rebuild)
  logoSize.addEventListener('change', rebuild)
  for (const radio of root.querySelectorAll<HTMLInputElement>('input[name="style"]')) {
    radio.addEventListener('change', rebuild)
  }
  showBlack.addEventListener('change', () => preview.setVisible('black', showBlack.checked))
  showWhite.addEventListener('change', () => preview.setVisible('white', showWhite.checked))

  logo.addEventListener('change', async () => {
    logoError.textContent = ''
    const file = logo.files?.[0]
    if (!file) {
      logoMask = undefined
      rebuild()
      return
    }
    const result = await logoMaskFromFile(file)
    if (result === 'error') {
      logoMask = undefined
      logoError.textContent = 'This logo file could not be read.'
      rebuild()
      return
    }
    logoMask = result
    rebuild()
  })

  dlBlack.addEventListener('click', () => {
    if (last) downloadStl('qr-black.stl', last.black)
  })
  dlWhite.addEventListener('click', () => {
    if (last) downloadStl('qr-white.stl', last.white)
  })
}
