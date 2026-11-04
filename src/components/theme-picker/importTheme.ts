import { parseGhostty } from '../../lib/theme/parseGhostty'
import { themeHash } from '../../lib/theme/runtime'
import type { ThemeDef } from '../../lib/theme/tokens'

/**
 * Turn pasted theme text into a theme definition. Text starting with `{` is read as OpenCode
 * JSON; anything else is read as a Ghostty config with palette settings.
 * @param text The pasted text.
 * @returns A theme ready for the theme provider's importCustom.
 * @throws Error with a message a person can act on when the text cannot be read.
 */
export function parseThemeImport(text: string): ThemeDef {
  const trimmed = text.trim()
  if (trimmed === '') throw new Error('Paste a Ghostty theme or OpenCode JSON first.')
  if (trimmed.startsWith('{')) return parseOpenCodeImport(trimmed)
  let palette
  try {
    palette = parseGhostty(trimmed)
  } catch {
    throw new Error('No Ghostty colours found. A background and foreground are required.')
  }
  const draft = { id: '', name: 'Imported Ghostty palette', type: 'terminal' as const, palette }
  return { ...draft, id: `custom:ghostty-${themeHash(draft)}` }
}

function parseOpenCodeImport(text: string): ThemeDef {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That is not valid JSON.')
  }
  if (!isRecord(parsed) || !isRecord(parsed.theme)) {
    throw new Error('OpenCode JSON needs a "theme" object.')
  }
  const name = typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Imported OpenCode'
  const draft: ThemeDef = {
    id: '',
    name,
    type: 'semantic',
    defs: isRecord(parsed.defs) ? (parsed.defs as Record<string, string | number>) : undefined,
    theme: parsed.theme as ThemeDef['theme'],
  }
  return { ...draft, id: `custom:opencode-${themeHash(draft)}` }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
