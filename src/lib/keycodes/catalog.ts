import generated from './zmk-keys.generated.json'

/** Picker section a catalog entry is listed under. */
export type GroupId =
  | 'keys'
  | 'navigation'
  | 'editing'
  | 'modifiers'
  | 'keypad'
  | 'media'
  | 'international'
  | 'mouse'
  | 'lighting'
  | 'bluetooth'
  | 'output'
  | 'system'
  | 'behaviors'
  | 'recipes'
  | 'layers'
  | 'macros'
  | 'dual'

/** Display order and heading for each group. */
export const GROUPS: readonly { id: GroupId; label: string }[] = [
  { id: 'keys', label: 'Keys' },
  { id: 'modifiers', label: 'Modifiers' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'editing', label: 'Editing' },
  { id: 'layers', label: 'Layers' },
  { id: 'dual', label: 'Dual role' },
  { id: 'macros', label: 'Macros' },
  { id: 'recipes', label: 'Shortcuts' },
  { id: 'keypad', label: 'Keypad' },
  { id: 'media', label: 'Media' },
  { id: 'bluetooth', label: 'Bluetooth' },
  { id: 'output', label: 'Output' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'mouse', label: 'Mouse' },
  { id: 'system', label: 'System' },
  { id: 'international', label: 'International' },
  { id: 'behaviors', label: 'Behaviors' },
]

/** A single key code that is sent with `&kp`. */
export interface KeyDef {
  kind: 'key'
  /** Canonical ZMK name, as written into the keymap. */
  code: string
  /** Other accepted ZMK names that resolve to this key. */
  aliases: readonly string[]
  /** Human label shown in the picker. */
  label: string
  /** Extra search terms that are not aliases. */
  keywords: readonly string[]
  group: GroupId
  /** Glyph shown in the keycap preview. */
  glyph?: string
}

/** A fixed, non-key behavior binding such as `&bt BT_SEL 0`. */
export interface ActionDef {
  kind: 'action'
  id: string
  label: string
  behavior: string
  params: readonly string[]
  keywords: readonly string[]
  group: GroupId
  glyph?: string
  /** Set on dual-role behaviors that need a second slot; the slot kind to ask for. */
  hold?: 'key' | 'layer'
  /**
   * Set on platform shortcuts. The binding wraps `key` in the platform's command modifier (LG on
   * mac, LC elsewhere), plus LS when `shift` is set. `params` is unused for these entries.
   */
  shortcut?: { readonly key: string; readonly shift: boolean }
}

/** Maps a key's HID usage id (as a string) to the spelling the user's keymap already uses. */
export type PreferredNames = Readonly<Record<string, string>>

/** A layer behavior template; the layer index is appended per layer. */
export interface LayerActionDef {
  id: string
  label: string
  behavior: string
  keywords: readonly string[]
}

const GLYPH_BACKSPACE = '⌫'
const GLYPH_ENTER = '⏎'
const GLYPH_ESC = '⎋'
const GLYPH_TAB = '⇥'
const GLYPH_SPACE = '␣'
const GLYPH_DELETE = '⌦'
const GLYPH_CTRL = '⌃'
const GLYPH_ALT = '⌥'
const GLYPH_SHIFT = '⇧'
const GLYPH_GUI = '⌘'

/** Builds a key definition with the common defaults filled in. */
function key(
  code: string,
  aliases: readonly string[],
  label: string,
  group: GroupId,
  keywords: readonly string[] = [],
  glyph?: string,
): KeyDef {
  return { kind: 'key', code, aliases, label, keywords, group, glyph }
}

/** Builds a fixed-binding action definition. */
function action(
  id: string,
  label: string,
  behavior: string,
  params: readonly string[],
  group: GroupId,
  keywords: readonly string[] = [],
  glyph?: string,
  hold?: 'key' | 'layer',
): ActionDef {
  return { kind: 'action', id, label, behavior, params, keywords, group, glyph, hold }
}

const LETTERS: KeyDef[] = Array.from({ length: 26 }, (_, index) => {
  const letter = String.fromCharCode(65 + index)
  return key(letter, [], letter, 'keys', ['letter'])
})

const DIGITS: KeyDef[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) =>
  key(`N${digit}`, [`NUMBER_${digit}`], digit, 'keys', ['number', 'digit']),
)

const FUNCTION_KEYS: KeyDef[] = Array.from({ length: 24 }, (_, index) => {
  const name = `F${index + 1}`
  return key(name, [], name, 'keys', ['function'])
})

