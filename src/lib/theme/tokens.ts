/** Semantic CSS properties grouped by surface, text, keycap, identity and depth. */
export const tokenNames = [
  'surface-canvas',
  'surface-panel',
  'surface-raised',
  'surface-hover',
  'surface-glow',
  'surface-dot',
  'text-primary',
  'text-secondary',
  'text-muted',
  'border-base',
  'border-subtle',
  'focus-ring',
  'keycap-top',
  'keycap-face',
  'keycap-side',
  'keycap-highlight',
  'keycap-legend',
  'keycap-sublegend',
  'keycap-shadow',
  'layer-1',
  'layer-2',
  'layer-3',
  'layer-4',
  'arc-holdtap',
  'arc-macro',
  'arc-bluetooth',
  'arc-combo',
  'status-warning',
  'status-error',
  'status-success',
  'status-info',
  'diff-add',
  'diff-remove',
  'diff-add-bg',
  'diff-remove-bg',
  'accent-primary',
  'on-accent',
  'on-warning',
  'on-success',
  'on-combo',
  'on-layer-1',
  'on-layer-2',
  'on-layer-3',
  'on-layer-4',
  'overlay',
  'shadow-ink',
  'shadow-dialog',
  'shadow-float',
] as const
/**
 *
 */
export type TokenName = (typeof tokenNames)[number]
/**
 *
 */
export type Tokens = Record<TokenName, string>
/**
 *
 */
export type Mode = 'light' | 'dark'
/**
 *
 */
export interface TerminalPalette {
  background: string
  foreground: string
  cursor?: string
  selection?: string
  selectionForeground?: string
  ansi: string[]
}
/**
 *
 */
export interface ThemeDef {
  id: string
  name: string
  type: 'terminal' | 'semantic'
  palette?: TerminalPalette
  defs?: Record<string, string | number>
  theme?: Record<string, string | number | { dark: string | number; light: string | number }>
}
