import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Keycap } from '../../src/components/keycap/Keycap'
import { describeBinding } from '../../src/lib/legend/describe'

const render = (primary: string, units = 1, secondary?: string) =>
  renderToStaticMarkup(
    createElement(Keycap, {
      legend: { primary, secondary, kind: 'key' },
      w: units,
    }),
  )

describe('Keycap rendering', () => {
  it('renders a button with the full, un-abbreviated legend as aria-label', () => {
    const html = render('Keypad')
    expect(html).toContain('<button')
    expect(html).toContain('aria-label="Keypad"')
    expect(html).toContain('title="Keypad"')
  })

  it('renders the abbreviated legend as visible text', () => {
    expect(render('Keypad')).toContain('>Kpd<')
    expect(render('^Space')).toContain('>^Spc<')
  })

  it('applies the keycap width through a calc on the unit variable', () => {
    expect(render('A', 1.5)).toContain('calc(var(--keycap-unit, 3.5rem) * 1.5)')
  })

  it('exposes kind and changed/selected state as data attributes', () => {
    const html = renderToStaticMarkup(
      createElement(Keycap, {
        legend: describeBinding({ behavior: '&mo', params: ['1'] }, { layerNames: ['A', 'Nav'] }),
        selected: true,
        changed: true,
        onSelect: () => undefined,
      }),
    )
    expect(html).toContain('data-kind="layer"')
    expect(html).toContain('data-selected="true"')
    expect(html).toContain('data-changed="true"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('renders the secondary legend when present', () => {
    expect(render('1', 1, 'F1')).toContain('>F1<')
  })
})
