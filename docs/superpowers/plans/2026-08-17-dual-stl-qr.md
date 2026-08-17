# Dual-file 3D QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local Vite + TypeScript page that turns URL or text into two aligned STL files for a two-job bed print.

**Architecture:** All work stays in the browser. `uqr` builds a module matrix. The mesh builder turns dark modules, the frame, and the logo into a black body, then subtracts a 0.20 mm grown copy of those outlines from a plate to make the white fill, then stacks a solid cap. `three.js` shows both bodies. Export writes two binary STL files that share origin `(0, 0, 0)`.

**Tech Stack:** Vite, TypeScript, Vitest, jsdom, `uqr`, `three`, `polygon-clipping`, `earcut`, `jsqr`

**Spec:** `docs/superpowers/specs/2026-08-17-dual-stl-qr-design.md`

## Global Constraints

- Payload: URL or plain text only. No Wi-Fi, vCard, or Spotify.
- Styles: `square`, `rounded`, `dots`. Finder squares stay square.
- Plate: square only. No other plate shapes. No pen tool.
- Width: 30–200 mm, default 80 mm.
- Black height: 0.6–4 mm, default 1.2 mm.
- Cap thickness: 0.4–3 mm, default 0.8 mm.
- Logo size: 10–30 percent, default 20 percent. Clamp further so the logo never hits a finder.
- XY gap: 0.20 mm. The tool sets this. The user does not edit it.
- Frame: 2 modules. Quiet zone: 4 modules.
- ECC: High when a logo is present, else Quartile.
- Files: `qr-black.stl`, `qr-white.stl`. Binary STL. Units mm. Origin is the plate min corner `(0, 0, 0)`.
- UI: plain page, light background, dark text, large white space, labeled blocks.
- How to print text is fixed in the spec section 4. Copy it verbatim.
- No server. No account. No stored data.
- Tests: Vitest on the core. No test on page look.

## File map

Create these files. Do not invent extra modules.

| File | Role |
|---|---|
| `package.json` | Scripts and deps |
| `tsconfig.json` | TypeScript |
| `vite.config.ts` | Dev server |
| `vitest.config.ts` | Tests in jsdom |
| `index.html` | Page shell |
| `src/types.ts` | Shared types and limits |
| `src/validate.ts` | Clamp fields, empty/too-long checks |
| `src/encode.ts` | `uqr` wrapper, ECC pick |
| `src/layout.ts` | Module size, frame, quiet zone, finder/reserved cells |
| `src/shapes.ts` | 2D polygons for modules, frame |
| `src/logo.ts` | Threshold mask, center clear, mask to polygons |
| `src/offset.ts` | Grow convex polygons by the gap |
| `src/extrude.ts` | 2D rings to triangles |
| `src/stl.ts` | Binary STL write and parse |
| `src/bodies.ts` | Black and white meshes |
| `src/scan.ts` | Bed-face raster for decode tests and preview aid |
| `src/preview.ts` | `three.js` scene |
| `src/printHelp.ts` | How to print copy |
| `src/app.ts` | Form to rebuild to preview to export |
| `src/main.ts` | Boot |
| `src/style.css` | Plain layout |
| `tests/validate.test.ts` | |
| `tests/encode.test.ts` | |
| `tests/layout.test.ts` | |
| `tests/shapes.test.ts` | |
| `tests/logo.test.ts` | |
| `tests/offset.test.ts` | |
| `tests/extrude.test.ts` | |
| `tests/stl.test.ts` | |
| `tests/bodies.test.ts` | |
| `tests/scan.test.ts` | |

---

### Task 1: Scaffold, types, validate

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/types.ts`, `src/validate.ts`, `src/main.ts`, `src/style.css`
- Test: `tests/validate.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
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

export function defaultSettings(): QrSettings
export function clampNumber(value: number, min: number, max: number): number
export function clampSettings(raw: Partial<QrSettings>): QrSettings
```

- [ ] **Step 1: Write the failing test**

Create `tests/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LIMITS, clampSettings, defaultSettings } from '../src/validate'

describe('clampSettings', () => {
  it('uses defaults when raw is empty', () => {
    const s = clampSettings({})
    expect(s.widthMm).toBe(LIMITS.widthMm.default)
    expect(s.blackHeightMm).toBe(LIMITS.blackHeightMm.default)
    expect(s.capThicknessMm).toBe(LIMITS.capThicknessMm.default)
    expect(s.logoSizePercent).toBe(LIMITS.logoSizePercent.default)
    expect(s.style).toBe('square')
    expect(s.content).toBe('')
    expect(s.hasLogo).toBe(false)
  })

  it('snaps width below min to 30', () => {
    expect(clampSettings({ widthMm: 10 }).widthMm).toBe(30)
  })

  it('snaps width above max to 200', () => {
    expect(clampSettings({ widthMm: 900 }).widthMm).toBe(200)
  })

  it('snaps black height and cap to range', () => {
    expect(clampSettings({ blackHeightMm: 0.1 }).blackHeightMm).toBe(0.6)
    expect(clampSettings({ blackHeightMm: 9 }).blackHeightMm).toBe(4)
    expect(clampSettings({ capThicknessMm: 0.1 }).capThicknessMm).toBe(0.4)
    expect(clampSettings({ capThicknessMm: 9 }).capThicknessMm).toBe(3)
  })

  it('snaps logo percent to 10–30', () => {
    expect(clampSettings({ logoSizePercent: 1 }).logoSizePercent).toBe(10)
    expect(clampSettings({ logoSizePercent: 90 }).logoSizePercent).toBe(30)
  })

  it('keeps in-range values', () => {
    const s = clampSettings({
      content: 'https://example.com',
      style: 'dots',
      widthMm: 100,
      blackHeightMm: 2,
      capThicknessMm: 1,
      logoSizePercent: 25,
      hasLogo: true,
    })
    expect(s).toEqual({
      content: 'https://example.com',
      style: 'dots',
      widthMm: 100,
      blackHeightMm: 2,
      capThicknessMm: 1,
      logoSizePercent: 25,
      hasLogo: true,
    })
  })
})

