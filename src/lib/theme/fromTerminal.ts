import { contrast, ensureContrast, luminance, mix } from './color'
import type { TerminalPalette, Tokens } from './tokens'

/** Derive the complete editor palette from terminal colors. */
export function fromTerminal(value217: TerminalPalette): Tokens {
  const bg = value217.background,
    fg = value217.foreground,
    dark = luminance(bg) <= 0.42,
    pick = (value364: number) => value217.ansi[value364] || fg
  const panel = mix(bg, fg, dark ? 0.045 : 0.035),
    raised = mix(panel, fg, dark ? 0.08 : 0.055)
  const glyph = (value532: number) => ensureContrast(pick(value532), bg, 3.15)
  const ink = (value609: string) =>
    contrast('#ffffff', value609) >= contrast('#000000', value609) ? '#ffffff' : '#000000'
  const rgba = (value737: string, value755: number) => {
    const value788 = value737.replace('#', '')
    return `rgba(${[0, 2, 4].map((i) => parseInt(value788.slice(i, i + 2), 16)).join(',')},${value755})`
  }
  const value942 = [glyph(4), glyph(2), glyph(3), glyph(5)],
    warning = glyph(1),
    success = glyph(2),
    combo = glyph(13),
    accent = value942[0]
  return {
    'surface-canvas': bg,
    'surface-panel': panel,
    'surface-raised': raised,
    'surface-hover': mix(raised, fg, dark ? 0.09 : 0.06),
    'surface-glow': rgba(value217.selection || pick(4), 0.1),
    'surface-dot': rgba(fg, dark ? 0.075 : 0.12),
    'text-primary': ensureContrast(fg, bg, 4.5),
    'text-secondary': ensureContrast(mix(fg, bg, dark ? 0.18 : 0.25), panel, 4.5),
    'text-muted': ensureContrast(mix(fg, bg, dark ? 0.4 : 0.43), panel, 3),
    'border-base': mix(bg, fg, dark ? 0.18 : 0.15),
    'border-subtle': mix(bg, fg, dark ? 0.1 : 0.08),
    'focus-ring': ensureContrast(value217.cursor || pick(4), bg, 3.15),
    'keycap-top': mix(panel, '#ffffff', dark ? 0.1 : 0.35),
    'keycap-face': panel,
    'keycap-side': mix(panel, '#000000', dark ? 0.42 : 0.12),
    'keycap-highlight': rgba('#ffffff', dark ? 0.17 : 0.78),
    'keycap-legend': ensureContrast(fg, panel, 4.5),
    'keycap-sublegend': ensureContrast(mix(fg, panel, dark ? 0.29 : 0.35), panel, 3),
    'keycap-shadow': rgba('#000000', dark ? 0.52 : 0.24),
    'layer-1': value942[0],
    'layer-2': value942[1],
    'layer-3': value942[2],
    'layer-4': value942[3],
    'arc-holdtap': glyph(5),
    'arc-macro': glyph(5),
    'arc-bluetooth': glyph(4),
    'arc-combo': combo,
    'status-warning': warning,
    'status-error': glyph(1),
    'status-success': success,
    'status-info': glyph(6),
    'diff-add': glyph(2),
    'diff-remove': glyph(1),
    'diff-add-bg': mix(bg, pick(2), dark ? 0.22 : 0.14),
    'diff-remove-bg': mix(bg, pick(1), dark ? 0.22 : 0.14),
    'accent-primary': accent,
    'on-accent': ink(accent),
    'on-warning': ink(warning),
    'on-success': ink(success),
    'on-combo': ink(combo),
    'on-layer-1': ink(value942[0]),
    'on-layer-2': ink(value942[1]),
    'on-layer-3': ink(value942[2]),
    'on-layer-4': ink(value942[3]),
    overlay: rgba('#000000', 0.43),
    'shadow-ink': rgba('#000000', dark ? 0.45 : 0.12),
    'shadow-dialog': `0 30px 65px -20px ${rgba('#000000', dark ? 0.74 : 0.37)}`,
    'shadow-float': `0 16px 36px -16px ${rgba('#000000', dark ? 0.65 : 0.28)}`,
  }
}