const SYMBOLS: KeyDef[] = [
  key('MINUS', [], '-', 'keys', ['hyphen', 'dash', 'minus']),
  key('EQUAL', ['EQL'], '=', 'keys', ['equals']),
  key('LBKT', ['LEFT_BRACKET', 'LBRC'], '[', 'keys', ['bracket', 'open bracket']),
  key('RBKT', ['RIGHT_BRACKET', 'RBRC'], ']', 'keys', ['bracket', 'close bracket']),
  key('BSLH', ['BACKSLASH'], '\\', 'keys', ['backslash']),
  key('SEMI', ['SEMICOLON'], ';', 'keys', ['semicolon']),
  key('SQT', ['SINGLE_QUOTE', 'APOS', 'APOSTROPHE'], "'", 'keys', ['quote', 'apostrophe']),
  key('GRAVE', [], '`', 'keys', ['backtick', 'tilde']),
  key('COMMA', [], ',', 'keys', ['comma']),
  key('DOT', ['PERIOD'], '.', 'keys', ['period', 'full stop']),
  key('SLASH', ['FSLH'], '/', 'keys', ['forward slash']),
  key('NUHS', ['NON_US_HASH'], '#', 'keys', ['non-us hash']),
  key('NUBS', ['NON_US_BACKSLASH'], '\\', 'keys', ['non-us backslash', 'iso']),
]

const MODIFIER_KEYS: KeyDef[] = [
  key('LCTRL', ['LCTL', 'LEFT_CONTROL'], 'Left Ctrl', 'modifiers', ['control'], GLYPH_CTRL),
  key('LSHIFT', ['LSHFT', 'LEFT_SHIFT'], 'Left Shift', 'modifiers', ['shift'], GLYPH_SHIFT),
  key('LALT', ['LEFT_ALT'], 'Left Alt', 'modifiers', ['option', 'opt'], GLYPH_ALT),
  key('LGUI', ['LEFT_GUI', 'LCMD', 'LWIN'], 'Left Cmd', 'modifiers', ['command', 'super', 'win'], GLYPH_GUI),
  key('RCTRL', ['RCTL', 'RIGHT_CONTROL'], 'Right Ctrl', 'modifiers', ['control'], GLYPH_CTRL),
  key('RSHIFT', ['RSHFT', 'RIGHT_SHIFT'], 'Right Shift', 'modifiers', ['shift'], GLYPH_SHIFT),
  key('RALT', ['RIGHT_ALT'], 'Right Alt', 'modifiers', ['option', 'opt', 'altgr'], GLYPH_ALT),
  key('RGUI', ['RIGHT_GUI', 'RCMD', 'RWIN'], 'Right Cmd', 'modifiers', ['command', 'super', 'win'], GLYPH_GUI),
]

const NAVIGATION_KEYS: KeyDef[] = [
  key('UP', ['UP_ARROW'], 'Up', 'navigation', ['arrow'], '↑'),
  key('DOWN', ['DOWN_ARROW'], 'Down', 'navigation', ['arrow'], '↓'),
  key('LEFT', ['LEFT_ARROW'], 'Left', 'navigation', ['arrow'], '←'),
  key('RIGHT', ['RIGHT_ARROW'], 'Right', 'navigation', ['arrow'], '→'),
  key('HOME', [], 'Home', 'navigation', ['start of line'], '⇱'),
  key('END', [], 'End', 'navigation', ['end of line'], '⇲'),
  key('PAGE_UP', ['PG_UP'], 'Page up', 'navigation', [], '⇞'),
  key('PAGE_DOWN', ['PG_DN'], 'Page down', 'navigation', [], '⇟'),
  key('SCROLLLOCK', ['SLCK'], 'Scroll lock', 'navigation', ['scroll']),
  key('PAUSE_BREAK', ['PAUS'], 'Pause', 'navigation', ['break']),
]

const EDITING_KEYS: KeyDef[] = [
  key('ENTER', ['RET', 'RETURN'], 'Enter', 'editing', ['return', 'newline'], GLYPH_ENTER),
  key('ESCAPE', ['ESC'], 'Escape', 'editing', ['cancel'], GLYPH_ESC),
  key('TAB', [], 'Tab', 'editing', ['indent'], GLYPH_TAB),
  key('SPACE', ['SPC'], 'Space', 'editing', ['blank'], GLYPH_SPACE),
  key('BACKSPACE', ['BSPC', 'BKSP'], 'Backspace', 'editing', ['delete back', 'erase'], GLYPH_BACKSPACE),
  key('DELETE', ['DEL'], 'Delete', 'editing', ['forward delete'], GLYPH_DELETE),
  key('INSERT', ['INS'], 'Insert', 'editing', []),
  key('CAPSLOCK', ['CAPS'], 'Caps lock', 'editing', ['capital']),
  key('PRINTSCREEN', ['PSCRN'], 'Print screen', 'editing', ['screenshot', 'print']),
  key('K_APPLICATION', ['K_APP'], 'Menu', 'editing', ['context menu', 'app']),
]

