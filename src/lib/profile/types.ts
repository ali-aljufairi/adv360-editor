/** Layout representation named by a keyboard profile. */
export type ProfileLayoutSource = 'zmk-dts' | 'qmk-info-json' | 'keymap-drawer' | 'kle' | 'manual'

/** Repository, target, layout, and firmware build metadata for one keyboard. */
export interface KeyboardProfile {
  id: string
  name: string
  repo: { owner: string; name: string }
  branch: string
  configRoot: string
  keymap: { path: string; sharedAcrossParts: boolean }
  target: {
    board: string
    shield?: string
    parts?: Array<{ id: string; board?: string; shield?: string; role?: string }>
  }
  layout: {
    source: ProfileLayoutSource
    path: string
    layoutName?: string
    nodeLabel?: string
    keyCount: number
    verified: boolean
  }
  build: {
    workflowPath: string
    kind: 'zmk-reusable' | 'custom'
    matrixPath?: string
    artifactMap: Record<string, string[]>
  }
  sensors?: { count: number; labels?: string[] }
}

/** Versioned collection of supported keyboard profiles. */
export interface ProfileRegistry {
  version: number
  profiles: KeyboardProfile[]
}
