import { describe, expect, it } from 'vitest'
import { ACTIONS, KEYS, LAYER_ACTIONS, resolveKeyCode } from '../../src/lib/keycodes/catalog'
import { rankEntries, scoreEntry } from '../../src/lib/keycodes/fuzzy'
import { buildItems, describeBinding } from '../../src/components/picker/items'
import behaviorCatalog from '../../vendor/zmk/adv360-z3.5-2/behavior-bindings.json'

const keyFields = (entry: (typeof KEYS)[number]) => ({
  label: entry.label,
  code: entry.code,
  aliases: entry.aliases,
  keywords: entry.keywords,
})

/** Asserts two spellings name the same key, whichever spelling is canonical. */
function expectSameKey(actual: string, expected: string): void {
  expect(resolveKeyCode(actual)).toBe(resolveKeyCode(expected))
}

describe('fuzzy ranking over the key catalog', () => {
  it('ranks the Backspace key first for "bksp" (alias match)', () => {
    const ranked = rankEntries('bksp', KEYS, keyFields)
    expectSameKey(ranked[0].code, 'BSPC')
  })

  it('ranks the left Shift key first for "shift"', () => {
    const ranked = rankEntries('shift', KEYS, keyFields)
    expectSameKey(ranked[0].code, 'LSHFT')
  })

  it('ranks F1 above F10 for "f1", and never puts F10 first', () => {
    const ranked = rankEntries('f1', KEYS, keyFields).map((entry) => entry.code)
    expect(ranked[0]).toBe('F1')
    expect(ranked.indexOf('F1')).toBeLessThan(ranked.indexOf('F10'))
  })

  it('returns every entry in catalog order for an empty query', () => {
    expect(rankEntries('  ', KEYS, keyFields)).toEqual([...KEYS])
  })

  it('returns nothing when no entry matches', () => {
    expect(rankEntries('zqxjv', KEYS, keyFields)).toEqual([])
  })

  it('matches on aliases', () => {
    const ranked = rankEntries('lshft', KEYS, keyFields)
    expectSameKey(ranked[0].code, 'LSHFT')
  })

  it('matches multi-word keyword recipes such as "ctrl c" to copy', () => {
    const copy = ACTIONS.find((entry) => entry.id === 'copy')
    expect(copy).toBeDefined()
    const score = scoreEntry('ctrl c', {
      label: copy?.label ?? '',
      keywords: copy?.keywords ?? [],
    })
    expect(score).toBeGreaterThan(0)
  })
})

describe('fuzzy scoring tiers', () => {
  it('scores an exact match above a prefix match', () => {
    const exact = scoreEntry('copy', { label: 'Copy' })
    const prefix = scoreEntry('cop', { label: 'Copy' })
    expect(exact).toBeGreaterThan(prefix)
  })

  it('scores a prefix above a scattered subsequence', () => {
    const prefix = scoreEntry('cop', { label: 'Copy' })
    const subsequence = scoreEntry('cop', { label: 'Scope' })
    expect(prefix).toBeGreaterThan(subsequence)
  })

  it('scores a word-start match above a mid-word subsequence', () => {
    const wordStart = scoreEntry('ctrl', { label: 'Left Ctrl' })
    const midWord = scoreEntry('ctrl', { label: 'Lxcxtrxl' })
    expect(wordStart).toBeGreaterThan(midWord)
  })

  it('ranks keyword hits below label hits', () => {
    const label = scoreEntry('copy', { label: 'Copy' })
    const keyword = scoreEntry('copy', { label: 'Paste', keywords: ['copy'] })
    expect(label).toBeGreaterThan(keyword)
    expect(keyword).toBeGreaterThan(0)
  })

  it('returns 0 when a query word matches no field', () => {
    expect(scoreEntry('copy paste', { label: 'Copy' })).toBe(0)
  })
})

describe('natural-language picker ranking', () => {
  const items = buildItems([], [], [], 'mac')
  const top = (query: string) => rankEntries(query, items, (item) => item)[0]

  it.each([
    ['copy', 'action:copy'],
    ['paste', 'action:paste'],
    ['vol up', 'key:C_VOLUME_UP'],
    ['play', 'key:C_PLAY_PAUSE'],
    ['mute', 'key:C_MUTE'],
    ['bright', 'key:C_BRIGHTNESS_INC'],
    ['globe', 'key:GLOBE'],
    ['kana', 'key:LANG1'],
    ['fn', 'key:F1'],
    ['prtsc', 'key:PRINTSCREEN'],
    ['del', 'key:DELETE'],
  ])('ranks %s to %s first', (query, expected) => {
    expect(top(query)?.id).toBe(expected)
  })

  it('does not match copy to C_SHUFFLE and lowers raw HID copy usages', () => {
    const ranked = rankEntries('copy', items, (item) => item)
    expect(ranked.some((item) => item.code === 'C_SHUFFLE')).toBe(false)
    expect(ranked.findIndex((item) => item.id === 'action:copy')).toBeLessThan(
      ranked.findIndex((item) => item.code === 'COPY' || item.code === 'C_AC_COPY'),
    )
    expect(items.find((item) => item.code === 'COPY')?.note).toBe(
      'HID key, may not work on macOS/Windows',
    )
  })

  it('has a picker row and a human legend for every built-in binding in this firmware catalog', () => {
    const pickerBehaviors = new Set([
      ...ACTIONS.map((entry) => entry.behavior),
      ...LAYER_ACTIONS.map((entry) => entry.behavior),
    ])
    for (const behavior of behaviorCatalog.behaviors) {
      expect(pickerBehaviors.has(behavior.name), behavior.name).toBe(true)
      const tokens = behavior.example.trim().split(/\s+/)
      const value = { behavior: tokens[0], params: tokens.slice(1) }
      expect(describeBinding(value, 'mac'), behavior.name).not.toContain('&')
    }
  })
})
