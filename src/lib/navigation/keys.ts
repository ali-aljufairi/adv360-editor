/**
 * Key tokens are the strings the matcher compares. A token is an optional modifier prefix
 * (C- control, M- alt/option, Meta- command/super, S- shift) followed by a character or a
 * named key, for example `g`, `G`, `$`, `C-n`, `M-<`, `Meta-S-z`, `S-Tab`, `ArrowLeft`.
 */

/** The subset of KeyboardEvent that token normalisation reads. */
export interface KeyLike {
  key: string
  code?: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

const MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'OS',
  'AltGraph',
  'CapsLock',
  'Dead',
  'Unidentified',
])

/** Named keys that may appear inside a sequence, longest first so prefixes do not win. */
const NAMED_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Backspace',
  'PageDown',
  'PageUp',
  'Escape',
  'Delete',
  'Enter',
  'Space',
  'Home',
  'End',
  'Tab',
] as const

/** Single-character aliases that the parser accepts for named keys. */
const NAMED_ALIASES: Record<string, string> = { Esc: 'Escape', Return: 'Enter', ' ': 'Space' }

/** Unshifted characters for physical keys, used when the event key is not ASCII. */
const CODE_CHARACTERS: Record<string, string> = {
  Slash: '/',
  Minus: '-',
  Equal: '=',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
}

/** Modifier prefixes in canonical order. */
const MODIFIER_ORDER = ['C', 'M', 'Meta', 'S'] as const

/** Base key for a physical key code, lower-case for letters. */
function baseFromCode(code: string | undefined): string | undefined {
  if (!code) return undefined
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]!.toLowerCase()
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return digit[1]
  return CODE_CHARACTERS[code]
}

/**
 * Turns a keyboard event into a canonical token, or null for modifier-only presses.
 * Shift is written as `S-` only for named keys and for combinations with C, M or Meta;
 * a printable character already carries its shift state (`?`, `G`).
 */
export function eventToToken(event: KeyLike): string | null {
  const key = event.key
  if (!key || MODIFIER_KEYS.has(key)) return null
  const combo = event.ctrlKey || event.altKey || event.metaKey
  const named = key.length > 1 || key === ' '
  let base = key === ' ' ? 'Space' : key
  let shift = named ? event.shiftKey : false

  if (!named && combo) {
    const fromCode = baseFromCode(event.code)
    if (/^[a-zA-Z]$/.test(key)) {
      // Letters use the physical key so Option/Alt (which rewrites the glyph) still matches.
      base = fromCode ?? key.toLowerCase()
      shift = event.shiftKey
    } else if (/^[\x21-\x7e]$/.test(key)) {
      // A printable symbol already carries its shift state, so Ctrl+Shift+/ is `C-?`.
      base = key
    } else if (fromCode) {
      base = fromCode
      shift = event.shiftKey
    }
  }

  const prefix = [
    event.ctrlKey ? 'C-' : '',
    event.altKey ? 'M-' : '',
    event.metaKey ? 'Meta-' : '',
    shift ? 'S-' : '',
  ].join('')
  return prefix + base
}

/** Splits `Meta-S-z` into its modifier parts and base key, or returns null if unparseable. */
function splitToken(token: string): { mods: Set<string>; base: string } | null {
  const mods = new Set<string>()
  let rest = token
  let matched = true
  while (matched) {
    matched = false
    for (const mod of ['Meta-', 'C-', 'M-', 'S-'] as const) {
      if (rest.startsWith(mod) && rest.length > mod.length) {
        mods.add(mod.slice(0, -1))
        rest = rest.slice(mod.length)
        matched = true
        break
      }
    }
  }
  if (rest.length === 0) return null
  return { mods, base: rest }
}

/** Rebuilds a token with modifiers in canonical order and aliases resolved. */
function canonicalToken(mods: Set<string>, base: string): string {
  const named = NAMED_ALIASES[base] ?? base
  const prefix = MODIFIER_ORDER.filter((mod) => mods.has(mod))
    .map((mod) => `${mod}-`)
    .join('')
  return prefix + named
}

/**
 * Parses a sequence string into canonical tokens.
 * Space separates tokens (`C-x C-s`); without spaces, named keys and modifier prefixes are
 * recognised and anything else is one character per token (`gg` → `g`, `g`).
 * Returns an empty array for an empty or unparseable string.
 */
export function parseSequence(sequence: string): string[] {
  const tokens: string[] = []
  for (const part of sequence.trim().split(/\s+/)) {
    if (part.length === 0) continue
    let rest = part
    while (rest.length > 0) {
      const modMatch = /^((?:Meta-|C-|M-|S-)+)(?=.)/.exec(rest)
      const modText = modMatch ? modMatch[1]! : ''
      const after = rest.slice(modText.length)
      const named = NAMED_KEYS.find((name) => after.startsWith(name))
      const base = named ?? after.charAt(0)
      if (!base) break
      const parsed = splitToken(modText + base)
      if (!parsed) break
      tokens.push(canonicalToken(parsed.mods, parsed.base))
      rest = after.slice(base.length)
    }
  }
  return tokens
}

/** Canonical display-and-storage form: tokens with no spaces when all are single characters. */
export function formatSequence(tokens: readonly string[]): string {
  const plain = tokens.every((token) => token.length === 1)
  return tokens.join(plain ? '' : ' ')
}

/** A short human label for a single token, e.g. `Ctrl+N`, `↑`, `Esc`. */
export function describeToken(token: string): string {
  const arrows: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
  }
  const names: Record<string, string> = { Escape: 'Esc', Space: 'Space', Meta: '⌘' }
  const parts = token.split('-')
  const base = parts.pop() ?? ''
  const mods = parts.map((mod) => {
    if (mod === 'C') return 'Ctrl'
    if (mod === 'M') return 'Alt'
    if (mod === 'Meta') return '⌘'
    return '⇧'
  })
  const label = arrows[base] ?? names[base] ?? base
  return [...mods, label].join('+')
}

/** Human label for a whole sequence, e.g. `gg`, `Ctrl+X Ctrl+S`. */
export function describeSequence(sequence: string): string {
  return parseSequence(sequence).map(describeToken).join(' ')
}

/** Keys that must never be intercepted by the board, even outside text fields. */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false
  const element = target as HTMLElement
  if (element.isContentEditable) return true
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return element.closest?.('[contenteditable]:not([contenteditable="false"])') != null
}

/** True while a modal dialog holds focus, so board keys must stay out of the way. */
export function isDialogActive(doc: Document | undefined): boolean {
  if (!doc) return false
  const active = doc.activeElement as HTMLElement | null
  if (active?.closest?.('dialog[open], [role="dialog"], [role="alertdialog"]')) return true
  return doc.querySelector('dialog[open], [role="dialog"][aria-modal="true"]') !== null
}

/** Decides whether the board may act on a keydown event. */
export function shouldHandleKeydown(event: KeyboardEvent, doc?: Document): boolean {
  if (event.defaultPrevented || event.isComposing) return false
  if (isEditableElement(event.target)) return false
  return !isDialogActive(doc ?? (typeof document === 'undefined' ? undefined : document))
}
