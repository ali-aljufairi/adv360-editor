import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
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

/** Step taken by arrow keys inside the scheme radio group. */
const ARROW_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

const text = 'var(--text-primary)'
const muted = 'var(--text-muted)'
const hairline = 'var(--border-subtle)'
const accent = 'var(--accent-primary)'

const FOCUS_CSS =
  '.nav-settings button:focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}'

const section: CSSProperties = {
  color: text,
  fontSize: 13,
  padding: '0 16px 16px',
}

const heading: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  margin: 0,
  padding: '14px 0 10px',
  borderBottom: `1px solid ${hairline}`,
}

const kbd: CSSProperties = {
  border: `1px solid ${hairline}`,
  borderRadius: 2,
  padding: '1px 6px',
  marginRight: 6,
  background: 'transparent',
  color: text,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  cursor: 'pointer',
}

const textButton: CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  color: muted,
  fontSize: 12,
  cursor: 'pointer',
}

/**
 * Settings panel for keyboard navigation: scheme, toggles, a cheat sheet of current bindings,
 * and click-to-rebind (press keys to record; Esc cancels). Rebinding a key in a preset copies
 * that preset into the custom scheme first, so the other bindings stay as they were.
 * @returns The navigation settings, rendered flat inside the docked side panel.
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
  const schemeGroup = useRef<HTMLDivElement>(null)

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

  /** Moves the scheme selection with the arrow keys, as a native radio group does. */
  function onSchemeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = ARROW_STEP[event.key]
    if (step === undefined) return
    event.preventDefault()
    const count = SCHEME_NAMES.length
    const target = (SCHEME_NAMES.indexOf(nav.scheme) + step + count) % count
    const name = SCHEME_NAMES[target]
    if (!name) return
    updateNavigation({ scheme: name })
    schemeGroup.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[target]?.focus()
  }

  return (
    <section aria-labelledby="navigation-settings-title" className="nav-settings" style={section}>
      <style>{FOCUS_CSS}</style>
      <h2 id="navigation-settings-title" style={heading}>
        Keyboard navigation
      </h2>

      <div
        ref={schemeGroup}
        role="radiogroup"
        aria-label="Navigation scheme"
        onKeyDown={onSchemeKeyDown}
        style={{ display: 'flex', gap: 18, marginTop: 12, borderBottom: `1px solid ${hairline}` }}
      >
        {SCHEME_NAMES.map((name: SchemeName) => {
          const selected = nav.scheme === name
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => updateNavigation({ scheme: name })}
              style={{
                background: 'none',
                border: 0,
                borderRadius: 0,
                borderBottom: `2px solid ${selected ? accent : 'transparent'}`,
                marginBottom: -1,
                padding: '6px 0',
                color: selected ? text : muted,
                fontSize: 13,
                fontWeight: selected ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {SCHEME_LABELS[name]}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 18, margin: '12px 0', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={nav.arrowsAlwaysOn}
            style={{ accentColor: accent }}
            onChange={(event) => updateNavigation({ arrowsAlwaysOn: event.target.checked })}
          />
          Arrow keys always active
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={nav.wrap}
            style={{ accentColor: accent }}
            onChange={(event) => updateNavigation({ wrap: event.target.checked })}
          />
          Wrap at edges
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <caption style={{ textAlign: 'left', color: muted, fontSize: 12, paddingBottom: 6 }}>
          Click a key to rebind it, then press the new keys. Esc cancels.
        </caption>
        <thead>
          <tr style={{ color: muted, fontSize: 12, textAlign: 'left' }}>
            <th style={{ padding: '4px 0', fontWeight: 500 }}>Action</th>
            <th style={{ padding: '4px 0', fontWeight: 500 }}>Keys</th>
          </tr>
        </thead>
        <tbody>
          {ACTIONS.map((action) => (
            <tr key={action} style={{ borderTop: `1px solid ${hairline}` }}>
              <td style={{ padding: '6px 0' }}>{ACTION_LABELS[action]}</td>
              <td style={{ padding: '6px 0' }}>
                {recording === action ? (
                  <span style={{ color: accent }}>
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

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={resetNavigation}
          title="Browser shortcuts such as Ctrl+N or Ctrl+T cannot always be overridden. See docs/navigation.md."
          style={{ ...textButton, color: text, textDecoration: 'underline' }}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  )
}

/**
 * Renders the key chips for one action, or an "unbound" chip when it has none.
 * @param props - The sequences to show, the action label and the rebind handler.
 * @returns A row of clickable key chips.
 */
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
      <button type="button" aria-label={`Rebind ${label}`} onClick={onRebind} style={kbd}>
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
          style={kbd}
        >
          {describeSequence(sequence)}
        </button>
      ))}
    </>
  )
}
