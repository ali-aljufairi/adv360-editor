/** Visual category of a keycap legend, used for styling and grouping. */
export type LegendKind =
  | 'key'
  | 'mod'
  | 'layer'
  | 'holdtap'
  | 'macro'
  | 'bluetooth'
  | 'media'
  | 'mouse'
  | 'system'
  | 'trans'
  | 'none'
  | 'raw'

/** The text printed on a keycap: a main legend plus an optional small secondary legend. */
export interface Legend {
  /** Main legend. Empty for &none. */
  primary: string
  /** Small legend: hold action, layer name, or verb such as hold/toggle. */
  secondary?: string
  /** Category of the binding this legend describes. */
  kind: LegendKind
}

/** Optional keymap context that improves legends (layer names, macro labels). */
export interface DescribeContext {
  /** Layer names indexed by layer number, used for &mo/&tog/&to/&sl/&lt. */
  layerNames?: string[]
  /** Macro behavior name (without the leading &) mapped to its display label. */
  macros?: Record<string, string>
}

/** Minimal shape of a binding, compatible with the zmk Binding type. */
export interface BindingLike {
  /** Behavior reference such as `&kp`. */
  behavior: string
  /** Positional parameters as written in the keymap. */
  params: string[]
}

interface Named {
  label: string
  kind: LegendKind
}

const MOD_GLYPH: Record<string, string> = {
  SHIFT: '⇧',
  SHFT: '⇧',
  S: '⇧',
  CTRL: '⌃',
  CONTROL: '⌃',
  CTL: '⌃',
  C: '⌃',
  ALT: '⌥',
  A: '⌥',
  GUI: '⌘',
  CMD: '⌘',
  G: '⌘',
}

const MOD_FUNCTION = /^([LR])(SHIFT|SHFT|CONTROL|CTRL|CTL|GUI|CMD|ALT|S|C|A|G)\((.+)\)$/

/** Bare modifier keycode: its label and which side (L/R) it sits on. */
interface ModKey {
  label: string
  side: 'L' | 'R'
}

const MOD_KEYS: Record<string, ModKey> = Object.create(null)
const NAMED: Record<string, Named> = Object.create(null)

/** Registers several ZMK aliases that share one legend. */
function alias(label: string, kind: LegendKind, names: string[]): void {
  for (const name of names) NAMED[name] = { label, kind }
}

/** Registers bare modifier keycodes (LSHFT, RGUI, ...) that share one label and side. */
function modKey(label: string, side: 'L' | 'R', names: string[]): void {
  for (const name of names) MOD_KEYS[name] = { label, side }
}