const KEYPAD_KEYS: KeyDef[] = [
  key('KP_NUMLOCK', ['KP_NUM'], 'Num lock', 'keypad', ['keypad']),
  key('KP_SLASH', ['KP_DIVIDE'], 'Keypad /', 'keypad', ['divide'], '/'),
  key('KP_ASTERISK', ['KP_MULTIPLY'], 'Keypad *', 'keypad', ['multiply'], '*'),
  key('KP_MINUS', [], 'Keypad -', 'keypad', ['subtract'], '-'),
  key('KP_PLUS', [], 'Keypad +', 'keypad', ['add'], '+'),
  key('KP_ENTER', [], 'Keypad Enter', 'keypad', [], GLYPH_ENTER),
  key('KP_DOT', [], 'Keypad .', 'keypad', ['decimal'], '.'),
  key('KP_EQUAL', [], 'Keypad =', 'keypad', [], '='),
  ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) =>
    key(`KP_N${digit}`, [], `Keypad ${digit}`, 'keypad', ['keypad number'], digit),
  ),
]

const MEDIA_KEYS: KeyDef[] = [
  key('C_PLAY_PAUSE', ['C_PP'], 'Play / pause', 'media', ['music', 'media'], '⏯'),
  key('C_NEXT', [], 'Next track', 'media', ['skip', 'forward'], '⏭'),
  key('C_PREVIOUS', ['C_PREV'], 'Previous track', 'media', ['back'], '⏮'),
  key('C_STOP', [], 'Stop', 'media', [], '⏹'),
  key('C_MUTE', [], 'Mute', 'media', ['sound', 'audio'], '\u{1F507}'),
  key('C_VOLUME_UP', ['C_VOL_UP'], 'Volume up', 'media', ['louder', 'sound'], '\u{1F50A}'),
  key('C_VOLUME_DOWN', ['C_VOL_DN'], 'Volume down', 'media', ['quieter', 'sound']),
  key('C_BRIGHTNESS_INC', ['C_BRI_INC'], 'Brightness up', 'media', ['screen'], '☀'),
  key('C_BRIGHTNESS_DEC', ['C_BRI_DEC'], 'Brightness down', 'media', ['screen', 'dim']),
]

const INTERNATIONAL_KEYS: KeyDef[] = [
  key('INT1', [], 'International 1 (ro)', 'international', ['jis', 'ro', 'backslash']),
  key('INT2', [], 'International 2 (kana/eisu)', 'international', ['jis', 'katakana']),
  key('INT3', [], 'International 3 (yen)', 'international', ['jis', 'yen']),
  key('INT4', [], 'International 4 (henkan)', 'international', ['jis', 'convert']),
  key('INT5', [], 'International 5 (muhenkan)', 'international', ['jis', 'non-convert']),
  key('LANG1', [], 'Kana (LANG1)', 'international', ['hangul', 'ime', 'japanese']),
  key('LANG2', [], 'Eisu (LANG2)', 'international', ['hanja', 'ime', 'japanese']),
  key('LANG3', [], 'Katakana (LANG3)', 'international', ['ime', 'japanese']),
  key('LANG4', [], 'Hiragana (LANG4)', 'international', ['ime', 'japanese']),
  key('LANG5', [], 'Zenkaku/Hankaku (LANG5)', 'international', ['ime', 'japanese', 'half width']),
]

/** Every key code the editor knows how to write with `&kp`. */
export const KEY_OVERLAY: readonly KeyDef[] = [
  ...LETTERS,
  ...DIGITS,
  ...FUNCTION_KEYS,
  ...SYMBOLS,
  ...MODIFIER_KEYS,
  ...NAVIGATION_KEYS,
  ...EDITING_KEYS,
  ...KEYPAD_KEYS,
  ...MEDIA_KEYS,
  ...INTERNATIONAL_KEYS,
]

