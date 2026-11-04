import {
  ACTIONS,
  KEYS,
  LAYER_ACTIONS,
  resolveKeyCode,
  type GroupId,
  type UserKeycode,
} from '../../lib/keycodes/catalog'
import {
  formatBinding,
  MOD_CHIPS,
  unwrapMods,
  type BindingValue,
  type Choice,
  type ModChip,
  type ModId,
} from '../../lib/keycodes/binding'
import type { SearchFields } from '../../lib/keycodes/fuzzy'
import { shortcutModId, type ResolvedPlatform } from '../../lib/keycodes/platform'

/** A layer as the picker needs it. */
export interface PickerLayer {
  index: number
  name: string
}

/** A macro as the picker needs it. `name` is the behavior node name, without `&`. */
export interface PickerMacro {
  label: string
  name: string
}

/** A hold-tap behavior from the model. `label` is the behavior name, without `&`. */
export interface PickerHoldTap {
  label: string
}

/** One selectable row in the picker. */
export interface PickerItem extends SearchFields {
  id: string
  group: GroupId
  label: string
  /** Mono text shown on the right: a key code, a shortcut glyph, or a full binding. */
  code: string
  glyph?: string
  aliases: readonly string[]
  keywords: readonly string[]
  weight?: number
  note?: string
  /** Completes a single-slot binding. */
  choice?: Choice
  /** Starts a two-slot (tap + hold) binding; the hold slot takes a key or a layer. */
  dual?: { behavior: string; hold: 'key' | 'layer' }
}

/** Keys shown first when the query is empty, in display order. Layer keys follow them. */
const COMMON_KEY_CODES: readonly string[] = [
  'BACKSPACE',
  'ENTER',
  'ESCAPE',
  'TAB',
  'SPACE',
  'UP',
  'DOWN',
  'LEFT',
  'RIGHT',
  'LCTRL',
  'LSHIFT',
  'LALT',
  'LGUI',
]

/**
 * Row ids shown under "Common" when the query is empty: the everyday keys, then the momentary
 * layer behavior for each layer.
 * @param layers - Layers in the keymap.
 * @returns Row ids in display order.
 */
export function commonIds(layers: readonly PickerLayer[]): string[] {
  return [
    ...COMMON_KEY_CODES.map((code) => `key:${code}`),
    ...layers.map((layer) => `layer:mo:${layer.index}`),
  ]
}

/**
 * The keycap text a shortcut shows: `⇧⌘Z` on mac, `Ctrl+Shift+Z` elsewhere.
 * @param key - The key, e.g. `C`.
 * @param shift - Whether the shortcut includes Shift.
 * @param platform - The resolved platform.
 * @returns The shortcut text for the row.
 */
export function shortcutText(key: string, shift: boolean, platform: ResolvedPlatform): string {
  if (platform === 'mac') return `${shift ? '⇧' : ''}⌘${key}`
  return `Ctrl+${shift ? 'Shift+' : ''}${key}`
}

/**
 * Builds every row the picker can show for a keymap.
 * @param layers - Layers in the keymap.
 * @param macros - Macros defined by the model.
 * @param holdTaps - Hold-tap behaviors defined by the model.
 * @param platform - Platform whose command modifier shortcuts use.
 * @returns Items in catalog order, with layers, macros and hold-taps after the static rows.
 */
