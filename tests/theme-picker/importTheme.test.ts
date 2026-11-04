import { describe, expect, it } from 'vitest'
import { parseThemeImport } from '../../src/components/theme-picker/importTheme'

const ghostty = [
  '# a comment',
  'background = #1e1e2e',
  'foreground = #cdd6f4',
  'cursor-color = #f5e0dc',
  'font-family = Iosevka',
  'palette = 0=#45475a',
  'palette = 1=#f38ba8',
].join('\n')

describe('parseThemeImport', () => {
  it('reads Ghostty palette text into a terminal theme with a stable id', () => {
    const theme = parseThemeImport(ghostty)
    expect(theme.type).toBe('terminal')
    expect(theme.name).toBe('Imported Ghostty palette')
    expect(theme.palette?.background).toBe('#1e1e2e')
    expect(theme.palette?.foreground).toBe('#cdd6f4')
    expect(theme.palette?.ansi[1]).toBe('#f38ba8')
    expect(theme.id).toMatch(/^custom:ghostty-[0-9a-z]+$/)
    expect(parseThemeImport(ghostty).id).toBe(theme.id)
  })

  it('reads OpenCode JSON into a semantic theme and keeps its name and defs', () => {
    const json = JSON.stringify({
      name: 'Night Desk',
      defs: { ink: '#111111' },
      theme: { text: '#eeeeee', background: { dark: '#000000', light: '#ffffff' } },
    })
    const theme = parseThemeImport(json)
    expect(theme.type).toBe('semantic')
    expect(theme.name).toBe('Night Desk')
    expect(theme.defs).toEqual({ ink: '#111111' })
    expect(theme.theme?.text).toBe('#eeeeee')
    expect(theme.id).toMatch(/^custom:opencode-/)
  })

  it('names an OpenCode theme without a name', () => {
    expect(parseThemeImport('{"theme":{"text":"#fff"}}').name).toBe('Imported OpenCode')
  })

  it('explains empty input', () => {
    expect(() => parseThemeImport('   ')).toThrow('Paste a Ghostty theme or OpenCode JSON first.')
  })

  it('explains malformed JSON', () => {
    expect(() => parseThemeImport('{ nope')).toThrow('That is not valid JSON.')
  })

  it('explains JSON without a theme object', () => {
    expect(() => parseThemeImport('{"name":"x"}')).toThrow('OpenCode JSON needs a "theme" object.')
    expect(() => parseThemeImport('{"theme":[]}')).toThrow('OpenCode JSON needs a "theme" object.')
  })

  it('explains Ghostty text without colours', () => {
    expect(() => parseThemeImport('font-size = 14')).toThrow(
      'No Ghostty colours found. A background and foreground are required.',
    )
  })
})
