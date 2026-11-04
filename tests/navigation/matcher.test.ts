import { describe, expect, it } from 'vitest'
import { ACTIONS, type Action } from '../../src/lib/navigation/actions'
import { eventToToken, parseSequence, formatSequence, shouldHandleKeydown } from '../../src/lib/navigation/keys'
import { createSequenceMatcher, type MatchResult } from '../../src/lib/navigation/matcher'
import { PRESETS, resolveBindings, usesCounts } from '../../src/lib/navigation/schemes'

/** Minimal KeyboardEvent stand-in for the normalisation helpers. */
function ev(key: string, mods: Partial<Record<'ctrl' | 'alt' | 'meta' | 'shift', boolean>> = {}, code = '') {
  return {
    key,
    code,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    metaKey: mods.meta ?? false,
    shiftKey: mods.shift ?? false,
  }
}

/** Feeds tokens at 10 ms spacing and returns the last result. */
function type(matcher: ReturnType<typeof createSequenceMatcher>, tokens: string[], start = 0) {
  let time = start
  let last: MatchResult = { kind: 'none' }
  for (const token of tokens) {
    last = matcher.feed(token, time)
    time += 10
  }
  return last
}

function expectMatch(result: MatchResult, action: Action, count = 1) {
  expect(result).toMatchObject({ kind: 'match', action, count })
}

describe('sequence parsing', () => {
  it('splits plain letters into single keys and keeps modifier tokens whole', () => {
    expect(parseSequence('gg')).toEqual(['g', 'g'])
    expect(parseSequence('gT')).toEqual(['g', 'T'])
    expect(parseSequence('C-x C-s')).toEqual(['C-x', 'C-s'])
    expect(parseSequence('M-<')).toEqual(['M-<'])
    expect(parseSequence('C-S-/')).toEqual(['C-S-/'])
    expect(parseSequence('Meta-S-z')).toEqual(['Meta-S-z'])
    expect(parseSequence('S-Tab')).toEqual(['S-Tab'])
    expect(parseSequence('ArrowLeft')).toEqual(['ArrowLeft'])
    expect(parseSequence('')).toEqual([])
  })

  it('round-trips through formatSequence', () => {
    for (const text of ['gg', 'C-x C-s', 'M-<', 'Meta-S-z', 'S-Tab', 'ArrowUp']) {
      expect(formatSequence(parseSequence(text))).toBe(text)
    }
  })
})

describe('event normalisation', () => {
  it('turns plain keys into their characters', () => {
    expect(eventToToken(ev('G', { shift: true }))).toBe('G')
    expect(eventToToken(ev('?', { shift: true }))).toBe('?')
    expect(eventToToken(ev('Enter'))).toBe('Enter')
    expect(eventToToken(ev(' '))).toBe('Space')
    expect(eventToToken(ev('Tab', { shift: true }))).toBe('S-Tab')
  })

  it('writes control, alt and command prefixes in canonical order', () => {
    expect(eventToToken(ev('n', { ctrl: true }, 'KeyN'))).toBe('C-n')
    expect(eventToToken(ev('z', { meta: true }, 'KeyZ'))).toBe('Meta-z')
    expect(eventToToken(ev('Z', { meta: true, shift: true }, 'KeyZ'))).toBe('Meta-S-z')
    expect(eventToToken(ev('<', { alt: true, shift: true }, 'Comma'))).toBe('M-<')
    expect(eventToToken(ev('?', { ctrl: true, shift: true }, 'Slash'))).toBe('C-?')
  })

  it('uses the physical key on macOS, where Option rewrites the glyph', () => {
    expect(eventToToken(ev('ƒ', { alt: true }, 'KeyF'))).toBe('M-f')
    expect(eventToToken(ev('≤', { alt: true, shift: true }, 'Comma'))).toBe('M-S-,')
  })

  it('returns null for modifier-only presses', () => {
    expect(eventToToken(ev('Shift', { shift: true }))).toBeNull()
    expect(eventToToken(ev('Control', { ctrl: true }))).toBeNull()
  })
})