export function buildItems(
  layers: readonly PickerLayer[],
  macros: readonly PickerMacro[],
  holdTaps: readonly PickerHoldTap[],
  platform: ResolvedPlatform,
  userKeycodes: readonly UserKeycode[] = [],
): PickerItem[] {
  const items: PickerItem[] = []
  for (const entry of KEYS) {
    items.push({
      id: `key:${entry.code}`,
      group: entry.group,
      label: entry.label,
      code: entry.code,
      glyph: entry.glyph,
      aliases: entry.aliases,
      keywords: entry.keywords,
      weight: entry.searchWeight,
      note: entry.note,
      choice: { kind: 'key', code: entry.code },
    })
  }
  const knownNames = new Set(
    KEYS.flatMap((entry) => [entry.code, ...entry.aliases]).map((name) => name.toUpperCase()),
  )
  for (const entry of userKeycodes) {
    if (knownNames.has(entry.name.toUpperCase())) continue
    knownNames.add(entry.name.toUpperCase())
    items.push({
      id: `key:${entry.name}`,
      group: 'international',
      label: entry.label,
      code: entry.name,
      aliases: [],
      keywords: ['user header', 'custom keycode', 'raw', entry.source],
      note: `Defined in ${entry.source}; value: ${entry.value}`,
      choice: { kind: 'key', code: entry.name },
    })
  }
  for (const entry of ACTIONS) {
    if (entry.shortcut) {
      const { key, shift } = entry.shortcut
      const command = shortcutModId(platform)
      const mods: ModId[] = shift ? [command, 'LS'] : [command]
      items.push({
        id: `action:${entry.id}`,
        group: entry.group,
        label: entry.label,
        code: shortcutText(key, shift, platform),
        aliases: [],
        keywords: entry.keywords,
        choice: { kind: 'shortcut', code: key, mods },
      })
      continue
    }
    const binding = formatBinding({ behavior: entry.behavior, params: [...entry.params] })
    items.push({
      id: `action:${entry.id}`,
      group: entry.group,
      label: entry.label,
      code: binding,
      glyph: entry.glyph,
      aliases: [],
      keywords: entry.keywords,
      choice: entry.hold
        ? undefined
        : { kind: 'action', behavior: entry.behavior, params: entry.params },
      dual: entry.hold ? { behavior: entry.behavior, hold: entry.hold } : undefined,
    })
  }
  for (const layer of layers) {
    for (const action of LAYER_ACTIONS) {
      items.push({
        id: `layer:${action.id}:${layer.index}`,
        group: 'layers',
        label: `${action.label}: ${layer.name}`,
        code: `${action.behavior} ${layer.index}`,
        aliases: [],
        keywords: [...action.keywords, 'layer', layer.name],
        choice: {
          kind: 'action',
          behavior: action.behavior,
          params: [String(layer.index)],
        },
      })
    }
  }
  for (const macro of macros) {
    items.push({
      id: `macro:${macro.name}`,
      group: 'macros',
      label: macro.label,
      code: `&${macro.name}`,
      aliases: [],
      keywords: ['macro'],
      choice: { kind: 'action', behavior: `&${macro.name}`, params: [] },
    })
  }
  for (const holdTap of holdTaps) {
    items.push({
      id: `dual:${holdTap.label}`,
      group: 'dual',
      label: holdTap.label,
      code: `&${holdTap.label}`,
      aliases: [],
      keywords: ['hold-tap', 'tap hold', 'dual role'],
      dual: { behavior: `&${holdTap.label}`, hold: 'key' },
    })
  }
  return items
}

/**
 * Rows that can fill the hold slot of a layer-tap: one per layer.
 * @param layers - Layers in the keymap.
 * @returns Layer rows that complete the hold slot with a layer choice.
 */
export function buildHoldLayerItems(layers: readonly PickerLayer[]): PickerItem[] {
  return layers.map((layer) => ({
    id: `hold-layer:${layer.index}`,
    group: 'layers',
    label: layer.name,
    code: String(layer.index),
    aliases: [],
    keywords: ['layer'],
    choice: { kind: 'layer', layer: layer.index },
  }))
}

/** What a keycap shows for a binding. */
export interface KeycapParts {
  /** Modifier glyphs, outermost first. */
  mods: string[]
  /** The main key glyph or short label, or the behavior name for non-key bindings. */
  main: string
  /** Small text under the main glyph, e.g. the hold action in a hold-tap. */
  detail?: string
}

/**
 * Describes a binding as keycap parts for the preview.
 * @param value - The binding to show.
 * @returns Glyphs and text for a keycap.
 */
