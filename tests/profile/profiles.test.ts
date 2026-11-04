import { expect, it } from 'vitest'
import { files } from '../zmk/fixtures'
import { createEditorForProfile } from '../../src/lib/zmk'
import { ADV360_PROFILE, profileRegistry, validateKeyboardProfile } from '../../src/lib/profile'

it('provides a valid, versioned Advantage360 profile', () => {
  expect(profileRegistry.version).toBe(1)
  expect(profileRegistry.profiles).toEqual([ADV360_PROFILE])
  expect(validateKeyboardProfile(ADV360_PROFILE).success).toBe(true)
  expect(ADV360_PROFILE.build.artifactMap).toEqual({
    clique: ['firmware-clique'],
    noClique: ['firmware-no-clique'],
  })
})

it('creates an editor from the profile keymap and selected physical layout', () => {
  const editor = createEditorForProfile(ADV360_PROFILE, files)
  expect(editor.entry).toBe('adv360.keymap')
  expect(editor.profileId).toBe('adv360')
  expect(editor.layout).toMatchObject({ name: 'Default', source: 'zmk-dts', verified: true })
  expect(editor.layout?.keys).toHaveLength(76)
})

it('reports profile validation paths for malformed fields', () => {
  const result = validateKeyboardProfile({
    ...ADV360_PROFILE,
    layout: { ...ADV360_PROFILE.layout, keyCount: 0 },
  })
  expect(result).toMatchObject({ success: false, errors: ['layout.keyCount must be a positive integer'] })
})