// Prefer the established picker spelling when defined; otherwise use the shortest header
// spelling, retaining header order when lengths tie.
// All labels and search terms are indexed by usage; generated names alone define validity.
const values = generated.values as Record<string, number>
const overlayByUsage = new Map(KEY_OVERLAY.map((item) => [values[item.code], item]))
export const KEYS: readonly KeyDef[] = Object.entries(generated.groups).map(([usage, names]) => {
  const overlay = overlayByUsage.get(Number(usage))
  const code = overlay?.code ??
    names.reduce((best, name) => name.length < best.length ? name : best)
  return key(code, names.filter((name) => name !== code), overlay?.label ?? code,
    overlay?.group ?? 'keys', overlay?.keywords ?? [], overlay?.glyph)
})

const BT_PROFILES: ActionDef[] = [0, 1, 2, 3, 4].map((slot) =>
  action(
    `bt-sel-${slot}`,
    `Select profile ${slot}`,
    '&bt',
    ['BT_SEL', String(slot)],
    'bluetooth',
    ['bluetooth', 'pair', 'profile', 'bt'],
  ),
)

/** Fixed behavior bindings, one per row in the picker. */
export const ACTIONS: readonly ActionDef[] = [
  action('hold-tap', 'Hold-tap', '&mt', [], 'dual', ['tap', 'hold', 'dual role', 'mod tap'], undefined, 'key'),
  action('layer-tap', 'Layer-tap', '&lt', [], 'dual', ['tap', 'hold', 'layer tap'], undefined, 'layer'),
  ...BT_PROFILES,
  action('bt-clear', 'Clear profile', '&bt', ['BT_CLR'], 'bluetooth', ['unpair', 'forget']),
  action('bt-clear-all', 'Clear all profiles', '&bt', ['BT_CLR_ALL'], 'bluetooth', ['unpair all']),
  action('bt-next', 'Next profile', '&bt', ['BT_NXT'], 'bluetooth', ['switch']),
  action('bt-prev', 'Previous profile', '&bt', ['BT_PRV'], 'bluetooth', ['switch back']),
  action('out-usb', 'Output: USB', '&out', ['OUT_USB'], 'output', ['wired', 'cable']),
  action('out-ble', 'Output: Bluetooth', '&out', ['OUT_BLE'], 'output', ['wireless', 'ble']),
  action('out-toggle', 'Toggle USB / Bluetooth', '&out', ['OUT_TOG'], 'output', ['switch']),
  action('rgb-toggle', 'RGB on / off', '&rgb_ug', ['RGB_TOG'], 'lighting', ['underglow', 'led']),
  action('rgb-effect', 'RGB next effect', '&rgb_ug', ['RGB_EFF'], 'lighting', ['underglow', 'pattern']),
  action('rgb-hue-up', 'RGB hue up', '&rgb_ug', ['RGB_HUI'], 'lighting', ['color']),
  action('rgb-hue-down', 'RGB hue down', '&rgb_ug', ['RGB_HUD'], 'lighting', ['color']),
  action('rgb-sat-up', 'RGB saturation up', '&rgb_ug', ['RGB_SAI'], 'lighting', ['color']),
  action('rgb-sat-down', 'RGB saturation down', '&rgb_ug', ['RGB_SAD'], 'lighting', ['color']),
  action('rgb-bright-up', 'RGB brightness up', '&rgb_ug', ['RGB_BRI'], 'lighting', ['underglow']),
  action('rgb-bright-down', 'RGB brightness down', '&rgb_ug', ['RGB_BRD'], 'lighting', ['underglow']),
  action('bl-toggle', 'Backlight on / off', '&bl', ['BL_TOG'], 'lighting', ['screen', 'keyboard light']),
  action('bl-up', 'Backlight up', '&bl', ['BL_INC'], 'lighting', ['brighter']),
  action('bl-down', 'Backlight down', '&bl', ['BL_DEC'], 'lighting', ['dimmer']),
  action('mouse-left', 'Left click', '&mkp', ['LCLK'], 'mouse', ['button', 'click']),
  action('mouse-middle', 'Middle click', '&mkp', ['MCLK'], 'mouse', ['button']),
  action('mouse-right', 'Right click', '&mkp', ['RCLK'], 'mouse', ['button', 'context']),
  action('mouse-back', 'Mouse back', '&mkp', ['MB4'], 'mouse', ['browser back']),
  action('mouse-forward', 'Mouse forward', '&mkp', ['MB5'], 'mouse', ['browser forward']),
  action('scroll-up', 'Scroll up', '&msc', ['SCRL_UP'], 'mouse', ['wheel']),
  action('scroll-down', 'Scroll down', '&msc', ['SCRL_DOWN'], 'mouse', ['wheel']),
  action('scroll-left', 'Scroll left', '&msc', ['SCRL_LEFT'], 'mouse', ['wheel']),
  action('scroll-right', 'Scroll right', '&msc', ['SCRL_RIGHT'], 'mouse', ['wheel']),
  action('bootloader', 'Bootloader', '&bootloader', [], 'system', ['flash', 'dfu', 'uf2']),
  action('sys-reset', 'Reset', '&sys_reset', [], 'system', ['restart', 'reboot']),
  action('transparent', 'Transparent', '&trans', [], 'behaviors', ['pass through', 'fallthrough']),
  action('none', 'None', '&none', [], 'behaviors', ['disable', 'nothing', 'blank']),
  shortcut('copy', 'Copy', 'C', ['copy', 'clipboard', 'ctrl c']),
  shortcut('paste', 'Paste', 'V', ['paste', 'clipboard', 'ctrl v']),
  shortcut('cut', 'Cut', 'X', ['cut', 'clipboard', 'ctrl x']),
  shortcut('undo', 'Undo', 'Z', ['undo', 'ctrl z']),
  shortcut('redo', 'Redo', 'Z', ['redo', 'ctrl shift z'], true),
  shortcut('select-all', 'Select all', 'A', ['select all', 'ctrl a']),
  shortcut('save', 'Save', 'S', ['save', 'ctrl s']),
  shortcut('find', 'Find', 'F', ['find', 'search', 'ctrl f']),
]

