import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BehaviorsDrawer } from '../components/behaviors/BehaviorsDrawer'
import { EditorProvider, loadFixtureFiles, useEditor } from '../lib/editor-state'
import { ADV360_PROFILE } from '../lib/profile/registry'

export const Route = createFileRoute('/dev/behaviors')({ component: BehaviorsPage })

/** Bundled Adv360 fixture files, shared by every render of this dev page. */
const FIXTURE_FILES = loadFixtureFiles()

/**
 * Dev-only page: the Behaviors drawer over the bundled Adv360 fixture, with a count of pending
 * changes so edits can be checked against the store.
 * @returns The dev page.
 */
function BehaviorsPage() {
  return (
    <EditorProvider initialFiles={FIXTURE_FILES} profile={ADV360_PROFILE}>
      <Demo />
    </EditorProvider>
  )
}

function Demo() {
  const editor = useEditor()
  const [open, setOpen] = useState(true)
  return (
    <div className="min-h-dvh bg-canvas p-6 text-primary">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Behaviors (dev)</h1>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-subtle px-2.5 py-1 text-sm hover:bg-hover"
        >
          Behaviors
        </button>
        <span className="text-sm text-muted">
          {editor.dirty ? `${editor.summary().length} pending change(s)` : 'No pending changes'}
        </span>
        <button
          type="button"
          onClick={() => editor.reset()}
          disabled={!editor.dirty}
          className="rounded-md px-2.5 py-1 text-sm text-secondary hover:bg-hover disabled:opacity-40"
        >
          Reset to fixture
        </button>
      </div>
      <ul className="mt-4 list-disc pl-5 font-mono text-xs text-secondary">
        {editor.summary().map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <BehaviorsDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
