/** Platform choices the user can make in settings. `auto` detects the browser's platform. */
export const PLATFORM_NAMES = ['auto', 'mac', 'windows', 'linux'] as const

/** A platform setting, as stored. */
export type PlatformSetting = (typeof PLATFORM_NAMES)[number]

/** A platform that shortcuts can be rendered for. */
export type ResolvedPlatform = Exclude<PlatformSetting, 'auto'>

/** The navigator fields that platform detection reads. */
export interface NavigatorLike {
  platform?: string
  userAgent?: string
}

/**
 * Detects the platform from the browser. Without a navigator (server rendering) it answers
 * `linux`, the non-mac default, so server markup does not depend on the machine that renders it.
 * @param nav - The navigator to read; defaults to the global one when present.
 * @returns The detected platform.
 */
export function detectPlatform(nav?: NavigatorLike): ResolvedPlatform {
  const source = nav ?? (typeof navigator === 'undefined' ? undefined : navigator)
  if (!source) return 'linux'
  const text = `${source.platform ?? ''} ${source.userAgent ?? ''}`
  if (/mac|iphone|ipad|ipod/i.test(text)) return 'mac'
  if (/win/i.test(text)) return 'windows'
  return 'linux'
}

/**
 * Turns a platform setting into a concrete platform.
 * @param setting - The stored setting; `auto` triggers detection.
 * @param nav - Optional navigator, for tests.
 * @returns The platform to render for.
 */
export function resolvePlatform(setting: PlatformSetting, nav?: NavigatorLike): ResolvedPlatform {
  return setting === 'auto' ? detectPlatform(nav) : setting
}

/**
 * The modifier that a platform shortcut wraps its key in: Command on mac, Control elsewhere.
 * @param platform - The resolved platform.
 * @returns `LG` on mac, `LC` otherwise.
 */
export function shortcutModId(platform: ResolvedPlatform): 'LG' | 'LC' {
  return platform === 'mac' ? 'LG' : 'LC'
}

/**
 * Tells whether a value is one of the stored platform settings.
 * @param value - Anything read from storage.
 * @returns True for `auto`, `mac`, `windows` and `linux`.
 */
export function isPlatformSetting(value: unknown): value is PlatformSetting {
  return (PLATFORM_NAMES as readonly unknown[]).includes(value)
}
