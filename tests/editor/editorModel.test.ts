import { describe, expect, it } from 'vitest'
import { layerDisplayName } from '../../src/components/editor/editorModel'

describe('layerDisplayName', () => {
  it('drops the _layer suffix and title-cases the node name', () => {
    expect(layerDisplayName('default_layer')).toBe('Default')
    expect(layerDisplayName('keypad_layer')).toBe('Keypad')
    expect(layerDisplayName('mod_layer')).toBe('Mod')
  })

  it('keeps names without the suffix and splits separators into words', () => {
    expect(layerDisplayName('macro')).toBe('Macro')
    expect(layerDisplayName('windows-overlay_layer')).toBe('Windows Overlay')
  })
})