export function keycapParts(
  value: BindingValue,
  userKeycodes: readonly UserKeycode[] = [],
): KeycapParts {
  const mods = (param: string): { mods: string[]; main: string } => {
    const unwrapped = unwrapMods(param)
    const glyphs = unwrapped.mods.map((mod) => {
      const chip = MOD_CHIPS.find((candidate) => candidate.left === mod || candidate.right === mod)
      return chip?.glyph ?? mod
    })
    const def = resolveKeyCode(unwrapped.code)
    const userKey = userKeycodes.find(
      (entry) => entry.name.toUpperCase() === unwrapped.code.toUpperCase(),
    )
    return {
      mods: glyphs,
      main: def ? (def.glyph ?? def.label) : (userKey?.label ?? unwrapped.code),
    }
  }
  if (value.behavior === '&kp' && value.params.length === 1) {
    return mods(value.params[0])
  }
  if ((value.behavior === '&mt' || value.behavior === '&lt') && value.params.length === 2) {
    const tap = mods(value.params[1])
    const hold = value.behavior === '&lt' ? `Layer ${value.params[0]}` : mods(value.params[0]).main
    return { ...tap, detail: `hold ${hold}` }
  }
  const action =
    ACTIONS.find(
      (entry) =>
        entry.behavior === value.behavior && entry.params.join(' ') === value.params.join(' '),
    ) ??
    (value.params.length === 0
      ? ACTIONS.find((entry) => entry.behavior === value.behavior)
      : undefined)
  const layerAction = LAYER_ACTIONS.find((entry) => entry.behavior === value.behavior)
  const dynamicLabel =
    value.behavior === '&sk' && value.params[0]
      ? `Sticky ${resolveKeyCode(value.params[0])?.label ?? value.params[0]}`
      : value.behavior === '&kt' && value.params[0]
        ? `Toggle ${resolveKeyCode(value.params[0])?.label ?? value.params[0]}`
        : undefined
  return {
    mods: [],
    main: dynamicLabel ?? action?.label ?? layerAction?.label ?? value.behavior,
    detail: layerAction
      ? value.params.join(' ')
      : action?.params.join(' ') === value.params.join(' ')
        ? undefined
        : value.params.join(' ') || undefined,
  }
}

/** Spoken modifier names per family and platform, e.g. `Control` or `Ctrl`. */
const MOD_NAMES: Record<ResolvedPlatform, Record<ModChip['family'], string>> = {
  mac: { C: 'Control', A: 'Option', S: 'Shift', G: 'Command' },
  windows: { C: 'Ctrl', A: 'Alt', S: 'Shift', G: 'Win' },
  linux: { C: 'Ctrl', A: 'Alt', S: 'Shift', G: 'Super' },
}

/**
 * A plain-language label for a binding, e.g. `Control + Left Shift` or `Copy` for a key press.
 * @param value - The binding to describe.
 * @param platform - Platform, for modifier names.
 * @returns The label shown beside the keycap.
 */
export function describeBinding(
  value: BindingValue,
  platform: ResolvedPlatform,
  userKeycodes: readonly UserKeycode[] = [],
): string {
  const keyText = (param: string): string => {
    const unwrapped = unwrapMods(param)
    const names = unwrapped.mods.map((mod) => {
      const chip = MOD_CHIPS.find((candidate) => candidate.left === mod || candidate.right === mod)
      return chip ? MOD_NAMES[platform][chip.family] : mod
    })
    const label =
      resolveKeyCode(unwrapped.code)?.label ??
      userKeycodes.find((entry) => entry.name.toUpperCase() === unwrapped.code.toUpperCase())
        ?.label ??
      unwrapped.code
    return [...names, label].join(' + ')
  }
  const [first, second] = value.params
  if (value.behavior === '&kp' && value.params.length === 1) return keyText(first)
  if (value.behavior === '&mt' && value.params.length === 2) {
    return `${keyText(second)} (hold ${keyText(first)})`
  }
  if (value.behavior === '&lt' && value.params.length === 2) {
    return `${keyText(second)} (hold layer ${first})`
  }
  const action =
    ACTIONS.find(
      (entry) =>
        entry.behavior === value.behavior && entry.params.join(' ') === value.params.join(' '),
    ) ??
    (value.params.length === 0
      ? ACTIONS.find((entry) => entry.behavior === value.behavior)
      : undefined)
  const layerAction = LAYER_ACTIONS.find((entry) => entry.behavior === value.behavior)
  if (layerAction) return `${layerAction.label} ${value.params.join(' ')}`.trim()
  if (action) return action.label
  return formatBinding(value)
}

const RECENT_KEY = 'adv360.picker.recent'
const RECENT_LIMIT = 6

/**
 * Reads recently picked row ids. Storage can be unavailable (private windows), so failures
 * return an empty list.
 * @returns Row ids, most recent first.
 */
export function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * Pushes a picked row id to the front of the recent list. Storage failures are ignored.
 * @param id - The picked row id.
 * @param current - The recent list before the pick.
 * @returns The updated recent list.
 */
export function pushRecent(id: string, current: readonly string[]): string[] {
  const next = [id, ...current.filter((existing) => existing !== id)].slice(0, RECENT_LIMIT)
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Recents are a convenience; the picker works without them.
  }
  return next
}
