import { assertValidProfileRegistry } from './validate'
import type { KeyboardProfile, ProfileRegistry } from './types'

export const ADV360_PROFILE: KeyboardProfile = {
  id: 'adv360',
  name: 'Kinesis Advantage360 Pro',
  repo: { owner: 'ali-aljufairi', name: 'Adv360-Pro-ZMK' },
  branch: 'V3.0',
  configRoot: 'config',
  keymap: { path: 'config/adv360.keymap', sharedAcrossParts: true },
  target: {
    board: 'adv360_left',
    parts: [
      { id: 'left', board: 'adv360_left', role: 'central' },
      { id: 'right', board: 'adv360_right', role: 'peripheral' },
    ],
  },
  layout: {
    source: 'zmk-dts',
    path: 'config/boards/arm/adv360/adv360-layouts.dtsi',
    layoutName: 'Default',
    nodeLabel: 'physical_layout0',
    keyCount: 76,
    verified: true,
  },
  build: {
    workflowPath: '.github/workflows/build.yml',
    kind: 'custom',
    artifactMap: {
      clique: ['firmware-clique'],
      noClique: ['firmware-no-clique'],
    },
  },
}

export const profileRegistry: ProfileRegistry = {
  version: 1,
  profiles: [ADV360_PROFILE],
}
assertValidProfileRegistry(profileRegistry)

/** Return a registered profile by id. */
export function getKeyboardProfile(id: string): KeyboardProfile {
  const profile = profileRegistry.profiles.find((entry) => entry.id === id)
  if (!profile) throw new Error(`Unknown keyboard profile: ${id}`)
  return profile
}
