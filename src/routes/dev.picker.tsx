import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BindingPicker } from '../components/picker/BindingPicker'
import type { PickerHoldTap, PickerLayer, PickerMacro } from '../components/picker/items'
import { formatBinding, type BindingValue } from '../lib/keycodes/binding'
import customKeymap from '../../fixtures/issues/custom-keycodes.keymap?raw'
import customHeader from '../../fixtures/issues/custom-keycodes.h?raw'
import { resolve } from '../lib/zmk'

export const Route = createFileRoute('/dev/picker')({ component: PickerPage })

const LAYERS: PickerLayer[] = [
  { index: 0, name: 'Default' },
  { index: 1, name: 'Keypad' },
  { index: 2, name: 'Mod' },
  { index: 3, name: 'Macro' },
]

const MACROS: PickerMacro[] = [
  { label: 'Hello world', name: 'hello_world' },
  { label: 'Sign off', name: 'sign_off' },
  { label: 'Force quit', name: 'force_quit' },
]

const HOLD_TAPS: PickerHoldTap[] = [{ label: 'hm' }, { label: 'td_esc' }]

const START: BindingValue = { behavior: '&kp', params: ['LC(LS(K))'] }
const USER_KEYCODES = resolve(
  {
    'custom-keycodes.keymap': customKeymap,
    'custom-keycodes.h': customHeader,
  },
  'custom-keycodes.keymap',
).userKeycodes

/**
 * Dev-only page that shows the binding picker open against sample layers, macros and hold-taps,
 * with the resulting ZMK text.
 * @returns The dev page.
 */
function PickerPage() {
  const [binding, setBinding] = useState<BindingValue>(START)
  const [open, setOpen] = useState(true)
  const [log, setLog] = useState<string[]>([])

  return (
    <main style={{ padding: 24, display: 'grid', gap: 16, justifyItems: 'start' }}>
      <h1 style={{ margin: 0, fontSize: 18 }}>Binding picker (dev)</h1>
      <p style={{ margin: 0 }}>
        Result: <code>{formatBinding(binding)}</code>
      </p>
      {open ? (
        <BindingPicker
          value={binding}
          layers={LAYERS}
          macros={MACROS}
          holdTaps={HOLD_TAPS}
          userKeycodes={USER_KEYCODES}
          onChange={(next) => {
            setBinding(next)
            setLog((previous) => [formatBinding(next), ...previous].slice(0, 5))
          }}
          onClose={() => setOpen(false)}
        />
      ) : (
        <button type="button" onClick={() => setOpen(true)}>
          Reopen picker
        </button>
      )}
      {log.length > 0 ? (
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {log.map((entry, index) => (
            <li key={`${entry}-${index}`}>
              <code>{entry}</code>
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  )
}
