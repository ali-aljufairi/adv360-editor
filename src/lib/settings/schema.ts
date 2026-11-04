import { ACTIONS, type Action } from '../navigation/actions'
import { parseSequence } from '../navigation/keys'
import { SCHEME_NAMES, type CustomBindings, type SchemeName } from '../navigation/schemes'

/** Keyboard navigation preferences. */
export interface NavigationSettings {
  scheme: SchemeName
  /** Keep the arrow keys moving the selection in every scheme. */
  arrowsAlwaysOn: boolean
  /** Wrap past board edges instead of stopping. */
  wrap: boolean
  /** Per-action sequences, used when `scheme` is `custom`. */
  custom: CustomBindings
}

/**
 * All user settings. New sections (for example `theme`) are added as sibling keys; each section
 * is validated and defaulted on its own so an unknown or broken section cannot break the others.
 */
export interface Settings {
  navigation: NavigationSettings
}

/** Version of the stored envelope. Bump it and add a {@link MIGRATIONS} step when it changes. */
export const SETTINGS_VERSION = 1

/** Factory defaults. Returned whenever stored data is missing or cannot be used. */
export const DEFAULT_SETTINGS: Settings = {
  navigation: {
    scheme: 'arrows',
    arrowsAlwaysOn: true,
    wrap: false,
    custom: {},
  },
}

type Raw = Record<string, unknown>

/** Upgrades a stored object from version `n` to `n + 1`. Version 0 is the unversioned draft. */
const MIGRATIONS: Record<number, (raw: Raw) => Raw> = {
  // v0 stored the navigation object at the top level, without an envelope or a section key.
  0: (raw) => (isRecord(raw.navigation) ? raw : { navigation: raw }),
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Brings a stored envelope (`{ version, settings }`) up to the current version and validates
 * every field. Anything unusable falls back to its default; nothing here throws.
 */
export function parseStoredSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return cloneDefaults()
  const version = typeof raw.version === 'number' ? raw.version : 0
  if (version > SETTINGS_VERSION || version < 0) return cloneDefaults()

  let body: Raw = isRecord(raw.settings) ? raw.settings : raw
  for (let step = version; step < SETTINGS_VERSION; step += 1) {
    const migrate = MIGRATIONS[step]
    if (migrate) body = migrate(body)
  }
  return validateSettings(body)
}

/** Validates a settings object section by section, defaulting each invalid field. */
export function validateSettings(body: Raw): Settings {
  const navigation = isRecord(body.navigation) ? body.navigation : {}
  return {
    navigation: {
      scheme: pickScheme(navigation.scheme),
      arrowsAlwaysOn: pickBoolean(
        navigation.arrowsAlwaysOn,
        DEFAULT_SETTINGS.navigation.arrowsAlwaysOn,
      ),
      wrap: pickBoolean(navigation.wrap, DEFAULT_SETTINGS.navigation.wrap),
      custom: pickCustom(navigation.custom),
    },
  }
}

/** Creates a fresh copy of the defaults so callers cannot mutate the shared constant. */
export function cloneDefaults(): Settings {
  return structuredClone(DEFAULT_SETTINGS)
}

function pickScheme(value: unknown): SchemeName {
  return (SCHEME_NAMES as readonly unknown[]).includes(value)
    ? (value as SchemeName)
    : DEFAULT_SETTINGS.navigation.scheme
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Keeps only known actions whose sequences parse to at least one key. */
function pickCustom(value: unknown): CustomBindings {
  if (!isRecord(value)) return {}
  const custom: CustomBindings = {}
  for (const action of ACTIONS) {
    const sequences = value[action]
    if (!Array.isArray(sequences)) continue
    const valid = sequences
      .filter((item): item is string => typeof item === 'string')
      .filter((item) => parseSequence(item).length > 0)
    custom[action as Action] = valid
  }
  return custom
}
