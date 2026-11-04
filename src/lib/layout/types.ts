import type { PhysicalKey } from '../zmk/types'

/** Identifier for an implemented layout parser. */
export type LayoutSourceKind = 'qmk-info-json' | 'zmk-dts'

/** Parsed physical key geometry and its provenance. */
export interface PhysicalLayout {
  keys: PhysicalKey[]
  name: string
  source: LayoutSourceKind
  verified: boolean
}

/** Select a named layout or a labeled DTS node when a file contains several. */
export interface LayoutSelection {
  layoutName?: string
  nodeLabel?: string
}

/** Adapter for reading one supported keyboard layout source. */
export interface LayoutSource {
  readonly kind: LayoutSourceKind
  load(input: string, selection?: LayoutSelection): PhysicalLayout
}
