import { describe, expect, it } from 'vitest'
import { matchSpans, pickerKeyAction } from '../../src/components/picker/listKeys'
import { commonIds, describeBinding } from '../../src/components/picker/items'
import { eventToToken } from '../../src/lib/navigation/keys'

describe('pickerKeyAction', () => {
  it('moves the list with the arrows in every scheme', () => {
    for (const scheme of ['arrows', 'vim', 'emacs', 'custom'] as const) {
      expect(pickerKeyAction('ArrowDown', scheme)).toBe('down')
      expect(pickerKeyAction('ArrowUp', scheme)).toBe('up')
    }
  })

  it('uses C-j and C-k, and C-n and C-p, in vim', () => {
    expect(pickerKeyAction('C-j', 'vim')).toBe('down')
    expect(pickerKeyAction('C-k', 'vim')).toBe('up')
    expect(pickerKeyAction('C-n', 'vim')).toBe('down')
    expect(pickerKeyAction('C-p', 'vim')).toBe('up')
  })

  it('never takes plain j or k in vim, because they type into the search', () => {
    expect(pickerKeyAction('j', 'vim')).toBeNull()
    expect(pickerKeyAction('k', 'vim')).toBeNull()
  })

  it('uses C-n and C-p in emacs, and C-g closes', () => {
    expect(pickerKeyAction('C-n', 'emacs')).toBe('down')
    expect(pickerKeyAction('C-p', 'emacs')).toBe('up')
    expect(pickerKeyAction('C-g', 'emacs')).toBe('close')
    expect(pickerKeyAction('C-j', 'emacs')).toBeNull()
  })

  it('takes only the arrows in arrows and custom schemes', () => {
    for (const scheme of ['arrows', 'custom'] as const) {
      expect(pickerKeyAction('C-n', scheme)).toBeNull()
      expect(pickerKeyAction('C-g', scheme)).toBeNull()
      expect(pickerKeyAction('C-j', scheme)).toBeNull()
    }
  })

  it('returns null for no token and for names that only exist on Object.prototype', () => {
    expect(pickerKeyAction(null, 'vim')).toBeNull()
    expect(pickerKeyAction('constructor', 'emacs')).toBeNull()
    expect(pickerKeyAction('__proto__', 'arrows')).toBeNull()
  })

  it('works with tokens from eventToToken, so Ctrl+J in vim moves down', () => {
    const token = eventToToken({
      key: 'j',
      code: 'KeyJ',
      ctrlKey: true,
      altKey: false,
      metaKey: false,
      shiftKey: false,
    })
    expect(pickerKeyAction(token, 'vim')).toBe('down')
  })
})

describe('matchSpans', () => {
  it('marks a contiguous query match', () => {
    const hits = matchSpans('Left Shift', 'shift').filter((span) => span.hit)
    expect(hits.map((span) => span.text)).toEqual(['Shift'])
  })

  it('marks subsequence matches when no substring matches', () => {
    const hits = matchSpans('Left Shift', 'lsh').filter((span) => span.hit)
    expect(hits.map((span) => span.text).join('|')).toBe('L|Sh')
  })

  it('returns one unmarked span when the query is empty or matches nothing', () => {
    expect(matchSpans('Copy', '')).toEqual([{ text: 'Copy', hit: false }])
    expect(matchSpans('Copy', 'zzz')).toEqual([{ text: 'Copy', hit: false }])
  })

  it('keeps the label text intact across spans', () => {
    const spans = matchSpans('Select all', 'all')
    expect(spans.map((span) => span.text).join('')).toBe('Select all')
  })
})

describe('empty-query helpers', () => {
  it('lists the everyday keys first, then the momentary layer for each layer', () => {
    const ids = commonIds([
      { index: 0, name: 'Base' },
      { index: 1, name: 'Nav' },
    ])
    expect(ids.slice(0, 3)).toEqual(['key:BACKSPACE', 'key:ENTER', 'key:ESCAPE'])
    expect(ids.slice(-2)).toEqual(['layer:mo:0', 'layer:mo:1'])
  })

  it('describes a binding in words, with platform modifier names', () => {
    expect(describeBinding({ behavior: '&kp', params: ['LC(LSHFT)'] }, 'windows')).toBe(
      'Ctrl + Left Shift',
    )
    expect(describeBinding({ behavior: '&kp', params: ['LG(C)'] }, 'mac')).toBe('Command + C')
  })
})