describe('preset matching', () => {
  it('vim: motions, gg, G, counts and layer sequences', () => {
    const vim = createSequenceMatcher(PRESETS.vim, { counts: true })
    expectMatch(type(vim, ['h']), 'left')
    expectMatch(type(vim, ['0']), 'rowStart')
    expectMatch(type(vim, ['$']), 'rowEnd')
    expectMatch(type(vim, ['g', 'g']), 'first')
    expectMatch(type(vim, ['G']), 'last')
    expectMatch(type(vim, ['g', 't']), 'nextLayer')
    expectMatch(type(vim, ['g', 'T']), 'prevLayer')
    expectMatch(type(vim, ['i']), 'edit')
    expectMatch(type(vim, ['Escape']), 'cancel')
    expectMatch(type(vim, ['u']), 'undo')
    expectMatch(type(vim, ['C-r']), 'redo')
    expectMatch(type(vim, ['?']), 'help')
  })

  it('vim: counts multiply the motion and 0 is a motion until a count has started', () => {
    const vim = createSequenceMatcher(PRESETS.vim, { counts: true })
    expect(vim.feed('3', 0)).toEqual({ kind: 'pending' })
    expectMatch(vim.feed('l', 10), 'right', 3)
    expect(vim.feed('1', 20)).toEqual({ kind: 'pending' })
    expect(vim.feed('0', 30)).toEqual({ kind: 'pending' })
    expectMatch(vim.feed('j', 40), 'down', 10)
    expectMatch(vim.feed('0', 50), 'rowStart')
  })

  it('vim: a partial sequence waits, then is abandoned after 800 ms', () => {
    const vim = createSequenceMatcher(PRESETS.vim, { counts: true })
    expect(vim.feed('g', 0)).toEqual({ kind: 'pending' })
    expect(vim.pending()).toBe('g')
    expect(vim.feed('g', 900)).toEqual({ kind: 'pending' })
    expect(vim.pending()).toBe('g')
    expectMatch(vim.feed('g', 1000), 'first')
  })

  it('vim: a count is dropped by timeout too', () => {
    const vim = createSequenceMatcher(PRESETS.vim, { counts: true })
    vim.feed('3', 0)
    expectMatch(vim.feed('l', 900), 'right', 1)
  })

  it('vim: an unknown key aborts a partial sequence', () => {
    const vim = createSequenceMatcher(PRESETS.vim, { counts: true })
    vim.feed('g', 0)
    expect(vim.feed('x', 10)).toEqual({ kind: 'none' })
    expect(vim.pending()).toBe('')
  })

  it('counts are ignored unless the scheme enables them', () => {
    const plain = createSequenceMatcher(PRESETS.vim)
    expect(plain.feed('3', 0)).toEqual({ kind: 'none' })
    expect(usesCounts('vim')).toBe(true)
    expect(usesCounts('emacs')).toBe(false)
  })

  it('emacs: C-f C-b C-n C-p, C-a/C-e, M-< M-> (both spellings), C-g, C-/, C-?, M-f/M-b', () => {
    const emacs = createSequenceMatcher(PRESETS.emacs)
    expectMatch(type(emacs, ['C-f']), 'right')
    expectMatch(type(emacs, ['C-b']), 'left')
    expectMatch(type(emacs, ['C-n']), 'down')
    expectMatch(type(emacs, ['C-p']), 'up')
    expectMatch(type(emacs, ['C-a']), 'rowStart')
    expectMatch(type(emacs, ['C-e']), 'rowEnd')
    expectMatch(type(emacs, ['M-<']), 'first')
    expectMatch(type(emacs, ['M-S-,']), 'first')
    expectMatch(type(emacs, ['M->']), 'last')
    expectMatch(type(emacs, ['C-g']), 'cancel')
    expectMatch(type(emacs, ['C-/']), 'undo')
    expectMatch(type(emacs, ['C-?']), 'redo')
    expectMatch(type(emacs, ['M-f']), 'next')
    expectMatch(type(emacs, ['M-b']), 'prev')
  })

  it('arrows: arrow keys, Tab and Shift-Tab, Home/End, brackets, undo and redo', () => {
    const arrows = createSequenceMatcher(PRESETS.arrows)
    expectMatch(type(arrows, ['ArrowLeft']), 'left')
    expectMatch(type(arrows, ['ArrowUp']), 'up')
    expectMatch(type(arrows, ['Tab']), 'next')
    expectMatch(type(arrows, ['S-Tab']), 'prev')
    expectMatch(type(arrows, ['Home']), 'rowStart')
    expectMatch(type(arrows, ['End']), 'rowEnd')
    expectMatch(type(arrows, ['Enter']), 'edit')
    expectMatch(type(arrows, ['Escape']), 'cancel')
    expectMatch(type(arrows, ['[']), 'prevLayer')
    expectMatch(type(arrows, [']']), 'nextLayer')
    expectMatch(type(arrows, ['Meta-z']), 'undo')
    expectMatch(type(arrows, ['C-z']), 'undo')
    expectMatch(type(arrows, ['Meta-S-z']), 'redo')
    expectMatch(type(arrows, ['C-S-z']), 'redo')
  })

  it('every preset action has a binding somewhere in arrows, vim or emacs or is deliberately empty', () => {
    const bound = new Set<Action>()
    for (const preset of Object.values(PRESETS)) {
      for (const action of ACTIONS) if (preset[action].length > 0) bound.add(action)
    }
    expect([...bound].sort()).toEqual([...ACTIONS].sort())
  })

  it('first sequence in ACTIONS order wins when two actions share a sequence', () => {
    const matcher = createSequenceMatcher({ prev: ['x'], next: ['x'] })
    expectMatch(type(matcher, ['x']), 'next')
  })
})

