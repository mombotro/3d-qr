export const PRINT_HELP_STEPS = [
  'Print qr-black.stl first. Use the dark filament. Leave the part on the bed.',
  'Print the QR code slowly. Use 2 walls. Do not use a skirt or brim.',
  'Set Z hop higher than the QR layer so the nozzle clears the first print.',
  'Change to the light filament.',
  'Print qr-white.stl on the same bed. Do not home Z in a way that hits the first part. Do not clear the bed.',
  'The white part fills the gaps. Then it prints the back: a solid cap, or walls if hollow.',
  'If you turned on a lid, print qr-lid.stl as its own job.',
  'Remove the part. The scannable face is the bed side.',
] as const

export const PRINT_HELP_ORIGIN =
  'Both files share the same origin and the same XY box. In Orca they line up as loaded. In Cura turn off Ensure models are kept apart, load both, then set the same X and Y on each (or Merge). Do not let Cura center them one at a time.'

export const PRINT_HELP_CASSETTE = [
  'Print qr-black.stl first. QR face on the bed. Print slowly. Use 2 walls. Do not use a skirt or brim.',
  'Set Z hop higher than the QR layer so the nozzle clears the first print.',
  'Print qr-white.stl (the top plate) on the same bed, on the same X and Y as the black job. Do not home Z into the first part. Do not clear the bed.',
  'Print cassette-bottom.stl as its own job. Print cassette-slider.stl if you used the slotted shell.',
  'If you used inset head, print cassette-window.stl and glue it to the top plate.',
  'Glue the top plate into the bottom shell. Slide the slider over the extra hole if a scan needs a solid back.',
  'The scannable face is the bed side of the top plate.',
] as const
