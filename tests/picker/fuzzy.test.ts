import { describe, expect, it } from 'vitest'
import { ACTIONS, KEYS } from '../../src/lib/keycodes/catalog'
import { rankEntries, scoreEntry } from '../../src/lib/keycodes/fuzzy'

const keyFields = (entry: (typeof KEYS)[number]) => ({
  label: entry.label,
  code: entry.code,
  aliases: entry.aliases,
  keywords: entry.keywords,
})

describe('fuzzy ranking over the key catalog', () => {
  it('ranks BACKSPACE first for "bksp" (alias match)', () => {
    const ranked = rankEntries('bksp', KEYS, keyFields)
    expect(ranked[0].code).toBe('BACKSPACE')
  })

  it('ranks LSHIFT first for "shift"', () => {
    const ranked = rankEntries('shift', KEYS, keyFields)
    expect(ranked[0].code).toBe('LSHIFT')
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
    expect(ranked[0].code).toBe('LSHIFT')
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