alias('Space', 'key', ['SPACE'])
alias('Tab', 'key', ['TAB'])
alias('Enter', 'key', ['ENTER', 'RET', 'RETURN'])
alias('Escape', 'key', ['ESC', 'ESCAPE'])
alias('Backspace', 'key', ['BSPC', 'BACKSPACE'])
alias('Delete', 'key', ['DEL', 'DELETE'])
alias('Insert', 'key', ['INS', 'INSERT'])
alias('Home', 'key', ['HOME'])
alias('End', 'key', ['END'])
alias('PageUp', 'key', ['PG_UP', 'PAGE_UP'])
alias('PageDown', 'key', ['PG_DN', 'PAGE_DOWN'])
alias('CapsLock', 'key', ['CAPS', 'CAPSLOCK'])
alias('PrintScreen', 'key', ['PSCRN', 'PRINTSCREEN'])
alias('ScrollLock', 'key', ['SLCK', 'SCROLLLOCK'])
alias('Pause', 'key', ['PAUSE_BREAK', 'PAUSE'])
alias('NumLock', 'key', ['NUMLOCK', 'NLCK', 'KP_NUMLOCK'])
alias('Menu', 'key', ['K_APPLICATION', 'K_APP', 'APPLICATION', 'K_MENU'])
alias('Kana', 'key', ['INT_KATAKANAHIRAGANA', 'INTERNATIONAL_2', 'INT2', 'LANG_KANA'])
alias('Eisu', 'key', ['LANG2', 'LANGUAGE_2', 'LANG_EISU'])
alias('Henkan', 'key', ['INT_HENKAN', 'INTERNATIONAL_4', 'INT4'])
alias('Muhenkan', 'key', ['INT_MUHENKAN', 'INTERNATIONAL_5', 'INT5'])
alias('Yen', 'key', ['INT_YEN', 'INTERNATIONAL_3', 'INT3'])
alias('Ro', 'key', ['INT_RO', 'INTERNATIONAL_1', 'INT1'])
alias('←', 'key', ['LEFT', 'LEFT_ARROW'])
alias('→', 'key', ['RIGHT', 'RIGHT_ARROW'])
alias('↑', 'key', ['UP', 'UP_ARROW'])
alias('↓', 'key', ['DOWN', 'DOWN_ARROW'])
alias('!', 'key', ['EXCLAMATION'])
alias('@', 'key', ['AT', 'AT_SIGN'])
alias('#', 'key', ['HASH', 'POUND'])
alias('$', 'key', ['DOLLAR'])
alias('%', 'key', ['PERCENT'])
alias('^', 'key', ['CARET'])
alias('&', 'key', ['AMPERSAND', 'AMPS'])
alias('*', 'key', ['ASTERISK', 'STAR'])
alias('(', 'key', ['LEFT_PARENTHESIS', 'LPAR'])
alias(')', 'key', ['RIGHT_PARENTHESIS', 'RPAR'])
alias('-', 'key', ['MINUS'])
alias('_', 'key', ['UNDERSCORE'])
alias('=', 'key', ['EQUAL'])
alias('+', 'key', ['PLUS'])
alias('[', 'key', ['LEFT_BRACKET', 'LBKT'])
alias(']', 'key', ['RIGHT_BRACKET', 'RBKT'])
alias('{', 'key', ['LEFT_BRACE', 'LBRC'])
alias('}', 'key', ['RIGHT_BRACE', 'RBRC'])
alias('\\', 'key', ['BACKSLASH', 'BSLH'])
alias('|', 'key', ['PIPE'])
alias(';', 'key', ['SEMICOLON', 'SEMI'])
alias(':', 'key', ['COLON'])
alias("'", 'key', ['APOSTROPHE', 'SQT', 'SINGLE_QUOTE'])
alias('"', 'key', ['DOUBLE_QUOTES', 'DQT'])
alias('`', 'key', ['GRAVE', 'BACKTICK'])
alias('~', 'key', ['TILDE'])
alias(',', 'key', ['COMMA'])
alias('.', 'key', ['DOT', 'PERIOD'])
alias('/', 'key', ['SLASH', 'FSLH'])
alias('?', 'key', ['QUESTION'])
alias('<', 'key', ['LESS_THAN'])
alias('>', 'key', ['GREATER_THAN'])
alias('Vol+', 'media', ['C_VOL_UP', 'C_VOLUME_UP'])
alias('Vol-', 'media', ['C_VOL_DN', 'C_VOL_DOWN', 'C_VOLUME_DOWN'])
alias('Mute', 'media', ['C_MUTE'])
alias('Play/Pause', 'media', ['C_PLAY_PAUSE', 'C_PP'])
alias('Next', 'media', ['C_NEXT', 'C_NEXT_TRACK'])
alias('Prev', 'media', ['C_PREV', 'C_PREVIOUS', 'C_PREV_TRACK'])
alias('Stop', 'media', ['C_STOP'])
alias('Bri+', 'media', ['C_BRI_UP', 'C_BRIGHTNESS_UP'])
alias('Bri-', 'media', ['C_BRI_DN', 'C_BRIGHTNESS_DOWN'])
alias('Menu', 'system', ['C_MENU'])
alias('Screensaver', 'system', ['K_SCREENSAVER'])
alias('Sleep', 'system', ['K_SLEEP'])
alias('Power', 'system', ['K_POWER'])

modKey('Shift', 'L', ['LSHFT', 'LSHIFT', 'LEFT_SHIFT'])
modKey('Shift', 'R', ['RSHFT', 'RSHIFT', 'RIGHT_SHIFT'])
modKey('Ctrl', 'L', ['LCTRL', 'LCTL', 'LCONTROL', 'LEFT_CONTROL'])
modKey('Ctrl', 'R', ['RCTRL', 'RCTL', 'RCONTROL', 'RIGHT_CONTROL'])
modKey('Alt', 'L', ['LALT', 'LEFT_ALT'])
modKey('Alt', 'R', ['RALT', 'RIGHT_ALT'])
modKey('Cmd', 'L', ['LGUI', 'LCMD', 'LWIN', 'LEFT_GUI', 'LEFT_COMMAND', 'LEFT_WIN'])
modKey('Cmd', 'R', ['RGUI', 'RCMD', 'RWIN', 'RIGHT_GUI', 'RIGHT_COMMAND', 'RIGHT_WIN'])

const LAYER_VERB: Record<string, string> = {
  mo: 'hold',
  tog: 'toggle',
  to: 'switch',
  sl: 'once',
}
const HOLD_TAPS = new Set(['mt', 'lt', 'tpf', 'hm'])

