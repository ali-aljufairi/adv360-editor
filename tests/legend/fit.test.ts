import { describe, expect, it } from 'vitest'
import {
  LEGEND_SCALE,
  abbreviate,
  capacityEm,
  fitLegend,
  lineFits,
  measureEm,
} from '../../src/lib/legend/fit'

const WIDTHS = [1, 1.25, 1.5, 2, 3]
const SAMPLES = [
  'Keypad',
  '^Space',
  'Backspace',
  'Screensaver',
  'Bluetooth',
  'Play/Pause',
  'BT clear all',
  'Keypad 1',
  '⌘⌃4',
  '⌘⌥⌃⇧W',
  'PageDown',
  'PrintScreen',
  'NOT_A_REAL_KEYCODE_NAME',
  'Thisisaverylongwordwithoutanybreakpoints',
  'Caps Word Lock Something Else',
  'M',
  '',
]

/** Every rendered line of a fitted result must fit at the chosen size and width. */
function assertFits(text: string, size: keyof typeof LEGEND_SCALE, widthUnits: number) {
  for (const line of text.split('\n')) {
    expect(lineFits(line, size, widthUnits), `"${line}" at ${size} in ${widthUnits}u`).toBe(true)
  }
}

describe('fitLegend: the two required cases', () => {
  it('fits "Keypad" at 1u by abbreviating without clipping', () => {
    const fitted = fitLegend('Keypad', 1)
    expect(fitted).toEqual({ text: 'Kpd', size: 'lg', lines: 1 })
  })

  it('fits "^Space" at 1u by abbreviating without clipping', () => {
    const fitted = fitLegend('^Space', 1)
    expect(fitted).toEqual({ text: '^Spc', size: 'lg', lines: 1 })
  })
})

describe('fitLegend: width model', () => {
  it('reserves padding out of the keycap width', () => {
    expect(capacityEm(1)).toBe(3)
    expect(capacityEm(2)).toBe(7)
  })

  it('measures wide glyphs more than narrow ones', () => {
    expect(measureEm('⌘')).toBeGreaterThan(measureEm('i'))
    expect(measureEm('MM')).toBeGreaterThan(measureEm('ii'))
  })

  it('never returns a line wider than the model allows', () => {
    for (const widthUnits of WIDTHS) {
      for (const sample of SAMPLES) {
        const fitted = fitLegend(sample, widthUnits)
        assertFits(fitted.text, fitted.size, widthUnits)
      }
    }
  })

  it('never returns more than two lines', () => {
    for (const sample of SAMPLES) {
      expect(fitLegend(sample, 1).text.split('\n').length).toBeLessThanOrEqual(2)
    }
  })
})

describe('fitLegend: strategy order', () => {
  it('keeps the full text when it already fits at lg', () => {
    expect(fitLegend('Space', 1.5)).toEqual({ text: 'Space', size: 'lg', lines: 1 })
  })

  it('abbreviates before stepping down the font size', () => {
    expect(fitLegend('Backspace', 1)).toEqual({ text: 'Bksp', size: 'lg', lines: 1 })
  })

  it('steps the font down on one line before it wraps', () => {
    expect(fitLegend('Play/Pause', 1)).toEqual({ text: 'Play/Pause', size: 'xs', lines: 1 })
  })

  it('wraps to two lines at a natural break when no single line fits', () => {
    const fitted = fitLegend('Play/Pause/Stop/Next', 1)
    expect(fitted.lines).toBe(2)
    expect(fitted.text.replace('\n', '')).toBe('Play/Pause/Stop/Next')
    assertFits(fitted.text, fitted.size, 1)
  })

  it('never drops characters silently: the text is preserved apart from abbreviation', () => {
    for (const sample of SAMPLES) {
      const fitted = fitLegend(sample, 1)
      const rendered = fitted.text.replace('\n', '')
      const allowed = [sample, abbreviate(sample)]
      expect(allowed.includes(rendered) || rendered.endsWith('…')).toBe(true)
    }
  })

  it('shows a visible ellipsis only as a last resort', () => {
    const fitted = fitLegend('Thisisaverylongwordwithoutanybreakpoints', 1)
    expect(fitted.text.endsWith('…')).toBe(true)
    assertFits(fitted.text, fitted.size, 1)
  })

  it('abbreviates only known words', () => {
    expect(abbreviate('Keypad 1 + Space')).toBe('Kpd 1 + Spc')
    expect(abbreviate('Unknownword')).toBe('Unknownword')
  })
})