/** Platform shortcut: `&kp` with the platform's command modifier, plus Shift when asked. */
function shortcut(
  id: string,
  label: string,
  key: string,
  keywords: readonly string[],
  shift = false,
): ActionDef {
  return {
    kind: 'action',
    id,
    label,
    behavior: '&kp',
    params: [],
    keywords,
    group: 'recipes',
    shortcut: { key, shift },
  }
}

/** Layer behaviors offered for every layer in the keymap. */
export const LAYER_ACTIONS: readonly LayerActionDef[] = [
  { id: 'mo', label: 'Momentary layer', behavior: '&mo', keywords: ['hold', 'while held'] },
  { id: 'tog', label: 'Toggle layer', behavior: '&tog', keywords: ['switch', 'on off'] },
  { id: 'to', label: 'Switch to layer', behavior: '&to', keywords: ['go to', 'only'] },
  { id: 'sl', label: 'Sticky layer', behavior: '&sl', keywords: ['one shot', 'oneshot', 'latch'] },
]

const KEY_BY_NAME = new Map<string, KeyDef>()
for (const entry of KEYS) {
  KEY_BY_NAME.set(entry.code.toUpperCase(), entry)
  for (const alias of entry.aliases) {
    KEY_BY_NAME.set(alias.toUpperCase(), entry)
  }
}

/**
 * Resolves a canonical key code or any accepted alias (case-insensitive).
 * @param name - Key name as written in a keymap, e.g. `LSHFT` or `LEFT_SHIFT`.
 * @returns The canonical key definition, or undefined when unknown.
 */
export function resolveKeyCode(name: string): KeyDef | undefined {
  return KEY_BY_NAME.get(name.trim().toUpperCase())
}

/**
 * The HID usage id a key name resolves to. Every accepted spelling shares one usage id, so this
 * is how two spellings are recognised as the same key.
 * @param name - Any accepted key spelling, e.g. `LSHFT` or `LSHIFT`.
 * @returns The usage id, or undefined when the firmware does not define the name.
 */
export function usageOf(name: string): number | undefined {
  const upper = name.trim().toUpperCase()
  return Object.prototype.hasOwnProperty.call(values, upper) ? values[upper] : undefined
}

/**
 * The spelling to write for a key: the user's own spelling of the same key when their keymap
 * already uses one, otherwise the catalog's canonical code.
 * @param code - A canonical key code, e.g. `LSHIFT`.
 * @param preferred - Usage id to spelling, as built by `collectPreferredNames`.
 * @returns The spelling to write into `&kp`.
 */
export function spellKey(code: string, preferred: PreferredNames = {}): string {
  const usage = usageOf(code)
  if (usage === undefined) return code
  const key = String(usage)
  return Object.prototype.hasOwnProperty.call(preferred, key) ? preferred[key] : code
}
