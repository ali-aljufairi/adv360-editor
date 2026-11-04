import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ChangesPill } from '../components/panels/ChangesPill'
import { ChangesSheet } from '../components/panels/ChangesSheet'
import { ProblemsPanel } from '../components/panels/ProblemsPanel'
import { ThemePicker } from '../components/theme-picker/ThemePicker'
import type { Issue } from '../lib/zmk/types'

export const Route = createFileRoute('/dev/panels')({ component: PanelsPage })

const SAMPLE_ISSUES: Issue[] = [
  {
    file: 'base.keymap',
    start: 1204,
    end: 1212,
    code: 'unknown-behavior',
    severity: 'error',
    message: 'Behavior &kpp is not known to this firmware. Did you mean &kp?',
    layer: 0,
    key: 12,
  },
  {
    file: 'base.keymap',
    start: 2310,
    end: 2320,
    code: 'duplicate-binding',
    severity: 'warning',
    message: 'Key 30 is bound twice on the Mod layer. Only the first binding will work.',
    layer: 2,
    key: 30,
  },
  {
    file: 'combos.dtsi',
    start: 88,
    end: 120,
    code: 'combo-overlap',
    severity: 'warning',
    message: 'Combo “Dfffsdfa” shares both keys with another combo.',
  },
  {
    file: 'base.keymap',
    start: 4100,
    end: 4110,
    code: 'empty-layer',
    severity: 'info',
    message: 'Layer “Mouse” has no bindings yet, so it falls through to the layer below.',
    layer: 3,
  },
]

const SAMPLE_DIFF: Record<string, string> = {
  'base.keymap': [
    'diff --git a/base.keymap b/base.keymap',
    '--- a/base.keymap',
    '+++ b/base.keymap',
    '@@ -10,5 +10,5 @@',
    '  bindings = <',
    '-&kp CAPS',
    '+&kp ESC',
    '   &kp A &kp S',
    '   &kp D &kp F',
    ' >;',
  ].join('\n'),
  'combos.dtsi': [
    'diff --git a/combos.dtsi b/combos.dtsi',
    '--- a/combos.dtsi',
    '+++ b/combos.dtsi',
    '@@ -4,3 +4,4 @@',
    ' combo_a {',
    '-key-positions = <1 2>;',
    '+key-positions = <1 2 3>;',
    '+timeout-ms = <30>;',
    ' };',
  ].join('\n'),
}

const SAMPLE_SUMMARY = [
  'Base · key 12: Caps → Esc',
  'Combos · “Dfffsdfa” now uses three keys and a 30 ms timeout',
]

/**
 * Dev-only page that shows the problems list, the changes pill and sheet, and the theme picker
 * with sample data. Cmd-K (or Ctrl-K) opens the theme picker, as the page owns that shortcut.
 * @returns The panels demo page.
 */
function PanelsPage() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [diff, setDiff] = useState(SAMPLE_DIFF)
  const [summary, setSummary] = useState(SAMPLE_SUMMARY)
  const [jumped, setJumped] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPickerOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const discard = () => {
    setDiff({})
    setSummary([])
    setSheetOpen(false)
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-10 text-primary">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted">Dev · panels</p>
          <h1 className="text-2xl font-semibold">Problems, changes and themes</h1>
          <p className="text-sm text-secondary">
            Sample data only. Press ⌘K or Ctrl-K to open the theme picker.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-secondary">Problems</h2>
          <ProblemsPanel
            issues={SAMPLE_ISSUES}
            onJump={(issue) => setJumped(`${issue.file}: ${issue.message}`)}
          />
          <p className="text-xs text-muted" aria-live="polite">
            {jumped ? `Last jump: ${jumped}` : 'No jump yet.'}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-secondary">Changes</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setDiff(SAMPLE_DIFF)
                setSummary(SAMPLE_SUMMARY)
              }}
              className="rounded-lg border border-subtle px-3 py-1.5 text-sm text-secondary hover:text-primary"
            >
              Reset sample changes
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-lg border border-subtle px-3 py-1.5 text-sm text-secondary hover:text-primary"
            >
              Open theme picker
            </button>
          </div>
          <p className="text-xs text-muted">
            The pill appears at the bottom of the screen while there are changes.
          </p>
        </section>

        <ThemePicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

        {sheetOpen && (
          <ChangesSheet
            diff={diff}
            summary={summary}
            onClose={() => setSheetOpen(false)}
            onDiscard={discard}
          />
        )}
        <ChangesPill count={summary.length} onOpen={() => setSheetOpen(true)} />
      </div>
    </main>
  )
}
