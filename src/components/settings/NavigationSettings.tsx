import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ACTIONS, ACTION_LABELS, type Action } from '../../lib/navigation/actions'
import {
  describeSequence,
  eventToToken,
  formatSequence,
  parseSequence,
} from '../../lib/navigation/keys'
import {
  resolveBindings,
  SCHEME_LABELS,
  SCHEME_NAMES,
  type CustomBindings,
  type SchemeBindings,
  type SchemeName,
} from '../../lib/navigation/schemes'
import { useSettings } from '../../lib/settings/context'

/** Silence after which a recorded sequence is committed. */
const RECORD_IDLE_MS = 800

const palette = {
  surface: 'var(--surface, #1b1b22)',
  text: 'var(--text, #e8e8ee)',
  muted: 'var(--text-muted, #9a9aa8)',
  accent: 'var(--accent, #7aa2f7)',
  border: 'var(--border-subtle, #2e2e38)',
} as const

const FOCUS_CSS = `.nav-settings button:focus-visible{outline:2px solid var(--focus-ring, #7aa2f7);outline-offset:2px}`

const panel: CSSProperties = {
  background: palette.surface,
  color: palette.text,
  border: `1px solid ${palette.border}`,
  borderRadius: 10,
  padding: 16,
  fontSize: 14,
  maxWidth: 640,
}

const chip: CSSProperties = {
  border: `1px solid ${palette.border}`,
  borderRadius: 6,
  padding: '2px 8px',
  marginRight: 6,
  background: 'transparent',
  color: palette.text,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  cursor: 'pointer',
}

const button: CSSProperties = {
  ...chip,
  fontFamily: 'inherit',
  fontSize: 13,
  padding: '4px 10px',
}

/**
 * Settings panel for keyboard navigation: scheme, toggles, a cheat sheet of current bindings,
 * and click-to-rebind (press keys to record; Esc cancels). Rebinding a key in a preset copies
 * that preset into the custom scheme first, so the other bindings stay as they were.
 */
export function NavigationSettings() {
  const { settings, updateNavigation, resetNavigation } = useSettings()
  const nav = settings.navigation
  const effective: SchemeBindings = resolveBindings(nav.scheme, nav.custom, {
    arrowsAlwaysOn: nav.arrowsAlwaysOn,
  })
  const [recording, setRecording] = useState<Action | null>(null)
  const [heard, setHeard] = useState('')
  const tokens = useRef<string[]>([])

  useEffect(() => {
    if (!recording) return undefined
    let idle: ReturnType<typeof setTimeout> | undefined
    const commit = () => {
      const sequence = formatSequence(tokens.current)
      setRecording(null)
      setHeard('')
      if (sequence) rebind(recording, sequence)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape' && tokens.current.length === 0) {
        setRecording(null)
        return
      }
      const token = eventToToken(event)
      if (!token) return
      tokens.current = [...tokens.current, token]
      setHeard(formatSequence(tokens.current))
      if (idle !== undefined) clearTimeout(idle)
      idle = setTimeout(commit, RECORD_IDLE_MS)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      if (idle !== undefined) clearTimeout(idle)
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [recording])

  /** Makes `sequence` the only binding of `action` in a custom table, stealing it from others. */
  function rebind(action: Action, sequence: string) {
    const base = resolveBindings(nav.scheme, nav.custom, { arrowsAlwaysOn: false })
    const next: CustomBindings = {}
    for (const other of ACTIONS) {
      if (other === action) {
        next[other] = [sequence]
        continue
      }
      next[other] = base[other].filter(
        (existing) => formatSequence(parseSequence(existing)) !== sequence,
      )
    }
    updateNavigation({ scheme: 'custom', custom: next })
  }

  return (
    <section aria-labelledby="navigation-settings-title" className="nav-settings" style={panel}>
      <style>{FOCUS_CSS}</style>
      <h2 id="navigation-settings-title" style={{ fontSize: 16, margin: '0 0 12px' }}>
        Keyboard navigation
      </h2>

      <div role="radiogroup" aria-label="Navigation scheme" style={{ display: 'flex', gap: 4 }}>
        {SCHEME_NAMES.map((name: SchemeName) => {
          const selected = nav.scheme === name
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => updateNavigation({ scheme: name })}
              style={{
                ...button,
                background: selected ? palette.accent : 'transparent',
                color: selected ? palette.surface : palette.text,
              }}
            >
              {SCHEME_LABELS[name]}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, margin: '12px 0', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={nav.arrowsAlwaysOn}
            onChange={(event) => updateNavigation({ arrowsAlwaysOn: event.target.checked })}
          />
          Arrow keys always active
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={nav.wrap}
            onChange={(event) => updateNavigation({ wrap: event.target.checked })}
          />
          Wrap at edges
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption style={{ textAlign: 'left', color: palette.muted, paddingBottom: 6 }}>
          Click a key to rebind it, then press the new keys. Esc cancels.
        </caption>
        <thead>
          <tr style={{ color: palette.muted, textAlign: 'left' }}>
            <th style={{ padding: '4px 0', fontWeight: 500 }}>Action</th>
            <th style={{ padding: '4px 0', fontWeight: 500 }}>Keys</th>
          </tr>
        </thead>
        <tbody>
          {ACTIONS.map((action) => (
            <tr key={action} style={{ borderTop: `1px solid ${palette.border}` }}>
              <td style={{ padding: '6px 0' }}>{ACTION_LABELS[action]}</td>
              <td style={{ padding: '6px 0' }}>
                {recording === action ? (
                  <span style={{ color: palette.accent }}>
                    {heard ? `${describeSequence(heard)}…` : 'Press keys…'}
                  </span>
                ) : (
                  <BindingChips
                    sequences={effective[action]}
                    label={ACTION_LABELS[action]}
                    onRebind={() => {
                      tokens.current = []
                      setHeard('')
                      setRecording(action)
                    }}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <button type="button" onClick={resetNavigation} style={button}>
          Reset to defaults
        </button>
        <span style={{ color: palette.muted, fontSize: 12 }}>
          Browser shortcuts such as Ctrl+N or Ctrl+T cannot always be overridden. See
          docs/navigation.md.
        </span>
      </div>
    </section>
  )
}

function BindingChips({
  sequences,
  label,
  onRebind,
}: {
  sequences: readonly string[]
  label: string
  onRebind: () => void
}) {
  if (sequences.length === 0) {
    return (
      <button type="button" aria-label={`Rebind ${label}`} onClick={onRebind} style={chip}>
        unbound
      </button>
    )
  }
  return (
    <>
      {sequences.map((sequence) => (
        <button
          key={sequence}
          type="button"
          aria-label={`Rebind ${label} (currently ${describeSequence(sequence)})`}
          onClick={onRebind}
          style={chip}
        >
          {describeSequence(sequence)}
        </button>
      ))}
    </>
  )
}
