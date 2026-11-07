import type { ReactNode } from 'react'
import { useEditor } from '../../lib/editor-state'
import { SyncProvider } from '../../lib/github-sync'
import { ADV360_PROFILE } from '../../lib/profile/registry'

/**
 * Connects the GitHub sync store to the editor: whatever GitHub loads becomes the editor's
 * baseline. Must sit inside EditorProvider.
 * @param props - The subtree that needs sync state.
 * @returns The sync provider around the children.
 */
export function SyncBridge({ children }: { children: ReactNode }) {
  const { load, getSnapshot } = useEditor()
  return (
    <SyncProvider
      isDirty={() => getSnapshot().dirty}
      onLoaded={(files) => load(files, ADV360_PROFILE)}
    >
      {children}
    </SyncProvider>
  )
}
