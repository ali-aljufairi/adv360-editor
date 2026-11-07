import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { ACTIONS, KEYS, LAYER_ACTIONS } from '../../src/lib/keycodes/catalog'
import { describeBinding } from '../../src/lib/legend/describe'
import { createEditor, loadPhysicalLayout } from '../../src/lib/zmk'
import { files } from '../zmk/fixtures'
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
    expect(fitted).toEqual({ text: 'Kpd', full: 'Keypad', size: 'lg', lines: 1 })
  })

  it('fits "^Space" at 1u by abbreviating without clipping', () => {
    const fitted = fitLegend('^Space', 1)
    expect(fitted).toEqual({ text: '^Spc', full: '^Space', size: 'lg', lines: 1 })
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
    expect(fitLegend('Space', 1.5)).toEqual({ text: 'Space', full: 'Space', size: 'lg', lines: 1 })
  })

  it('abbreviates before stepping down the font size', () => {
    expect(fitLegend('Backspace', 1)).toEqual({
      text: 'Bksp',
      full: 'Backspace',
      size: 'lg',
      lines: 1,
    })
  })

  it('steps the font down on one line before it wraps', () => {
    expect(fitLegend('Play/Pause', 1)).toEqual({
      text: 'Play/Pause',
      full: 'Play/Pause',
      size: 'xs',
      lines: 1,
    })
  })

  it('wraps to two lines at a natural break when no single line fits', () => {
    const fitted = fitLegend('Play/Pause/Stop/Next', 1)
    expect(fitted.lines).toBe(2)
    expect(fitted.text.replace('\n', '')).toBe('Play/Pause/Stop/Next')
    assertFits(fitted.text, fitted.size, 1)
  })

  it('returns the original and a deterministic short form without ellipsis', () => {
    for (const sample of [
      'my_really_long_macro_name_v2',
      'Navigation and Symbols',
      'Thisisaverylongwordwithoutanybreakpoints',
    ]) {
      const fitted = fitLegend(sample, 1)
      expect(fitted.full).toBe(sample)
      expect(fitted.text).not.toContain('…')
      expect(fitLegend(sample, 1)).toEqual(fitted)
      assertFits(fitted.text, fitted.size, 1)
    }
    expect(fitLegend('my_really_long_macro_name_v2', 1).text).toBe('my_rlly_lng\n_mcr_nm_v2')
    expect(fitLegend('Navigation and Symbols', 1).text).toBe('Nav \nand Sym')
    expect(fitLegend('my_really_long_macro_name_v2', 1).text).not.toBe(
      fitLegend('my_really_long_macro_name_v3', 1).text,
    )
  })

  it('abbreviates only known words', () => {
    expect(abbreviate('Keypad 1 + Space')).toBe('Kpd 1 + Spc')
    expect(abbreviate('Unknownword')).toBe('Unknownword')
  })
})

describe('fixture and catalog coverage', () => {
  it('fits every legend at every Advantage360 key width', () => {
    const widths = [
      ...new Set(
        loadPhysicalLayout(readFileSync('fixtures/adv360/info.json', 'utf8')).map((key) => key.w),
      ),
    ]
    const labels: string[] = []
    for (const entry of Object.keys(files).filter((path) => path.endsWith('.keymap'))) {
      const model = createEditor(files, entry).model
      const layerNames = model.layers.map((layer) => layer.displayName ?? layer.name)
      for (const layer of model.layers)
        for (const binding of layer.bindings) {
          const legend = describeBinding(binding, { layerNames })
          labels.push(legend.primary, legend.secondary ?? '')
        }
    }
    for (const entry of KEYS) {
      labels.push(entry.label)
      for (const code of [entry.code, ...entry.aliases])
        labels.push(describeBinding({ behavior: '&kp', params: [code] }).primary)
    }
    for (const entry of ACTIONS) {
      labels.push(
        entry.label,
        describeBinding({ behavior: entry.behavior, params: [...entry.params] }).primary,
      )
    }
    for (const entry of LAYER_ACTIONS)
      labels.push(entry.label, describeBinding({ behavior: entry.behavior, params: ['0'] }).primary)
    expect(labels.length).toBeGreaterThan(100)
    for (const width of widths)
      for (const label of labels) {
        const fitted = fitLegend(label, width)
        expect(fitted.full).toBe(label)
        expect(fitted.text).not.toContain('…')
        expect(fitted.text.split('\n')).toHaveLength(fitted.lines)
        expect(fitted.lines).toBeLessThanOrEqual(2)
        assertFits(fitted.text, fitted.size, width)
      }
  })
})
