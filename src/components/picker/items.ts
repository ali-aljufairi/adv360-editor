import {
  ACTIONS,
  KEYS,
  LAYER_ACTIONS,
  resolveKeyCode,
  type GroupId,
} from '../../lib/keycodes/catalog'
import {
  formatBinding,
  MOD_CHIPS,
  unwrapMods,
  type BindingValue,
  type Choice,
} from '../../lib/keycodes/binding'
import type { SearchFields } from '../../lib/keycodes/fuzzy'

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
  /** Mono text shown on the right: a key code, or a full binding for actions. */
  code: string
  glyph?: string
  aliases: readonly string[]
  keywords: readonly string[]
  /** Completes a single-slot binding. */
  choice?: Choice
  /** Starts a two-slot (tap + hold) binding; the hold slot takes a key or a layer. */
  dual?: { behavior: string; hold: 'key' | 'layer' }
}

/**
 * Builds every row the picker can show for a keymap.
 * @param layers - Layers in the keymap.
 * @param macros - Macros defined by the model.
 * @param holdTaps - Hold-tap behaviors defined by the model.
 * @returns Items in catalog order, with layers, macros and hold-taps after the static rows.
 */
export function buildItems(
  layers: readonly PickerLayer[],
  macros: readonly PickerMacro[],
  holdTaps: readonly PickerHoldTap[],
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
      choice: { kind: 'key', code: entry.code },
    })
  }
  for (const entry of ACTIONS) {
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
export function keycapParts(value: BindingValue): KeycapParts {
  const mods = (param: string): { mods: string[]; main: string } => {
    const unwrapped = unwrapMods(param)
    const glyphs = unwrapped.mods.map((mod) => {
      const chip = MOD_CHIPS.find((candidate) => candidate.left === mod || candidate.right === mod)
      return chip?.glyph ?? mod
    })
    const def = resolveKeyCode(unwrapped.code)
    return { mods: glyphs, main: def ? (def.glyph ?? def.label) : unwrapped.code }
  }
  if (value.behavior === '&kp' && value.params.length === 1) {
    return mods(value.params[0])
  }
  if ((value.behavior === '&mt' || value.behavior === '&lt') && value.params.length === 2) {
    const tap = mods(value.params[1])
    const hold = value.behavior === '&lt' ? `Layer ${value.params[0]}` : mods(value.params[0]).main
    return { ...tap, detail: `hold ${hold}` }
  }
  return { mods: [], main: value.behavior, detail: value.params.join(' ') || undefined }
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