const BT_LABELS: Record<string, string> = {
  BT_CLR: 'BT clear',
  BT_CLR_ALL: 'BT clear all',
  BT_NXT: 'BT next',
  BT_PRV: 'BT prev',
}

const RAW = (text: string): Legend => ({ primary: text, kind: 'raw' })

/** Returns the glyph-prefixed legend for a modifier-wrapped keycode, or null. */
function describeModFunction(token: string): Legend | null {
  const match = MOD_FUNCTION.exec(token)
  if (!match) return null
  const [, , suffix = '', inner = ''] = match
  const glyph = MOD_GLYPH[suffix]
  if (!glyph) return null
  const innerLegend = describeKeycode(inner)
  if (innerLegend.kind === 'raw') return RAW(token)
  return { primary: `${glyph}${innerLegend.primary}`, kind: 'mod' }
}

/** Describes a single ZMK keycode token such as `A`, `LS(A)` or `KP_N1`. */
export function describeKeycode(token: string): Legend {
  if (token === '') return { primary: '', kind: 'none' }

  const modFunction = describeModFunction(token)
  if (modFunction) return modFunction

  const modKeyEntry = MOD_KEYS[token]
  if (modKeyEntry) {
    return { primary: modKeyEntry.label, secondary: modKeyEntry.side, kind: 'mod' }
  }

  const named = NAMED[token]
  if (named) return { primary: named.label, kind: named.kind }

  if (/^[A-Z]$/.test(token)) return { primary: token, kind: 'key' }
  const digit = /^(?:N|NUMBER_)?(\d)$/.exec(token)
  if (digit) return { primary: digit[1] ?? '', kind: 'key' }

  const fkey = /^F(\d{1,2})$/.exec(token)
  if (fkey && Number(fkey[1]) >= 1 && Number(fkey[1]) <= 24) {
    return { primary: `F${fkey[1]}`, kind: 'key' }
  }

  const keypad = /^KP_(.+)$/.exec(token)
  if (keypad) {
    const inner = describeKeycode(keypad[1] ?? '')
    if (inner.kind === 'key' || inner.kind === 'none') {
      return { primary: `Keypad ${inner.primary}`.trim(), kind: 'key' }
    }
    return RAW(token)
  }

  const mouse = /^MB([1-5])$/.exec(token)
  if (mouse) return { primary: `M${mouse[1]}`, kind: 'mouse' }

  return RAW(token)
}

/** Resolves a layer reference (index or name) to a display name. */
function layerName(token: string, ctx: DescribeContext): string {
  const raw = /^\d+$/.test(token) ? (ctx.layerNames?.[Number(token)] ?? `L${token}`) : token
  return prettyLayerName(raw)
}

/** Turns a devicetree layer node name such as `default_layer` into "Default". */
function prettyLayerName(raw: string): string {
  const words = raw
    .replace(/_layer$/i, '')
    .split(/[_\s-]+/)
    .filter(Boolean)
  if (words.length === 0) return raw
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/** Returns the legend shown on a keycap for a keymap binding. */
export function describeBinding(binding: BindingLike, ctx: DescribeContext = {}): Legend {
  const name = binding.behavior.replace(/^&/, '')
  const [first = '', second = ''] = binding.params
  const macroLabel = ctx.macros && Object.hasOwn(ctx.macros, name) ? ctx.macros[name] : undefined
  if (macroLabel !== undefined) return { primary: macroLabel, kind: 'macro' }

  if (name === 'kp') return describeKeycode(first)
  if (name === 'trans') return { primary: '▽', kind: 'trans' }
  if (name === 'none') return { primary: '', kind: 'none' }

  if (Object.hasOwn(LAYER_VERB, name)) {
    return { primary: layerName(first, ctx), secondary: LAYER_VERB[name], kind: 'layer' }
  }

  if (HOLD_TAPS.has(name)) {
    const tap = describeKeycode(second)
    const hold = name === 'lt' ? layerName(first, ctx) : describeKeycode(first).primary
    return { primary: tap.primary, secondary: hold, kind: 'holdtap' }
  }

  if (name === 'bt') {
    if (first === 'BT_SEL') return { primary: `BT ${second}`.trim(), kind: 'bluetooth' }
    if (Object.hasOwn(BT_LABELS, first)) {
      return { primary: BT_LABELS[first] ?? '', kind: 'bluetooth' }
    }
    return RAW(binding.params.join(' '))
  }

  if (name === 'mkp') {
    const mouse = describeKeycode(first)
    return mouse.kind === 'mouse' ? mouse : RAW(first)
  }

  if (name === 'sk') return describeKeycode(first)

  return RAW([binding.behavior, ...binding.params].join(' ').trim())
}
