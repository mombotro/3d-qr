# Dual-file 3D QR code. Design spec

Date: 2026-08-17  
Status: draft, waiting for review  
Product: local web tool that builds two STL files for a two-job bed print

## 1. Goal

The user types a URL or plain text. The page builds a scannable QR code.

The tool writes two STL files:

- `qr-black.stl`: dark modules and the outer frame. Print this first.
- `qr-white.stl`: fill around the black parts, then a solid cap. Print this second.

The first print stays on the bed. The second print fits around it. The scannable face is the bed side.

The tool runs in the browser. There is no server and no account.

## 2. Out of scope for version 1

Payload and style left out:

- Wi-Fi, vCard, Spotify, and other payload types
- Built-in icon list
- Extra QR styles (classy, extra-rounded)
- Rectangular Micro QR (rMQR)

Plate and export left out:

- Non-square plates
- Pen tool for a custom plate
- Multi-material / AMS one-file export
- Mid-print filament swap in one file
- Cloud save, accounts, batch jobs

Later work, after the square flow works:

- Other plate shapes
- Pen tool for a custom plate outline

## 3. Architecture

One local page. Vite and TypeScript. The browser does all the work.

Four parts:

1. **Form**: content, style, size, optional logo.
2. **QR core**: module matrix. Error correction is High when a logo is present. Else Quartile.
3. **Mesh builder**: two bodies from the matrix and the logo.
4. **Preview and export**: `three.js` view. Two binary STL files.

Libraries:

- QR encode: `uqr`
- Preview: `three.js`
- 2D subtract for the white fill: a polygon clipper
- Tests: Vitest
- Logo raster: canvas threshold. SVG: path parse

## 4. User interface

Plain page. Light background. Dark text. Default type. Large white space.

Blocks from top to bottom. Each block has a short label.

**Content**  
One field. URL or plain text.

**Style**  
Three choices on one line: square, rounded, dots.

**Size**  
Width (mm). Black height (mm). Cap thickness (mm).

**Logo**  
Optional upload. SVG, PNG, or JPG. Logo size slider (percent of code width).

**Preview**  
One 3D view. Both parts on the bed. The mouse rotates the view.  
Toggles: show black, show white.

**Export**  
Two buttons: `qr-black.stl`, `qr-white.stl`.

**How to print**  
This block stays on the page. Use this text:

1. Print `qr-black.stl` first. Use the dark filament. Leave the part on the bed.
2. Change to the light filament.
3. Print `qr-white.stl` on the same bed. Do not home Z in a way that hits the first part. Do not clear the bed.
4. The white part fills the gaps. Then it prints a solid cap over the top.
5. Remove the part. The scannable face is the bed side.

Also state: both files share the same origin. Keep that origin in the slicer.

## 5. Geometry

Units are millimeters. Both files use the same XY origin. The plate min corner is `(0, 0, 0)`. Z is up.

The plate is a square. The user width is the outer width, frame included.

Layout from outside in:

- Frame: 2 modules wide. Part of the black file.
- Quiet zone: 4 modules. Part of the white fill.
- QR matrix: style shapes for each module.

### Black body

- Dark modules, in the selected style
- Outer frame
- Dark parts of the logo
- Height = black height
- Sits on Z = 0

Finder squares (the three corner marks) stay square in every style.

### White body

Two stacked parts, one mesh:

1. **Fill**: a square plate from Z = 0 to Z = black height, minus the black footprints. Grow each black footprint by the gap before the subtract. The fill goes around modules, the frame, and the logo.
2. **Cap**: a solid square from Z = black height to Z = black height + cap thickness. No holes. Covers the full plate.

### Gap

XY gap between black and white: **0.20 mm**. The tool sets this. The user does not edit it.

Black and white must not overlap in X or Y. They may touch the same Z band. The cap sits on both.

### Styles

Each data module sits in one cell of the matrix.

- **Square**: the full cell.
- **Rounded**: a rounded square. Corner radius = 30 percent of the module.
- **Dots**: a circle. Diameter = 90 percent of the module.

White fill always follows the real black outline, not the cell square. For dots, white fills the corners around each circle.

### Size ranges

| Field | Min | Default | Max |
|---|---|---|---|
| Width | 30 mm | 80 mm | 200 mm |
| Black height | 0.6 mm | 1.2 mm | 4 mm |
| Cap thickness | 0.4 mm | 0.8 mm | 3 mm |
| Logo size | 10 percent | 20 percent | 30 percent |

A value outside the range snaps to the nearest allowed value.

## 6. Logo

Optional. File types: SVG, PNG, JPG.

Process:

1. Error correction becomes High.
2. Clear a center square of data modules. Do not clear finder, timing, or alignment patterns.
3. Fit the logo in that square.
4. SVG becomes a 2D path. PNG and JPG become a 2-color mask. A pixel at or below 50 percent luminance is dark.
5. Dark logo shape is in the black file. Light or empty logo area stays in the white fill.

The slider is the logo width as a percent of the QR matrix width (frame not included). Max 30 percent. The slider must stop before the logo hits a finder square.

If the file cannot be read, drop the logo and show one line under the upload control.

## 7. Data flow

1. The user sets content, style, size, and an optional logo.
2. The QR core builds the module matrix.
3. If a logo is present, the core clears the center and stamps the logo.
4. The mesh builder makes the black body and the white body.
5. The preview shows both bodies.
6. Export writes two binary STL files.

A form change rebuilds the matrix, the meshes, and the preview.

The page does not send data. The page does not store data.

## 8. Errors

- Empty content: Export is off. Preview shows a short note.
- Text too long for one QR (version 40, chosen ECC): show a count and block export. Do not cut the text.
- Bad logo file: ignore the logo. Show one line under the upload control.
- Logo would hit a finder: clamp the slider.
- Size out of range: snap to the nearest allowed value.

The preview and the STL files always use the same numbers.

## 9. Testing

Vitest on the core. No test on page look.

Matrix and size checks:

- Matrix matches the input text.
- ECC is High when a logo is present. Else Quartile.
- Width, black height, and cap stay in range.

Mesh checks:

- Black body holds only dark modules, the frame, and dark logo. Height = black height.
- White body is fill plus cap. Cap starts at black height. Cap has no holes.
- Black and white do not overlap in X or Y. Gap is 0.20 mm.
- Logo stays in the center. Finder squares stay clear.
- Each export is a valid binary STL.

Scan test: a 2D top-down image of the bed face must decode with a JS QR reader. Run this for square, rounded, and dots. Run with a logo and with no logo.

## 10. File names and formats

- `qr-black.stl`: binary STL
- `qr-white.stl`: binary STL

Both meshes are in mm. Both share origin `(0, 0, 0)` at the plate min corner.

## 11. Success

Version 1 is done when:

1. A URL and a short text each produce two valid STL files.
2. The three styles decode in the scan test, with and without a logo.
3. A slicer can place both files on the same origin.
4. The How to print block is on the page and matches this spec.
