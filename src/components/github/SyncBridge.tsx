import type { ReactNode } from 'react'
import { useEditor } from '../../lib/editor-state'
import { SyncProvider } from '../../lib/github-sync'
import { useActiveProfile } from '../../lib/profile/active'

/**
 * Connects the GitHub sync store to the editor: whatever GitHub loads becomes the editor's
 * baseline. Must sit inside EditorProvider.
 * @param props - The subtree that needs sync state.
 * @returns The sync provider around the children.
 */
export function SyncBridge({ children }: { children: ReactNode }) {
  const { load, getSnapshot } = useEditor()
  const { activeProfile } = useActiveProfile()
  return (
    <SyncProvider
      key={activeProfile.id}
      profile={activeProfile}
      isDirty={() => getSnapshot().dirty}
      onLoaded={(files) => {
        const editor = getSnapshot()
        if (editor.profile.id !== activeProfile.id && editor.dirty)
          throw new Error('Profile changed while the editor has unsaved changes')
        load(files, activeProfile)
      }}
    >
      {children}
    </SyncProvider>
  )
}