describe('defaultSettings', () => {
  it('matches spec defaults', () => {
    expect(defaultSettings()).toEqual(clampSettings({}))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/validate.test.ts`

Expected: FAIL. `src/validate.ts` does not exist, or `vitest` is not installed.

- [ ] **Step 3: Write minimal implementation**

`package.json`:

```json
{
  "name": "3d-qr-code",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  }
}
```

Then install:

```bash
npm install uqr three polygon-clipping earcut
npm install -D vite typescript vitest jsdom @types/earcut jsqr
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite'
export default defineConfig({})
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom' },
})
```

`src/types.ts`: put `QrStyle`, `EccLevel`, `QrSettings`, `GAP_MM`, `FRAME_MODULES`, `QUIET_ZONE_MODULES`, `LIMITS` here.

`src/validate.ts`:

```ts
import {
  LIMITS,
  type QrSettings,
  type QrStyle,
} from './types'

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
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>3D QR</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:

```ts
import './style.css'
```

`src/style.css`: empty file is fine for this task.

Re-export types from `src/types.ts` so the test import path stays `../src/validate`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/validate.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src/types.ts src/validate.ts src/main.ts src/style.css tests/validate.test.ts
git commit -m "feat: scaffold app and clamp size settings"
```

---

### Task 2: QR encode

**Files:**
- Create: `src/encode.ts`
- Test: `tests/encode.test.ts`

**Interfaces:**
- Consumes: `QrSettings.hasLogo`
- Produces:

```ts
export type QrMatrix = {
  size: number
  version: number
  ecc: EccLevel
  modules: boolean[][]
}

export function eccForLogo(hasLogo: boolean): EccLevel
export function encodeQr(content: string, hasLogo: boolean): QrMatrix
export function canEncode(content: string, hasLogo: boolean): boolean
```

`modules[row][col] === true` means dark. `border` passed to `uqr` is `0`. The tool adds its own quiet zone later.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { canEncode, eccForLogo, encodeQr } from '../src/encode'

describe('eccForLogo', () => {
  it('is H when a logo is present', () => {
    expect(eccForLogo(true)).toBe('H')
  })
  it('is Q when no logo', () => {
    expect(eccForLogo(false)).toBe('Q')
  })
})

describe('encodeQr', () => {
  it('encodes text and reports matching ECC', () => {
    const q = encodeQr('https://example.com', false)
    expect(q.ecc).toBe('Q')
    expect(q.size).toBeGreaterThanOrEqual(21)
    expect(q.modules.length).toBe(q.size)
    expect(q.modules[0].length).toBe(q.size)
  })

  it('uses High ECC when hasLogo is true', () => {
    expect(encodeQr('https://example.com', true).ecc).toBe('H')
  })

  it('places finder-like dark squares at three corners', () => {
    const { modules, size } = encodeQr('HELLO', false)
    const corners = [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ]
    for (const [r0, c0] of corners) {
      expect(modules[r0][c0]).toBe(true)
      expect(modules[r0 + 6][c0 + 6]).toBe(true)
      expect(modules[r0 + 3][c0 + 3]).toBe(true)
    }
  })
})

describe('canEncode', () => {
  it('is false for empty content', () => {
    expect(canEncode('', false)).toBe(false)
  })
  it('is true for a URL', () => {
    expect(canEncode('https://example.com', false)).toBe(true)
  })
  it('is false for text that does not fit version 40', () => {
    expect(canEncode('A'.repeat(4000), true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/encode.test.ts`

Expected: FAIL with `Cannot find module '../src/encode'`

- [ ] **Step 3: Write minimal implementation**

```ts
import { encode } from 'uqr'
import type { EccLevel } from './types'

export type QrMatrix = {
  size: number
  version: number
  ecc: EccLevel
  modules: boolean[][]
}

export function eccForLogo(hasLogo: boolean): EccLevel {
  return hasLogo ? 'H' : 'Q'
}

export function encodeQr(content: string, hasLogo: boolean): QrMatrix {
  const ecc = eccForLogo(hasLogo)
  const result = encode(content, { ecc, border: 0 })
  return {
    size: result.size,
    version: result.version,
    ecc,
    modules: result.data,
  }
}

export function canEncode(content: string, hasLogo: boolean): boolean {
  if (content.length === 0) return false
  try {
    encodeQr(content, hasLogo)
    return true
  } catch {
    return false
  }
}
```

If `uqr` `encode` option names differ, read its type file and match them. ECC values must stay `'Q'` and `'H'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/encode.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/encode.ts tests/encode.test.ts
git commit -m "feat: encode QR matrix with Q or H error correction"
```

---

### Task 3: Layout and reserved cells

**Files:**
- Create: `src/layout.ts`
- Test: `tests/layout.test.ts`

**Interfaces:**
- Consumes: `FRAME_MODULES`, `QUIET_ZONE_MODULES`, `QrMatrix.size`
- Produces:

```ts
export type Layout = {
  widthMm: number
  moduleMm: number
  frameMm: number
  quietZoneMm: number
  matrixSize: number
  matrixOriginMm: number
}

export function makeLayout(widthMm: number, matrixSize: number): Layout
export function moduleOrigin(layout: Layout, row: number, col: number): { x: number; y: number }
export function isFinderCell(matrixSize: number, row: number, col: number): boolean
export function isReservedCell(matrixSize: number, row: number, col: number): boolean
export function maxLogoPercent(matrixSize: number): number
```

`makeLayout` divides `widthMm` by `matrixSize + 2 * FRAME_MODULES + 2 * QUIET_ZONE_MODULES`. That count is the module pitch. `matrixOriginMm = (FRAME_MODULES + QUIET_ZONE_MODULES) * moduleMm`.

`isFinderCell` is true inside the three 7×7 finder squares.

`isReservedCell` is true for finders, the 1-module separator around each finder, timing row 6 and column 6, format bits, version bits when `matrixSize >= 45`, and alignment patterns. Use the standard QR alignment position table.

`maxLogoPercent` is `min(30, floor((matrixSize - 16) / matrixSize * 100))`. Never below `LIMITS.logoSizePercent.min` if that would break v1. For size 21 this is 23.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { FRAME_MODULES, QUIET_ZONE_MODULES } from '../src/types'
import {
  isFinderCell,
  isReservedCell,
  makeLayout,
  maxLogoPercent,
  moduleOrigin,
} from '../src/layout'

describe('makeLayout', () => {
  it('uses the full width including frame and quiet zone', () => {
    const size = 25
    const layout = makeLayout(80, size)
    const modules = size + 2 * FRAME_MODULES + 2 * QUIET_ZONE_MODULES
    expect(layout.moduleMm).toBeCloseTo(80 / modules)
    expect(layout.frameMm).toBeCloseTo(2 * layout.moduleMm)
    expect(layout.quietZoneMm).toBeCloseTo(4 * layout.moduleMm)
    expect(layout.matrixOriginMm).toBeCloseTo(6 * layout.moduleMm)
    expect(layout.widthMm).toBe(80)
  })
})

describe('moduleOrigin', () => {
  it('places 0,0 at the matrix origin', () => {
    const layout = makeLayout(80, 21)
    const p = moduleOrigin(layout, 0, 0)
    expect(p.x).toBeCloseTo(layout.matrixOriginMm)
    expect(p.y).toBeCloseTo(layout.matrixOriginMm)
  })
})

describe('isFinderCell', () => {
  it('marks three 7x7 corners and not the center', () => {
    expect(isFinderCell(21, 0, 0)).toBe(true)
    expect(isFinderCell(21, 6, 6)).toBe(true)
    expect(isFinderCell(21, 0, 14)).toBe(true)
    expect(isFinderCell(21, 14, 0)).toBe(true)
    expect(isFinderCell(21, 10, 10)).toBe(false)
    expect(isFinderCell(21, 7, 7)).toBe(false)
  })
})

describe('isReservedCell', () => {
  it('keeps timing and finder-separator reserved', () => {
    expect(isReservedCell(21, 6, 10)).toBe(true)
    expect(isReservedCell(21, 10, 6)).toBe(true)
    expect(isReservedCell(21, 7, 0)).toBe(true)
  })
})

describe('maxLogoPercent', () => {
  it('caps version 1 below 30 so finders stay clear', () => {
    expect(maxLogoPercent(21)).toBe(23)
  })
  it('caps larger codes at 30', () => {
    expect(maxLogoPercent(25)).toBe(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/layout.test.ts`

Expected: FAIL with `Cannot find module '../src/layout'`

- [ ] **Step 3: Write minimal implementation**

Implement `src/layout.ts` so every test above passes. Alignment centers for versions 2–40:

```ts
const ALIGNMENT: Record<number, number[]> = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  // ...full table through version 40
}
```

Version number is `(matrixSize - 17) / 4`. A 5×5 alignment pattern is reserved unless it overlaps a finder.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/layout.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/layout.ts tests/layout.test.ts
git commit -m "feat: compute QR plate layout and reserved cells"
```

---

### Task 4: Module and frame polygons

**Files:**
- Create: `src/shapes.ts`
- Test: `tests/shapes.test.ts`

**Interfaces:**
- Consumes: `QrStyle`, `Layout`
- Produces:

```ts
export type Point2 = { x: number; y: number }
export type Polygon = Point2[]

export function squarePoly(x: number, y: number, size: number): Polygon
export function roundedPoly(x: number, y: number, size: number, radiusRatio?: number): Polygon
export function circlePoly(cx: number, cy: number, diameter: number, segments?: number): Polygon
export function modulePoly(style: QrStyle, x: number, y: number, size: number, isFinder: boolean): Polygon
export function frameRing(widthMm: number, frameMm: number): { outer: Polygon; hole: Polygon }
```

Rules:

- `roundedPoly` default `radiusRatio` is `0.3`.
- `circlePoly` default 24 segments. Diameter is `0.9 * size` when used for dots. Center is the cell center.
- `modulePoly` ignores style when `isFinder` is true and returns `squarePoly`.
- Polygons run counter-clockwise. First point is not repeated at the end.
- `frameRing.outer` is `(0,0)` to `(widthMm,widthMm)`. `hole` is inset by `frameMm`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { circlePoly, frameRing, modulePoly, roundedPoly, squarePoly } from '../src/shapes'

describe('squarePoly', () => {
  it('has four corners of the cell', () => {
    expect(squarePoly(1, 2, 3)).toEqual([
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 5 },
      { x: 1, y: 5 },
    ])
  })
})

describe('roundedPoly', () => {
  it('uses more than 4 points and stays inside the cell', () => {
    const p = roundedPoly(0, 0, 10, 0.3)
    expect(p.length).toBeGreaterThan(8)
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(-1e-9)
      expect(q.y).toBeGreaterThanOrEqual(-1e-9)
      expect(q.x).toBeLessThanOrEqual(10 + 1e-9)
      expect(q.y).toBeLessThanOrEqual(10 + 1e-9)
    }
  })
})

describe('circlePoly', () => {
  it('stays on a 9 mm diameter when size is 10', () => {
    const p = circlePoly(5, 5, 9, 24)
    expect(p.length).toBe(24)
    for (const q of p) {
      const d = Math.hypot(q.x - 5, q.y - 5)
      expect(d).toBeCloseTo(4.5, 5)
    }
  })
})

describe('modulePoly', () => {
  it('keeps finders square even for dots', () => {
    expect(modulePoly('dots', 0, 0, 2, true)).toEqual(squarePoly(0, 0, 2))
  })
  it('uses a circle for a data module in dots style', () => {
    const p = modulePoly('dots', 0, 0, 10, false)
    expect(p.length).toBe(24)
  })
})

describe('frameRing', () => {
  it('insets the hole by the frame width', () => {
    const f = frameRing(80, 4)
    expect(f.outer[0]).toEqual({ x: 0, y: 0 })
    expect(f.hole).toEqual([
      { x: 4, y: 4 },
      { x: 76, y: 4 },
      { x: 76, y: 76 },
      { x: 4, y: 76 },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shapes.test.ts`

Expected: FAIL with `Cannot find module '../src/shapes'`

- [ ] **Step 3: Write minimal implementation**

Implement the five functions in `src/shapes.ts`. For `roundedPoly`, build a rounded rectangle with an arc of at least 4 points per corner. For `modulePoly('dots', ...)` call `circlePoly(x + size/2, y + size/2, size * 0.9)`. For `modulePoly('rounded', ...)` call `roundedPoly(x, y, size, 0.3)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shapes.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shapes.ts tests/shapes.test.ts
git commit -m "feat: build 2D polygons for QR styles and frame"
```

---

### Task 5: Logo mask and center clear

**Files:**
- Create: `src/logo.ts`
- Modify: `src/validate.ts` to add `clampLogoPercent(percent, matrixSize)`
- Test: `tests/logo.test.ts`

**Interfaces:**
- Consumes: `isReservedCell`, `maxLogoPercent`, `Layout`
- Produces:

```ts
export function luminance(r: number, g: number, b: number): number
export function thresholdMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): boolean[][]
export function logoClearRect(
  matrixSize: number,
  logoSizePercent: number,
): { r0: number; c0: number; r1: number; c1: number }
export function applyLogoClear(modules: boolean[][], percent: number): boolean[][]
export function clampLogoPercent(percent: number, matrixSize: number): number
export function maskToPolygons(
  mask: boolean[][],
  originX: number,
  originY: number,
  widthMm: number,
  heightMm: number,
): Polygon[]
```

`thresholdMask`: a pixel is dark when `luminance <= 127.5` (50 percent). `luminance = 0.2126*r + 0.7152*g + 0.0722*b`.

`logoClearRect`: side in modules is `max(1, round(matrixSize * percent / 100))`. Center it. `r1`/`c1` are exclusive.

`applyLogoClear`: set `modules[r][c] = false` only when the cell is inside the rect and `!isReservedCell`. Do not mutate the input array.

`maskToPolygons`: each dark pixel becomes a square in mm. Adjacent squares may stay separate. Union is allowed but not required in this task.

File load (SVG/PNG/JPG to canvas) lives in Task 9. This task only handles `ImageData` / raw RGBA.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  applyLogoClear,
  clampLogoPercent,
  logoClearRect,
  luminance,
  maskToPolygons,
  thresholdMask,
} from '../src/logo'
import { encodeQr } from '../src/encode'
import { isFinderCell } from '../src/layout'

describe('thresholdMask', () => {
  it('marks dark pixels true and light pixels false', () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ])
    const mask = thresholdMask(rgba, 2, 1)
    expect(mask[0][0]).toBe(true)
    expect(mask[0][1]).toBe(false)
  })
})

describe('luminance', () => {
  it('is 0 for black and 255 for white', () => {
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(255, 255, 255)).toBe(255)
  })
})

describe('logoClearRect', () => {
  it('centers a 20 percent window on a 25 module code', () => {
    const r = logoClearRect(25, 20)
    expect(r.r1 - r.r0).toBe(5)
    expect(r.c1 - r.c0).toBe(5)
    expect(r.r0).toBe(10)
    expect(r.c0).toBe(10)
  })
})

describe('applyLogoClear', () => {
  it('clears center data cells and leaves finders dark', () => {
    const q = encodeQr('https://example.com', true)
    const cleared = applyLogoClear(q.modules, 20)
    const { r0, c0, r1, c1 } = logoClearRect(q.size, 20)
    let clearedData = 0
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        if (!isFinderCell(q.size, r, c) && q.modules[r][c] && !cleared[r][c]) {
          clearedData += 1
        }
      }
    }
    expect(clearedData).toBeGreaterThan(0)
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        expect(cleared[r][c]).toBe(q.modules[r][c])
      }
    }
  })
})

describe('clampLogoPercent', () => {
  it('stops a version 1 logo at 23 percent', () => {
    expect(clampLogoPercent(30, 21)).toBe(23)
  })
})

describe('maskToPolygons', () => {
  it('emits one square for a single dark pixel', () => {
    const mask = [[true]]
    const polys = maskToPolygons(mask, 10, 20, 5, 5)
    expect(polys).toEqual([
      [
        { x: 10, y: 20 },
        { x: 15, y: 20 },
        { x: 15, y: 25 },
        { x: 10, y: 25 },
      ],
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logo.test.ts`

Expected: FAIL with `Cannot find module '../src/logo'`

- [ ] **Step 3: Write minimal implementation**

Implement `src/logo.ts`. Export `clampLogoPercent` from `src/logo.ts` (not only validate). It returns `clampNumber(percent, 10, maxLogoPercent(matrixSize))`.

`applyLogoClear` deep-copies `modules` first.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logo.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/logo.ts src/validate.ts tests/logo.test.ts
git commit -m "feat: threshold logos and clear reserved-safe center"
```

---

### Task 6: Offset, extrude, binary STL

**Files:**
- Create: `src/offset.ts`, `src/extrude.ts`, `src/stl.ts`
- Test: `tests/offset.test.ts`, `tests/extrude.test.ts`, `tests/stl.test.ts`

**Interfaces:**
- Consumes: `Polygon`, `GAP_MM`
- Produces:

```ts
export type Triangle = {
  n: [number, number, number]
  a: [number, number, number]
  b: [number, number, number]
  c: [number, number, number]
}

export function offsetPolygon(poly: Polygon, delta: number): Polygon
export function pointInPolygon(point: Point2, poly: Polygon): boolean
export function extrudeRing(outer: Polygon, holes: Polygon[], z0: number, z1: number): Triangle[]
export function writeBinaryStl(triangles: Triangle[]): ArrayBuffer
export function readBinaryStl(buffer: ArrayBuffer): { triangleCount: number; triangles: Triangle[] }
```

`offsetPolygon` moves each edge outward by `delta` along its outward normal (CCW input). Works for convex polygons. `delta` may be `0.2`.

`extrudeRing` builds a prism: top, bottom, outer walls, hole walls. Bottom face winding faces −Z. Top face winding faces +Z. Normals are right-handed.

Binary STL: 80-byte header, `Uint32` count, each triangle 12 little-endian floats (normal, a, b, c) plus `Uint16` attribute `0`.

- [ ] **Step 1: Write the failing tests**

`tests/offset.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { offsetPolygon, pointInPolygon } from '../src/offset'
import { squarePoly } from '../src/shapes'

describe('offsetPolygon', () => {
  it('grows a 10 mm square by 0.2 mm on each side', () => {
    const grown = offsetPolygon(squarePoly(10, 10, 10), 0.2)
    expect(pointInPolygon({ x: 9.9, y: 15 }, grown)).toBe(true)
    expect(pointInPolygon({ x: 9.7, y: 15 }, grown)).toBe(false)
    expect(pointInPolygon({ x: 15, y: 15 }, grown)).toBe(true)
  })
})
```

`tests/extrude.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extrudeRing } from '../src/extrude'
import { squarePoly } from '../src/shapes'

describe('extrudeRing', () => {
  it('keeps all vertices between z0 and z1', () => {
    const tris = extrudeRing(squarePoly(0, 0, 10), [], 0, 1.2)
    expect(tris.length).toBeGreaterThan(0)
    for (const t of tris) {
      for (const v of [t.a, t.b, t.c]) {
        expect(v[2]).toBeGreaterThanOrEqual(0)
        expect(v[2]).toBeLessThanOrEqual(1.2)
      }
    }
  })
})
```

`tests/stl.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extrudeRing } from '../src/extrude'
import { squarePoly } from '../src/shapes'
import { readBinaryStl, writeBinaryStl } from '../src/stl'

describe('writeBinaryStl', () => {
  it('writes a valid header and triangle count', () => {
    const tris = extrudeRing(squarePoly(0, 0, 10), [], 0, 1)
    const buf = writeBinaryStl(tris)
    const parsed = readBinaryStl(buf)
    expect(parsed.triangleCount).toBe(tris.length)
    expect(parsed.triangles.length).toBe(tris.length)
    expect(buf.byteLength).toBe(84 + 50 * tris.length)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/offset.test.ts tests/extrude.test.ts tests/stl.test.ts`

Expected: FAIL. Modules do not exist.

- [ ] **Step 3: Write minimal implementation**

`offsetPolygon`: for each vertex i, take previous and next edges, compute outward normals, move the vertex along the unit bisector by `delta / cos(halfAngle)`, or use a clipper offset if the bisector is unstable. Tests only need a square.

`extrudeRing`: flatten `outer` plus holes for `earcut`. Pass hole start indices. Create top (`z1`) and bottom (`z0`) triangles from those faces. Add a quad (two triangles) for each outer edge and each hole edge.

`writeBinaryStl` / `readBinaryStl`: implement the binary spec above. Header bytes can be zero.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/offset.test.ts tests/extrude.test.ts tests/stl.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/offset.ts src/extrude.ts src/stl.ts tests/offset.test.ts tests/extrude.test.ts tests/stl.test.ts
git commit -m "feat: offset polygons, extrude rings, write binary STL"
```

---

### Task 7: Black and white bodies

**Files:**
- Create: `src/bodies.ts`
- Test: `tests/bodies.test.ts`

**Interfaces:**
- Consumes: `encodeQr`, `makeLayout`, `modulePoly`, `frameRing`, `offsetPolygon`, `extrudeRing`, `applyLogoClear`, `maskToPolygons`, `GAP_MM`
- Produces:

```ts
export type Bodies = {
  black: Triangle[]
  white: Triangle[]
}

export function buildBodies(
  settings: QrSettings,
  matrix: QrMatrix,
  logoMask?: boolean[][],
): Bodies
```

Algorithm:

1. `layout = makeLayout(settings.widthMm, matrix.size)`.
2. Start from `matrix.modules`. If `logoMask` is present, `modules = applyLogoClear(modules, settings.logoSizePercent)`.
3. Black polygons:
   - `frameRing(layout.widthMm, layout.frameMm)` as a ring (outer minus hole) at later extrude time. Store frame as `{outer, hole}`.
   - For each dark cell, `modulePoly(settings.style, origin.x, origin.y, layout.moduleMm, isFinderCell(...))`.
   - If `logoMask` is present, add `maskToPolygons` in the center square. Center square mm size is `layout.moduleMm * (r1-r0)`, origin is `moduleOrigin(layout, r0, c0)`.
4. Black mesh = extrude of each black module polygon and the logo polygons from `0` to `settings.blackHeightMm`, plus extrude of the frame ring from `0` to `settings.blackHeightMm`.
5. Grown black for subtract:
   - Each module/logo polygon: `offsetPolygon(poly, GAP_MM)`.
   - Frame for subtract: outer stays the plate square. Hole inset by `frameMm + GAP_MM`.
6. White fill = `polygon-clipping.difference(plate, ...grownSolids)`. Plate is `[ [ [0,0], [W,0], [W,W], [0,W], [0,0] ] ]`. Convert each MultiPolygon result to `{outer, holes}` (drop the repeated last point if the library adds it).
7. White mesh = `extrudeRing(fillOuter, fillHoles, 0, blackHeightMm)` for each fill piece, plus `extrudeRing(plateSquare, [], blackHeightMm, blackHeightMm + capThicknessMm)`.

`polygon-clipping` uses `[x,y]` rings. Convert at the boundary of `src/bodies.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { encodeQr } from '../src/encode'
import { makeLayout, moduleOrigin } from '../src/layout'
import { buildBodies } from '../src/bodies'
import { pointInPolygon } from '../src/offset'
import { clampSettings } from '../src/validate'
import { GAP_MM } from '../src/types'

function zRange(tris: { a: number[]; b: number[]; c: number[] }[]) {
  let min = Infinity
  let max = -Infinity
  for (const t of tris) {
    for (const v of [t.a, t.b, t.c]) {
      min = Math.min(min, v[2])
      max = Math.max(max, v[2])
    }
  }
  return { min, max }
}

function xyOf(tris: { a: number[]; b: number[]; c: number[] }[]) {
  let minX = Infinity
  let minY = Infinity
  for (const t of tris) {
    for (const v of [t.a, t.b, t.c]) {
      minX = Math.min(minX, v[0])
      minY = Math.min(minY, v[1])
    }
  }
  return { minX, minY }
}

describe('buildBodies', () => {
  const settings = clampSettings({
    content: 'https://example.com',
    widthMm: 80,
    blackHeightMm: 1.2,
    capThicknessMm: 0.8,
  })
  const matrix = encodeQr(settings.content, false)

  it('puts black on z 0..blackHeight and white up to cap', () => {
    const { black, white } = buildBodies(settings, matrix)
    const bz = zRange(black)
    const wz = zRange(white)
    expect(bz.min).toBeCloseTo(0)
    expect(bz.max).toBeCloseTo(1.2)
    expect(wz.min).toBeCloseTo(0)
    expect(wz.max).toBeCloseTo(2.0)
    expect(black.length).toBeGreaterThan(0)
    expect(white.length).toBeGreaterThan(0)
  })

  it('shares origin at the plate min corner', () => {
    const { black, white } = buildBodies(settings, matrix)
    const b = xyOf(black)
    const w = xyOf(white)
    expect(b.minX).toBeCloseTo(0)
    expect(b.minY).toBeCloseTo(0)
    expect(w.minX).toBeCloseTo(0)
    expect(w.minY).toBeCloseTo(0)
  })

  it('leaves a 0.20 mm gap around a square data module', () => {
    const square = clampSettings({ ...settings, style: 'square' })
    const { black, white } = buildBodies(square, matrix)
    // sample a known dark non-finder cell
    let sample: { x: number; y: number } | null = null
    const layout = makeLayout(80, matrix.size)
    outer: for (let r = 8; r < matrix.size - 8; r++) {
      for (let c = 8; c < matrix.size - 8; c++) {
        if (matrix.modules[r][c]) {
          const o = moduleOrigin(layout, r, c)
          sample = {
            x: o.x + layout.moduleMm / 2,
            y: o.y + layout.moduleMm / 2,
          }
          break outer
        }
      }
    }
    expect(sample).not.toBeNull()
    const mid = sample!
    const justOutside = {
      x: mid.x + layout.moduleMm / 2 + GAP_MM / 2,
      y: mid.y,
    }
    const pastGap = {
      x: mid.x + layout.moduleMm / 2 + GAP_MM + 0.15,
      y: mid.y,
    }

    const whiteFillXy = white.filter((t) => t.a[2] < 1.2 - 1e-6)
    function anyTriContains(tris: typeof white, p: { x: number; y: number }) {
      return tris.some((t) => {
        const poly = [
          { x: t.a[0], y: t.a[1] },
          { x: t.b[0], y: t.b[1] },
          { x: t.c[0], y: t.c[1] },
        ]
        return pointInPolygon(p, poly)
      })
    }

    expect(anyTriContains(black, mid)).toBe(true)
    expect(anyTriContains(whiteFillXy, mid)).toBe(false)
    expect(anyTriContains(whiteFillXy, justOutside)).toBe(false)
    expect(anyTriContains(whiteFillXy, pastGap)).toBe(true)
  })

  it('keeps the cap solid: a center point exists at z above black height', () => {
    const { white } = buildBodies(settings, matrix)
    const cap = white.filter((t) => t.a[2] >= 1.2 - 1e-6 && t.b[2] >= 1.2 - 1e-6 && t.c[2] >= 1.2 - 1e-6)
    expect(cap.length).toBeGreaterThan(0)
    const center = { x: 40, y: 40 }
    const hits = cap.some((t) =>
      pointInPolygon(center, [
        { x: t.a[0], y: t.a[1] },
        { x: t.b[0], y: t.b[1] },
        { x: t.c[0], y: t.c[1] },
      ]),
    )
    expect(hits).toBe(true)
  })
})
```

If the gap sample cell sits next to another dark cell, `pastGap` may still be inside black. Pick a dark cell whose right neighbor is light:

```ts
if (matrix.modules[r][c] && !matrix.modules[r][c + 1]) { ... }
```

Use that condition in the test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bodies.test.ts`

Expected: FAIL with `Cannot find module '../src/bodies'`

- [ ] **Step 3: Write minimal implementation**

Implement `src/bodies.ts` with the algorithm above. Use `polygon-clipping.difference`. Close rings when you pass them to the library (repeat first point). Strip the repeated point when you convert back.

Helper inside the file:

```ts
function toRing(poly: Polygon): number[][] {
  const ring = poly.map((p) => [p.x, p.y])
  ring.push([poly[0].x, poly[0].y])
  return ring
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bodies.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bodies.ts tests/bodies.test.ts
git commit -m "feat: build black QR body and white fill-plus-cap"
```

---

### Task 8: Bed-face scan test

**Files:**
- Create: `src/scan.ts`
- Test: `tests/scan.test.ts`

**Interfaces:**
- Consumes: `QrMatrix`, `Layout`, `QrStyle`, `modulePoly`, `applyLogoClear`, `thresholdMask` / logo mask
- Produces:

```ts
export function renderBedFace(args: {
  matrix: QrMatrix
  layout: Layout
  style: QrStyle
  logoMask?: boolean[][]
  logoPercent?: number
  pixels: number
}): ImageData

export function decodeBedFace(image: ImageData): string | null
```

`renderBedFace` paints the plate as the camera sees the bed: dark modules, frame, and dark logo pixels are black (`0,0,0`). Everything else is white (`255,255,255`). No gap in this image. This is the scannable face, not the STL clearance.

`decodeBedFace` uses `jsqr`. Return the decoded string, or `null`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { encodeQr } from '../src/encode'
import { makeLayout } from '../src/layout'
import { applyLogoClear } from '../src/logo'
import { decodeBedFace, renderBedFace } from '../src/scan'
import type { QrStyle } from '../src/types'

const content = 'https://example.com'
const styles: QrStyle[] = ['square', 'rounded', 'dots']

describe('renderBedFace decode', () => {
  for (const style of styles) {
    it(`decodes ${style} without a logo`, () => {
      const matrix = encodeQr(content, false)
      const layout = makeLayout(80, matrix.size)
      const image = renderBedFace({ matrix, layout, style, pixels: 400 })
      expect(decodeBedFace(image)).toBe(content)
    })

    it(`decodes ${style} with a logo`, () => {
      const matrix = encodeQr(content, true)
      const cleared = { ...matrix, modules: applyLogoClear(matrix.modules, 20) }
      const layout = makeLayout(80, cleared.size)
      const mask = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => true))
      const image = renderBedFace({
        matrix: cleared,
        layout,
        style,
        logoMask: mask,
        logoPercent: 20,
        pixels: 400,
      })
      expect(decodeBedFace(image)).toBe(content)
    })
  }
})
```

A full-dark 16×16 logo may be too strong for decode. If this fails after a correct renderer, use a smaller logo: a 16×16 mask with only a 6×6 dark block in the center. Keep High ECC. The spec requires a logo case that still decodes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scan.test.ts`

Expected: FAIL with `Cannot find module '../src/scan'`

- [ ] **Step 3: Write minimal implementation**

`renderBedFace`: create `ImageData(pixels, pixels)`. Fill white. Draw the frame as a black border `frameMm/widthMm * pixels` thick. For each dark module, fill its `modulePoly` in black using a simple canvas 2D path, or a scanline fill. Draw logo dark pixels in the center square.

In jsdom, `document.createElement('canvas')` works if you fill `ImageData` yourself. Prefer writing pixels into `ImageData.data` directly so tests do not depend on a native canvas.

`decodeBedFace`:

```ts
import jsQR from 'jsqr'
export function decodeBedFace(image: ImageData): string | null {
  const result = jsQR(image.data, image.width, image.height)
  return result ? result.data : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scan.test.ts`

Expected: PASS for all six cases.

- [ ] **Step 5: Commit**

```bash
git add src/scan.ts tests/scan.test.ts
git commit -m "test: decode square, rounded, and dots bed faces"
```

---

### Task 9: Page, preview, export

**Files:**
- Create: `src/preview.ts`, `src/printHelp.ts`, `src/app.ts`
- Modify: `src/main.ts`, `src/style.css`, `index.html`
- Test: none on look. Manual check listed below.

**Interfaces:**
- Consumes: `clampSettings`, `canEncode`, `encodeQr`, `buildBodies`, `writeBinaryStl`, `clampLogoPercent`
- Produces:

```ts
export const PRINT_HELP_STEPS: string[]
export function mountApp(root: HTMLElement): void
export function createPreview(container: HTMLElement): {
  setMeshes(black: Triangle[], white: Triangle[]): void
  setVisible(which: 'black' | 'white', visible: boolean): void
  dispose(): void
}
export function downloadStl(filename: string, buffer: ArrayBuffer): void
export async function logoMaskFromFile(file: File): Promise<boolean[][] | 'error'>
```

`PRINT_HELP_STEPS` is exactly:

1. `Print qr-black.stl first. Use the dark filament. Leave the part on the bed.`
2. `Change to the light filament.`
3. `Print qr-white.stl on the same bed. Do not home Z in a way that hits the first part. Do not clear the bed.`
4. `The white part fills the gaps. Then it prints a solid cap over the top.`
5. `Remove the part. The scannable face is the bed side.`

Also render this sentence under the list: `Both files share the same origin. Keep that origin in the slicer.`

`logoMaskFromFile`: accept `image/svg+xml`, `image/png`, `image/jpeg`. Draw onto a 512×512 canvas with a white background, then `thresholdMask`. On failure return `'error'`. SVG uses `Image` + object URL, same as PNG/JPG. This gives the spec 2-color result. Do not parse SVG path commands in version 1.

Page blocks, in this order, each with a short label:

- Content: one text field
- Style: three choices, one line: square, rounded, dots
- Size: width mm, black height mm, cap thickness mm
- Logo: file input, size slider, one-line error
- Preview: canvas + show black / show white toggles
- Export: two buttons `qr-black.stl` and `qr-white.stl`
- How to print: the steps above

Empty content: disable export. Preview shows `Type a URL or some text.`

Text that `canEncode` rejects: show a character count and `This text is too long for one QR code.` Disable export. Do not cut the text.

Out-of-range numbers: clamp on input `change` / `blur` via `clampSettings`.

Logo slider: `min=10`, `max=clampLogoPercent(30, matrix.size)` after encode, or 30 before encode.

A form change rebuilds matrix, bodies, and preview.

CSS: light page `#fafafa`, text `#111`, system font, max width about 40 rem, large padding between blocks, no cards, no shadows, no accent palette.

Preview: `three.js` Orthographic or Perspective camera. Two meshes, black `0x111111` and off-white `0xf4f4f4`. Mouse drag rotates. Both parts sit on z = 0 as modeled.

`downloadStl` makes a `Blob` with type `model/stl` and clicks an `<a download>`.

- [ ] **Step 1: Write print-help source of truth**

`src/printHelp.ts`:

```ts
export const PRINT_HELP_STEPS = [
  'Print qr-black.stl first. Use the dark filament. Leave the part on the bed.',
  'Change to the light filament.',
  'Print qr-white.stl on the same bed. Do not home Z in a way that hits the first part. Do not clear the bed.',
  'The white part fills the gaps. Then it prints a solid cap over the top.',
  'Remove the part. The scannable face is the bed side.',
] as const

export const PRINT_HELP_ORIGIN =
  'Both files share the same origin. Keep that origin in the slicer.'
```

No failing unit test for copy. Do not paraphrase these strings in the page.

- [ ] **Step 2: Implement preview**

`src/preview.ts`: build a `Scene`, `WebGLRenderer`, `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js`. Convert `Triangle[]` to `BufferGeometry` (positions + computed normals). `setVisible` toggles mesh `.visible`.

- [ ] **Step 3: Implement app shell**

`src/app.ts` builds the labeled DOM in `mountApp`. Wire inputs to a `rebuild()` function:

```ts
function rebuild() {
  const settings = clampSettings(readForm())
  writeClampedForm(settings)
  if (!settings.content) {
    setNote('Type a URL or some text.')
    setExportEnabled(false)
    return
  }
  if (!canEncode(settings.content, settings.hasLogo)) {
    setNote(`This text is too long for one QR code. (${settings.content.length} characters)`)
    setExportEnabled(false)
    return
  }
  setNote('')
  const matrix = encodeQr(settings.content, settings.hasLogo)
  settings.logoSizePercent = clampLogoPercent(settings.logoSizePercent, matrix.size)
  const bodies = buildBodies(settings, matrix, logoMask)
  preview.setMeshes(bodies.black, bodies.white)
  last = { settings, bodies }
  setExportEnabled(true)
}
```

Export buttons call `writeBinaryStl` and `downloadStl('qr-black.stl', ...)` / `downloadStl('qr-white.stl', ...)`.

- [ ] **Step 4: Boot and style**

`src/main.ts`:

```ts
import './style.css'
import { mountApp } from './app'

const root = document.querySelector<HTMLDivElement>('#app')
if (root) mountApp(root)
```

Write `src/style.css` for the plain layout described above.

- [ ] **Step 5: Manual check**

Run: `npm test`

Expected: all tests PASS.

Run: `npm run dev`

Check in the browser:

1. Type `https://example.com`. Preview shows a square plate with a QR.
2. Switch style to rounded, then dots. Finders stay square.
3. Upload a PNG logo. Center clears. Slider will not enter a finder.
4. Bad file (for example a `.txt`): one-line error. Logo drops.
5. Empty the field: export off. Note shows.
6. How to print matches `PRINT_HELP_STEPS` and `PRINT_HELP_ORIGIN`.
7. Download both STL files. Open them in a slicer. They share the origin. White has holes for black, then a cap.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts src/style.css src/app.ts src/preview.ts src/printHelp.ts src/logo.ts
git commit -m "feat: local page to preview and export two STL files"
```

---

## Self-review

**Spec coverage**

| Spec section | Task |
|---|---|
| Goal, two files, bed-side scan | 7, 8, 9 |
| Out of scope | Global constraints. No tasks add those features. |
| Architecture, libraries | 1, 2, 7, 9 |
| UI blocks and How to print | 9 |
| Geometry, frame, quiet zone, gap 0.20 mm | 3, 4, 6, 7 |
| Styles and square finders | 4, 8 |
| Size ranges | 1, 9 |
| Logo process | 5, 9 |
| Data flow | 9 |
| Errors | 2, 5, 9 |
| Tests including scan | 1–8 |
| File names, origin | 6, 7, 9 |
| Success criteria | 8, 9 |

**Placeholder scan:** none.

**Type consistency:** `QrSettings`, `QrMatrix`, `Layout`, `Polygon`, `Triangle`, `Bodies` keep the same field names in every task. ECC is `'Q' | 'H'`. Gap is `GAP_MM = 0.2`. Files are `qr-black.stl` and `qr-white.stl`.
