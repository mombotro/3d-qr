import { buildBodies, type ExtraStl } from './bodies'
import type { CustomPlate } from './contour'
import { maskToCustomPlate } from './contour'
import { makeLayout } from './layout'
import { canEncode, encodeQr } from './encode'
import { clampLogoPercent, thresholdMask } from './logo'
import { rewriteSvgPixelSize, svgRasterSize } from './svgSize'
import { PRINT_HELP_CASSETTE, PRINT_HELP_ORIGIN, PRINT_HELP_STEPS } from './printHelp'
import type { CassetteKit } from './cassetteParts'
import { loadCassetteKit } from './cassetteParts'
import { createPreview } from './preview'
import type { Triangle } from './extrude'
import { writeBinaryStl } from './stl'
import { BLACK_TEXT_FONTS } from './text'
import type { PlateShape, QrSettings, QrStyle } from './types'
import { CARD_ASPECT, CARD_DEFAULT_WIDTH_MM } from './card'
import { CASSETTE_ASPECT, CASSETTE_DEFAULT_WIDTH_MM } from './cassette'
import { LIMITS } from './types'
import {
  clampSettings,
  customPlateHeightMm,
  usesAspectHeight,
  usesCassetteBody,
  usesCustomSize,
  usesFixedSize,
  usesDogtagHole,
  usesInsetFrame,
  usesQrOffsetX,
  usesQrOffsetY,
  usesShapeUpload,
} from './validate'

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