describe('resolving schemes', () => {
  it('custom overrides apply only to the custom scheme', () => {
    const custom = { left: ['x'] }
    expect(resolveBindings('custom', custom, { arrowsAlwaysOn: false }).left).toEqual(['x'])
    expect(resolveBindings('vim', custom, { arrowsAlwaysOn: false }).left).toEqual(['h'])
  })

  it('arrowsAlwaysOn adds arrow keys to movement actions in every non-arrows scheme', () => {
    expect(resolveBindings('vim', {}, { arrowsAlwaysOn: true }).down).toEqual(['j', 'ArrowDown'])
    expect(resolveBindings('vim', {}, { arrowsAlwaysOn: false }).down).toEqual(['j'])
    expect(resolveBindings('arrows', {}, { arrowsAlwaysOn: true }).down).toEqual(['ArrowDown'])
  })

  it('custom with no overrides matches the arrows preset', () => {
    expect(resolveBindings('custom', {}, { arrowsAlwaysOn: false })).toEqual(PRESETS.arrows)
  })
})

describe('keyboard guards', () => {
  const doc = (active: unknown, dialog: unknown = null) =>
    ({ activeElement: active, querySelector: () => dialog }) as unknown as Document
  const keydown = (target: unknown) =>
    ({ key: 'j', target, defaultPrevented: false, isComposing: false }) as unknown as KeyboardEvent

  it('ignores keys typed into inputs, textareas and contenteditable regions', () => {
    expect(shouldHandleKeydown(keydown({ tagName: 'INPUT' }), doc(null))).toBe(false)
    expect(shouldHandleKeydown(keydown({ tagName: 'TEXTAREA' }), doc(null))).toBe(false)
    expect(shouldHandleKeydown(keydown({ tagName: 'DIV', isContentEditable: true }), doc(null))).toBe(false)
  })

  it('handles keys on the board and ignores them while a dialog holds focus', () => {
    expect(shouldHandleKeydown(keydown({ tagName: 'DIV' }), doc(null))).toBe(true)
    expect(shouldHandleKeydown(keydown({ tagName: 'DIV' }), doc(null, {}))).toBe(false)
    const insideDialog = { closest: () => ({}) }
    expect(shouldHandleKeydown(keydown({ tagName: 'BUTTON' }), doc(insideDialog))).toBe(false)
  })
})
