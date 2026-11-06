import { createFileRoute } from '@tanstack/react-router'
import { useState, type CSSProperties } from 'react'
import keymap from '../../fixtures/adv360/adv360.keymap?raw'
import info from '../../fixtures/adv360/info.json?raw'
import macros from '../../fixtures/adv360/macros.dtsi?raw'
import { NavigationSettings } from '../components/settings/NavigationSettings'
import { describeSequence } from '../lib/navigation/keys'
import { ACTION_LABELS } from '../lib/navigation/actions'
import { SettingsProvider } from '../lib/settings/context'
import { useBoardNavigation } from '../lib/settings/useBoardNavigation'
import { loadPhysicalLayout, resolve, type PhysicalKey } from '../lib/zmk'

export const Route = createFileRoute('/dev/navigation')({ component: DevNavigation })

/** Pixels per key unit. */
const UNIT = 52

const keys: PhysicalKey[] = loadPhysicalLayout(info)
const model = resolve({ 'adv360.keymap': keymap, 'macros.dtsi': macros }, 'adv360.keymap')
const layerZero = model.layers[0]?.bindings ?? []

/** Absolutely positioned, rotated box for one key, with its origin at the key's rx/ry. */
function boxStyle(key: PhysicalKey, selected: boolean): CSSProperties {
  const originX = key.rx === undefined ? key.x : Number(key.rx)
  const originY = key.ry === undefined ? key.y : Number(key.ry)
  return {
    position: 'absolute',
    left: key.x * UNIT,
    top: key.y * UNIT,
    width: key.w * UNIT - 4,
    height: key.h * UNIT - 4,
    transform: key.r ? `rotate(${key.r}deg)` : undefined,
    transformOrigin: `${(originX - key.x) * UNIT}px ${(originY - key.y) * UNIT}px`,
    border: `2px solid ${selected ? 'var(--accent, #7aa2f7)' : 'var(--border-subtle, #2e2e38)'}`,
    background: selected ? 'var(--surface-raised, #262631)' : 'var(--surface, #1b1b22)',
    color: 'var(--text, #e8e8ee)',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    fontSize: 10,
    lineHeight: 1.1,
    overflow: 'hidden',
    textAlign: 'center',
    cursor: 'pointer',
  }
}

function DevNavigation() {
  return (
    <SettingsProvider>
      <NavigationBoard />
    </SettingsProvider>
  )
}

function NavigationBoard() {
  const [selected, setSelected] = useState(0)
  const { pending, lastAction } = useBoardNavigation({ keys, selected, onSelect: setSelected })
  const selectedKey = keys[selected]
  const selectedText = layerZero[selected]?.text ?? ''

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 24,
        background: 'var(--bg, #15151a)',
        color: 'var(--text, #e8e8ee)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>Navigation dev page</h1>
      <p style={{ margin: '0 0 16px', color: 'var(--text-muted, #9a9aa8)', fontSize: 13 }}>
        Layer 0 of adv360.keymap on the Advantage360 layout. Click a key or move with the active
        scheme.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <div style={{ position: 'relative', width: 19 * UNIT, height: 9 * UNIT }}>
            {keys.map((key) => (
              <div
                key={key.index}
                role="button"
                tabIndex={-1}
                aria-label={`Key ${key.index}: ${layerZero[key.index]?.text ?? key.label ?? ''}`}
                aria-pressed={selected === key.index}
                data-selected={selected === key.index ? 'true' : undefined}
                onClick={() => setSelected(key.index)}
                style={boxStyle(key, selected === key.index)}
              >
                <span style={{ opacity: 0.6 }}>{key.index}</span>
                <span>{layerZero[key.index]?.text ?? key.label}</span>
              </div>
            ))}
          </div>
        </div>

        <aside style={{ minWidth: 260, flex: '0 1 320px' }}>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', margin: 0 }}>
            <dt style={{ color: 'var(--text-muted, #9a9aa8)' }}>Selected</dt>
            <dd style={{ margin: 0 }}>
              {selected} {selectedKey?.label ? `(${selectedKey.label})` : ''} {selectedText}
            </dd>
            <dt style={{ color: 'var(--text-muted, #9a9aa8)' }}>Last action</dt>
            <dd style={{ margin: 0 }}>{lastAction ? ACTION_LABELS[lastAction] : '—'}</dd>
            <dt style={{ color: 'var(--text-muted, #9a9aa8)' }}>Pending</dt>
            <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>
              {pending ? describeSequence(pending) : '—'}
            </dd>
          </dl>
          <div style={{ marginTop: 20 }}>
            <NavigationSettings />
          </div>
        </aside>
      </div>
    </main>
  )
}
