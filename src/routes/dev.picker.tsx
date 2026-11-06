import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BindingPicker, type HoldTapInfo } from '../components/picker/BindingPicker'
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

const MACRO_PREVIEW: Record<string, string> = {
  hello_world: 'Type "Hello, world"',
  sign_off: 'Type name, then Return',
  force_quit: 'Cmd+Option+Esc',
}

/** Hold-taps in the model. `tpf` writes hold then tap; `lt_pad` writes tap then layer. */
const HOLD_TAPS: PickerHoldTap[] = [
  { label: 'hm' },
  { label: 'td_esc' },
  { label: 'tpf' },
  { label: 'lt_pad' },
]

const HOLD_TAP_INFO: HoldTapInfo[] = [
  { label: 'tpf', order: 'hold-tap', holdKind: 'key' },
  { label: 'lt_pad', order: 'tap-hold', holdKind: 'layer' },
]

/** Sample bindings to open the picker on, one per tab. */
const SAMPLES: readonly { title: string; value: BindingValue }[] = [
  { title: 'Key', value: { behavior: '&kp', params: ['LC(LS(K))'] } },
  { title: 'Tap/Hold mt', value: { behavior: '&mt', params: ['LSHIFT', 'LC(A)'] } },
  { title: 'Tap/Hold tpf', value: { behavior: '&tpf', params: ['LSHIFT', 'A'] } },
  { title: 'Tap/Hold lt_pad', value: { behavior: '&lt_pad', params: ['A', '2'] } },
  { title: 'Layer', value: { behavior: '&tog', params: ['2'] } },
  { title: 'Macro', value: { behavior: '&hello_world', params: [] } },
  { title: 'Bluetooth', value: { behavior: '&bt', params: ['BT_CLR'] } },
  { title: 'Mouse', value: { behavior: '&mkp', params: ['LCLK'] } },
  { title: 'System', value: { behavior: '&sys_reset', params: [] } },
  { title: 'Empty', value: { behavior: '&trans', params: [] } },
]

const USER_KEYCODES = resolve(
  {
    'custom-keycodes.keymap': customKeymap,
    'custom-keycodes.h': customHeader,
  },
  'custom-keycodes.keymap',
).userKeycodes

/**
 * Dev-only page that shows the binding picker against sample layers, macros and hold-taps, with
 * the resulting ZMK text. The sample buttons reopen it on one binding per behavior tab.
 * @returns The dev page.
 */
function PickerPage() {
  const [binding, setBinding] = useState<BindingValue>(SAMPLES[0].value)
  const [open, setOpen] = useState(true)
  const [session, setSession] = useState(0)
  const [log, setLog] = useState<string[]>([])

  /**
   * Reopens the picker on a sample binding. Bumping the session remounts the picker so it
   * reads the new binding.
   * @param value - The binding to open on.
   */
  function openOn(value: BindingValue): void {
    setBinding(value)
    setSession((count) => count + 1)
    setOpen(true)
  }

  return (
    <main style={{ padding: 24, display: 'grid', gap: 16, justifyItems: 'start' }}>
      <h1 style={{ margin: 0, fontSize: 18 }}>Binding picker (dev)</h1>
      <p style={{ margin: 0 }}>
        Result: <code>{formatBinding(binding)}</code>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SAMPLES.map((sample) => (
          <button key={sample.title} type="button" onClick={() => openOn(sample.value)}>
            {sample.title}
          </button>
        ))}
      </div>
      {open ? (
        <BindingPicker
          key={session}
          value={binding}
          layers={LAYERS}
          macros={MACROS}
          holdTaps={HOLD_TAPS}
          holdTapInfo={HOLD_TAP_INFO}
          macroPreview={MACRO_PREVIEW}
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
