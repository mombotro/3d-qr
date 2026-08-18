import { describe, expect, it } from 'vitest'
import { PRINT_HELP_CASSETTE, PRINT_HELP_ORIGIN, PRINT_HELP_STEPS } from '../src/printHelp'

describe('PRINT_HELP_STEPS', () => {
  it('tells the user to print the QR slowly with 2 walls and no skirt or brim', () => {
    const text = PRINT_HELP_STEPS.join(' ')
    expect(text).toMatch(/slowly/i)
    expect(text).toMatch(/2 walls/i)
    expect(text).toMatch(/skirt/i)
    expect(text).toMatch(/brim/i)
  })

  it('tells the user to set Z hop higher than the QR layer', () => {
    const text = PRINT_HELP_STEPS.join(' ')
    expect(text).toMatch(/z hop/i)
    expect(text).toMatch(/qr/i)
  })

  it('still states that both files share an origin', () => {
    expect(PRINT_HELP_ORIGIN).toMatch(/origin/i)
  })

  it('has cassette steps for the top plate, shell, and slider', () => {
    const text = PRINT_HELP_CASSETTE.join(' ')
    expect(text).toMatch(/top plate/i)
    expect(text).toMatch(/slider/i)
    expect(text).toMatch(/bottom/i)
  })
})
