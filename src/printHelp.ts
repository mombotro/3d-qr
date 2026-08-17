export const PRINT_HELP_STEPS = [
  'Print qr-black.stl first. Use the dark filament. Leave the part on the bed.',
  'Change to the light filament.',
  'Print qr-white.stl on the same bed. Do not home Z in a way that hits the first part. Do not clear the bed.',
  'The white part fills the gaps. Then it prints a solid cap over the top.',
  'Remove the part. The scannable face is the bed side.',
] as const

export const PRINT_HELP_ORIGIN =
  'Both files share the same origin. Keep that origin in the slicer.'