async function customPlateFromFile(file: File): Promise<CustomPlate | 'error'> {
  if (file.type && file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) {
    return 'error'
  }
  try {
    const text = await file.text()
    const size = svgRasterSize(text, 1024)
    const sized = rewriteSvgPixelSize(text, size.width, size.height)
    const sizedUrl = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }))
    try {
      const img = await loadImage(sizedUrl)
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return 'error'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size.width, size.height)
      ctx.drawImage(img, 0, 0, size.width, size.height)
      const data = ctx.getImageData(0, 0, size.width, size.height)
      const mask = thresholdMask(data.data, size.width, size.height)
      return maskToCustomPlate(mask) ?? 'error'
    } finally {
      URL.revokeObjectURL(sizedUrl)
    }
  } catch {
    return 'error'
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
  const chickenSrc = `${import.meta.env.BASE_URL}chicken.jpg`
  root.innerHTML = `
    <div class="app-shell">
    <div class="settings">
    <a class="home" href="https://boccbo.cc">
      <img src="${chickenSrc}" alt="" width="16" height="16" />
      mombotro
    </a>
    <h1>3D QR <span class="beta">beta</span></h1>
    <p class="beta-note">Beta. Features and print settings are still changing. Test a small tag before a long print.</p>

    <section>
      <label for="content">Content</label>
      <input id="content" type="text" placeholder="URL or text" autocomplete="off" />
      <p class="note" id="note"></p>
    </section>

    <section>
      <div class="section-label">Tag</div>
      <div class="choices">
        <label><input type="radio" name="plate" value="square" checked /> square</label>
        <label><input type="radio" name="plate" value="circle" /> circle</label>
        <label><input type="radio" name="plate" value="rounded" /> rounded square</label>
        <label><input type="radio" name="plate" value="hexagon" /> hexagon</label>
        <label><input type="radio" name="plate" value="rect" /> rectangle</label>
        <label><input type="radio" name="plate" value="dogtag" /> dog tag</label>
        <label><input type="radio" name="plate" value="cassette" /> cassette</label>
        <label><input type="radio" name="plate" value="card" /> credit card</label>
        <label><input type="radio" name="plate" value="custom" /> custom svg</label>
      </div>
      <div style="margin-top:1rem">
        <label for="shapeFile">Tag SVG</label>
        <input id="shapeFile" type="file" accept=".svg,image/svg+xml" />
        <details class="fold">
          <summary>How to make an SVG</summary>
          <p class="hint">
            Draw a filled black silhouette on a white or empty background. Holes are empty
            regions inside the fill. Do not use stroke-only lines. Keep one main shape.
          </p>
        </details>
        <p class="error" id="shapeError"></p>
      </div>
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
          <label for="height">Height mm</label>
          <input id="height" type="number" step="1" />
        </div>
        <div>
          <label for="black">Black height mm</label>
          <input id="black" type="number" step="0.1" />
        </div>
        <div>
          <label for="cap" id="capLabel">Cap thickness mm</label>
          <input id="cap" type="number" step="0.1" />
        </div>
      </div>
      <div class="row" style="margin-top:1rem">
        <div>
          <label for="qrX">QR X mm</label>
          <input id="qrX" type="number" step="1" />
        </div>
        <div>
          <label for="qrY">QR Y mm</label>
          <input id="qrY" type="number" step="1" />
        </div>
        <div>
          <label for="qrSize">QR size %</label>
          <input id="qrSize" type="number" step="5" min="40" max="200" />
        </div>
      </div>
      <div class="toggles">
        <label><input id="hole" type="checkbox" /> hole</label>
        <label><input id="insetFrame" type="checkbox" /> inset frame</label>
        <label><input id="hollow" type="checkbox" /> hollow</label>
        <label><input id="lid" type="checkbox" /> lid</label>
      </div>
      <div class="row" style="margin-top:1rem">
        <div>
          <label for="holeSize">Hole size mm</label>
          <input id="holeSize" type="number" step="0.5" />
        </div>
      </div>
      <div id="cassetteOpts" class="cassette-opts" hidden>
        <div class="section-label" style="margin-top:1.25rem">Cassette</div>
        <div class="choices">
          <label><input type="radio" name="cassTop" value="lid" checked /> lid plate</label>
          <label><input type="radio" name="cassTop" value="flat" /> flat plate</label>
        </div>
        <div class="toggles">
          <label><input id="cassSlider" type="checkbox" checked /> slider slots</label>
          <label><input id="cassFlip" type="checkbox" /> flip slider side</label>
          <label><input id="cassAccess" type="checkbox" checked /> window piece</label>
        </div>
        <p class="hint">
          QR prints on the top face, face down. The slider covers the extra hole so a scan
          can still read.
        </p>
      </div>
    </section>

    <section>
      <div class="section-label">Text</div>
      <label for="blackText">Black layer text</label>
      <input id="blackText" type="text" maxlength="80" placeholder="optional" autocomplete="off" />
      <div class="row" style="margin-top:1rem">
        <div>
          <label for="textFont">Font</label>
          <select id="textFont">
            ${BLACK_TEXT_FONTS.map((f) => `<option value="${f.id}">${f.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="textSize">Size mm</label>
          <input id="textSize" type="number" step="0.5" min="2" max="40" />
        </div>
      </div>
      <div class="row" style="margin-top:1rem">
        <div>
          <label for="textX">Text X mm</label>
          <input id="textX" type="number" step="1" />
        </div>
        <div>
          <label for="textY">Text Y mm</label>
          <input id="textY" type="number" step="1" />
        </div>
      </div>
      <p class="hint">From the plate origin. Y increases up in the preview.</p>
    </section>

    <section>
      <div class="section-label">Image</div>
      <label for="stamp">Black layer image</label>
      <input id="stamp" type="file" accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg" />
      <div class="row" style="margin-top:1rem">
        <div>
          <label for="stampSize">Size mm</label>
          <input id="stampSize" type="number" step="0.5" min="2" max="60" />
        </div>
      </div>
      <div class="row" style="margin-top:1rem">
        <div>
          <label for="stampX">Image X mm</label>
          <input id="stampX" type="number" step="1" />
        </div>
        <div>
          <label for="stampY">Image Y mm</label>
          <input id="stampY" type="number" step="1" />
        </div>
      </div>
      <p class="hint">Same origin as text. Y increases up. Dark pixels become black plastic.</p>
      <p class="error" id="stampError"></p>
    </section>

    <section>
      <div class="section-label">Logo</div>
      <input id="logo" type="file" accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg" />
      <div class="toggles">
        <label><input id="blankLogo" type="checkbox" /> blank</label>
      </div>
      <div style="margin-top:1rem">
        <label for="logoSize">Logo size %</label>
        <input id="logoSize" type="number" min="10" max="50" step="1" />
      </div>
      <p class="error" id="logoError"></p>
    </section>

    <section>
      <div class="section-label">Export</div>
      <div class="export-row">
        <button type="button" id="dlBlack" disabled>qr-black.stl</button>
        <button type="button" id="dlWhite" disabled>qr-white.stl</button>
        <button type="button" id="dlLid" disabled>qr-lid.stl</button>
        <button type="button" id="dlBottom" disabled>cassette-bottom.stl</button>
        <button type="button" id="dlSlider" disabled>cassette-slider.stl</button>
        <button type="button" id="dlWindow" disabled>cassette-window.stl</button>
      </div>
    </section>

    <section>
      <details class="fold">
        <summary>How to print</summary>
        <ol id="printSteps">
          ${PRINT_HELP_STEPS.map((s) => `<li>${s}</li>`).join('')}
        </ol>
        <p class="hint">${PRINT_HELP_ORIGIN}</p>
      </details>
    </section>
    </div>
    <aside class="preview-pane">
      <div class="section-label">Preview</div>
      <div class="preview-wrap" id="preview"></div>
      <div class="toggles">
        <label><input id="showBlack" type="checkbox" checked /> show black</label>
        <label><input id="showWhite" type="checkbox" checked /> show white</label>
        <label><input id="showLid" type="checkbox" checked /> show lid</label>
      </div>
    </aside>
    </div>
  `

  const content = root.querySelector<HTMLInputElement>('#content')!
  const width = root.querySelector<HTMLInputElement>('#width')!
  const height = root.querySelector<HTMLInputElement>('#height')!
  const qrX = root.querySelector<HTMLInputElement>('#qrX')!
  const qrY = root.querySelector<HTMLInputElement>('#qrY')!
  const qrSize = root.querySelector<HTMLInputElement>('#qrSize')!
  const hole = root.querySelector<HTMLInputElement>('#hole')!
  const holeSize = root.querySelector<HTMLInputElement>('#holeSize')!
  const insetFrame = root.querySelector<HTMLInputElement>('#insetFrame')!
  const hollow = root.querySelector<HTMLInputElement>('#hollow')!
  const lidOn = root.querySelector<HTMLInputElement>('#lid')!
  const cassetteOpts = root.querySelector<HTMLElement>('#cassetteOpts')!
  const cassSlider = root.querySelector<HTMLInputElement>('#cassSlider')!
  const cassFlip = root.querySelector<HTMLInputElement>('#cassFlip')!
  const cassAccess = root.querySelector<HTMLInputElement>('#cassAccess')!
  const printSteps = root.querySelector<HTMLOListElement>('#printSteps')!
  const black = root.querySelector<HTMLInputElement>('#black')!
  const cap = root.querySelector<HTMLInputElement>('#cap')!
  const capLabel = root.querySelector<HTMLElement>('#capLabel')!
  const shapeFile = root.querySelector<HTMLInputElement>('#shapeFile')!
  const shapeError = root.querySelector<HTMLElement>('#shapeError')!
  const blackText = root.querySelector<HTMLInputElement>('#blackText')!
  const textFont = root.querySelector<HTMLSelectElement>('#textFont')!
  const textSize = root.querySelector<HTMLInputElement>('#textSize')!
  const textX = root.querySelector<HTMLInputElement>('#textX')!
  const textY = root.querySelector<HTMLInputElement>('#textY')!
  const stamp = root.querySelector<HTMLInputElement>('#stamp')!
  const stampSize = root.querySelector<HTMLInputElement>('#stampSize')!
  const stampX = root.querySelector<HTMLInputElement>('#stampX')!
  const stampY = root.querySelector<HTMLInputElement>('#stampY')!
  const stampError = root.querySelector<HTMLElement>('#stampError')!
  const logo = root.querySelector<HTMLInputElement>('#logo')!
  const logoSize = root.querySelector<HTMLInputElement>('#logoSize')!
  const blankLogo = root.querySelector<HTMLInputElement>('#blankLogo')!
  const logoError = root.querySelector<HTMLElement>('#logoError')!
  const note = root.querySelector<HTMLElement>('#note')!
  const dlBlack = root.querySelector<HTMLButtonElement>('#dlBlack')!
  const dlWhite = root.querySelector<HTMLButtonElement>('#dlWhite')!
  const dlLid = root.querySelector<HTMLButtonElement>('#dlLid')!
  const dlBottom = root.querySelector<HTMLButtonElement>('#dlBottom')!
  const dlSlider = root.querySelector<HTMLButtonElement>('#dlSlider')!
  const dlWindow = root.querySelector<HTMLButtonElement>('#dlWindow')!
  const showBlack = root.querySelector<HTMLInputElement>('#showBlack')!
  const showWhite = root.querySelector<HTMLInputElement>('#showWhite')!
  const showLid = root.querySelector<HTMLInputElement>('#showLid')!
  const previewEl = root.querySelector<HTMLElement>('#preview')!

  const preview = createPreview(previewEl)
  let logoMask: boolean[][] | undefined
  let imageMask: boolean[][] | undefined
  let customPlate: CustomPlate | null = null
  let last: {
    settings: QrSettings
    black: Triangle[]
    white: Triangle[]
    lid: Triangle[]
    extras: ExtraStl[]
  } | null = null
  let cassetteKit: CassetteKit | null = null
  let cassetteLoad = 0

  function readForm(): Partial<QrSettings> {
    const styleInput = root.querySelector<HTMLInputElement>('input[name="style"]:checked')
    const style = (styleInput?.value ?? 'square') as QrStyle
    const plateInput = root.querySelector<HTMLInputElement>('input[name="plate"]:checked')
    const plateShape = (plateInput?.value ?? 'square') as PlateShape
    return {
      content: content.value,
      style,
      plateShape,
      widthMm: Number(width.value),
      heightMm: Number(height.value),
      qrOffsetXMm: Number(qrX.value),
      qrOffsetYMm: -Number(qrY.value),
      qrSizePercent: Number(qrSize.value),
      blackHeightMm: Number(black.value),
      capThicknessMm: Number(cap.value),
      logoSizePercent: Number(logoSize.value),
      hasLogo: Boolean(logoMask) || blankLogo.checked,
      dogtagHole: hole.checked,
      holeDiameterMm: Number(holeSize.value),
      insetFrame: insetFrame.checked,
      blankLogo: blankLogo.checked,
      hollow: hollow.checked,
      lid: lidOn.checked,
      cassetteLid:
        (root.querySelector<HTMLInputElement>('input[name="cassTop"]:checked')?.value ?? 'lid') ===
        'lid',
      cassetteSlider: cassSlider.checked,
      cassetteFlipSlider: cassFlip.checked,
      cassetteAccess: cassAccess.checked,
      blackText: blackText.value,
      blackTextFont: textFont.value,
      blackTextSizeMm: Number(textSize.value),
      blackTextXMm: Number(textX.value),
      blackTextYMm: -Number(textY.value),
      blackImageSizeMm: Number(stampSize.value),
      blackImageXMm: Number(stampX.value),
      blackImageYMm: -Number(stampY.value),
    }
  }

  function writeClampedForm(settings: QrSettings) {
    width.value = String(settings.widthMm)
    height.value = String(settings.heightMm)
    const fixed = usesFixedSize(settings.plateShape)
    width.disabled = fixed
    height.disabled = !usesCustomSize(settings.plateShape)
    if (usesAspectHeight(settings.plateShape)) {
      height.value = String(Math.round(settings.widthMm * settings.customAspect * 10) / 10)
    }
    qrX.disabled = !usesQrOffsetX(settings.plateShape)
    qrY.disabled = !usesQrOffsetY(settings.plateShape)
    qrX.value = String(settings.qrOffsetXMm)
    qrY.value = String(settings.qrOffsetYMm === 0 ? 0 : -settings.qrOffsetYMm)
    qrSize.value = String(settings.qrSizePercent)
    hole.disabled = !usesDogtagHole(settings.plateShape)
    hole.checked = settings.dogtagHole
    holeSize.value = String(settings.holeDiameterMm)
    holeSize.disabled = !settings.dogtagHole
    insetFrame.disabled = !usesInsetFrame(settings.plateShape)
    insetFrame.checked = settings.insetFrame
    const cassette = usesCassetteBody(settings.plateShape)
    hollow.checked = settings.hollow
    hollow.disabled = cassette
    lidOn.checked = settings.lid
    lidOn.disabled = cassette || !settings.hollow
    cassetteOpts.hidden = !cassette
    cassSlider.checked = settings.cassetteSlider
    cassFlip.checked = settings.cassetteFlipSlider
    cassFlip.disabled = !settings.cassetteSlider
    cassAccess.checked = settings.cassetteAccess
    const topVal = settings.cassetteLid ? 'lid' : 'flat'
    for (const radio of root.querySelectorAll<HTMLInputElement>('input[name="cassTop"]')) {
      radio.checked = radio.value === topVal
    }
    const help = cassette ? PRINT_HELP_CASSETTE : PRINT_HELP_STEPS
    printSteps.innerHTML = help.map((s) => `<li>${s}</li>`).join('')
    shapeFile.disabled = !usesShapeUpload(settings.plateShape)
    black.value = String(settings.blackHeightMm)
    capLabel.textContent = cassette
      ? 'Cassette mm'
      : settings.hollow
        ? 'Wall height mm'
        : 'Cap thickness mm'
    cap.disabled = cassette
    cap.step = cassette ? '0.5' : '0.1'
    cap.min = cassette ? '1' : '0.4'
    cap.max = cassette ? '8' : '3'
    cap.value = String(settings.capThicknessMm)
    blankLogo.checked = settings.blankLogo
    logoSize.value = String(settings.logoSizePercent)
    textFont.value = settings.blackTextFont
    textSize.value = String(settings.blackTextSizeMm)
    textX.value = String(settings.blackTextXMm)
    textY.value = String(settings.blackTextYMm === 0 ? 0 : -settings.blackTextYMm)
    stampSize.value = String(settings.blackImageSizeMm)
    stampX.value = String(settings.blackImageXMm)
    stampY.value = String(settings.blackImageYMm === 0 ? 0 : -settings.blackImageYMm)
  }

  function setExportEnabled(on: boolean, extras: ExtraStl[] = [], hasLid = false) {
    dlBlack.disabled = !on
    dlWhite.disabled = !on
    dlLid.disabled = !on || !hasLid
    const names = new Set(extras.map((e) => e.filename))
    dlBottom.disabled = !on || !names.has('cassette-bottom.stl')
    dlSlider.disabled = !on || !names.has('cassette-slider.stl')
    dlWindow.disabled = !on || !names.has('cassette-window.stl')
  }

  async function loadKit(settings: QrSettings): Promise<CassetteKit | null> {
    if (settings.plateShape !== 'cassette') {
      cassetteKit = null
      return null
    }
    const id = ++cassetteLoad
    try {
      const kit = await loadCassetteKit({
        lid: settings.cassetteLid,
        slider: settings.cassetteSlider,
        flipSlider: settings.cassetteFlipSlider,
        access: settings.cassetteAccess,
      })
      if (id !== cassetteLoad) return cassetteKit
      cassetteKit = kit
      return kit
    } catch {
      if (id === cassetteLoad) {
        cassetteKit = null
        note.textContent = 'Cassette parts could not be loaded.'
      }
      return null
    }
  }

  async function rebuild() {
    const settings = clampSettings(readForm())
    if (settings.plateShape === 'cassette') settings.customAspect = CASSETTE_ASPECT
    else if (settings.plateShape === 'card') settings.customAspect = CARD_ASPECT
    else if (customPlate) settings.customAspect = customPlate.aspect
    if (usesAspectHeight(settings.plateShape)) {
      settings.heightMm = customPlateHeightMm(settings.widthMm, settings.customAspect)
    }
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
    if (settings.plateShape === 'custom' && !customPlate) {
      note.textContent = 'Upload an SVG for the custom tag.'
      setExportEnabled(false)
      last = null
      return
    }
    note.textContent = ''
    const kit = await loadKit(settings)
    const matrix = encodeQr(settings.content, settings.hasLogo)
    settings.logoSizePercent = clampLogoPercent(settings.logoSizePercent, matrix.size)
    logoSize.max = String(clampLogoPercent(50, matrix.size))
    const layout = makeLayout(
      settings.widthMm,
      matrix.size,
      settings.plateShape,
      settings.heightMm,
      settings.qrOffsetXMm,
      settings.qrOffsetYMm,
      settings.dogtagHole,
      settings.holeDiameterMm,
      settings.qrSizePercent,
    )
    settings.qrOffsetXMm = layout.qrOffsetXMm
    settings.qrOffsetYMm = layout.qrOffsetYMm
    settings.qrSizePercent = Math.round(layout.qrSizePercent)
    writeClampedForm(settings)
    const bodies = buildBodies(settings, matrix, logoMask, customPlate, kit, imageMask)
    preview.setMeshes(bodies.black, bodies.white, bodies.lid)
    preview.setVisible('black', showBlack.checked)
    preview.setVisible('white', showWhite.checked)
    preview.setVisible('lid', showLid.checked)
    last = {
      settings,
      black: bodies.black,
      white: bodies.white,
      lid: bodies.lid,
      extras: bodies.extras,
    }
    setExportEnabled(true, bodies.extras, bodies.lid.length > 0)
  }

  const defaults = clampSettings({})
  writeClampedForm(defaults)
  note.textContent = 'Type a URL or some text.'

  content.addEventListener('input', rebuild)
  width.addEventListener('change', rebuild)
  height.addEventListener('change', rebuild)
  qrX.addEventListener('change', rebuild)
  qrY.addEventListener('change', rebuild)
  qrSize.addEventListener('change', rebuild)
  hole.addEventListener('change', rebuild)
  holeSize.addEventListener('change', rebuild)
  insetFrame.addEventListener('change', rebuild)
  hollow.addEventListener('change', () => void rebuild())
  lidOn.addEventListener('change', () => void rebuild())
  cassSlider.addEventListener('change', () => void rebuild())
  cassFlip.addEventListener('change', () => void rebuild())
  cassAccess.addEventListener('change', () => void rebuild())
  for (const radio of root.querySelectorAll<HTMLInputElement>('input[name="cassTop"]')) {
    radio.addEventListener('change', () => void rebuild())
  }
  black.addEventListener('change', rebuild)
  cap.addEventListener('change', rebuild)
  logoSize.addEventListener('change', rebuild)
  blankLogo.addEventListener('change', rebuild)
  blackText.addEventListener('input', rebuild)
  textFont.addEventListener('change', rebuild)
  textSize.addEventListener('change', rebuild)
  textX.addEventListener('change', rebuild)
  textY.addEventListener('change', rebuild)
  stampSize.addEventListener('change', rebuild)
  stampX.addEventListener('change', rebuild)
  stampY.addEventListener('change', rebuild)
  stamp.addEventListener('change', async () => {
    stampError.textContent = ''
    const file = stamp.files?.[0]
    if (!file) {
      imageMask = undefined
      rebuild()
      return
    }
    const result = await logoMaskFromFile(file)
    if (result === 'error') {
      imageMask = undefined
      stampError.textContent = 'This image could not be read.'
      rebuild()
      return
    }
    imageMask = result
    rebuild()
  })
  for (const radio of root.querySelectorAll<HTMLInputElement>('input[name="style"]')) {
    radio.addEventListener('change', rebuild)
  }
  for (const radio of root.querySelectorAll<HTMLInputElement>('input[name="plate"]')) {
    radio.addEventListener('change', () => {
      if (radio.value === 'cassette') {
        width.value = String(CASSETTE_DEFAULT_WIDTH_MM)
      }
      if (radio.value === 'card' && Number(width.value) === LIMITS.widthMm.default) {
        width.value = String(CARD_DEFAULT_WIDTH_MM)
      }
      rebuild()
    })
  }

  shapeFile.addEventListener('change', async () => {
    shapeError.textContent = ''
    const file = shapeFile.files?.[0]
    if (!file) {
      customPlate = null
      rebuild()
      return
    }
    const plate = await customPlateFromFile(file)
    if (plate === 'error') {
      customPlate = null
      shapeError.textContent = 'This SVG could not be read as a tag shape.'
      rebuild()
      return
    }
    customPlate = plate
    rebuild()
  })
  showBlack.addEventListener('change', () => preview.setVisible('black', showBlack.checked))
  showWhite.addEventListener('change', () => preview.setVisible('white', showWhite.checked))
  showLid.addEventListener('change', () => preview.setVisible('lid', showLid.checked))

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
    if (last) downloadStl('qr-black.stl', writeBinaryStl(last.black))
  })
  dlWhite.addEventListener('click', () => {
    if (last) downloadStl('qr-white.stl', writeBinaryStl(last.white))
  })
  dlLid.addEventListener('click', () => {
    if (last && last.lid.length) downloadStl('qr-lid.stl', writeBinaryStl(last.lid))
  })
  function extra(name: string): Triangle[] | undefined {
    return last?.extras.find((e) => e.filename === name)?.triangles
  }
  dlBottom.addEventListener('click', () => {
    const tris = extra('cassette-bottom.stl')
    if (tris) downloadStl('cassette-bottom.stl', writeBinaryStl(tris))
  })
  dlSlider.addEventListener('click', () => {
    const tris = extra('cassette-slider.stl')
    if (tris) downloadStl('cassette-slider.stl', writeBinaryStl(tris))
  })
  dlWindow.addEventListener('click', () => {
    const tris = extra('cassette-window.stl')
    if (tris) downloadStl('cassette-window.stl', writeBinaryStl(tris))
  })
}
