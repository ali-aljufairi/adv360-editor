import { createFileRoute } from '@tanstack/react-router'
import { EditorPage } from '../components/editor/EditorPage'
import { SyncBridge } from '../components/github/SyncBridge'
import { EditorProvider, loadFixtureFiles } from '../lib/editor-state'
import { SettingsProvider } from '../lib/settings/context'
import { ADV360_PROFILE } from '../lib/profile/registry'

export const Route = createFileRoute('/')({ component: Home })

/** Bundled Adv360 configuration, shown until GitHub loads the signed-in repository. */
const FIXTURE_FILES = loadFixtureFiles()

/**
 * The editor at `/`: settings and the editor store wrap the GitHub sync and the board-first page.
 * @returns The editor route.
 */
function Home() {
  return (
    <SettingsProvider>
      <EditorProvider initialFiles={FIXTURE_FILES} profile={ADV360_PROFILE}>
        <SyncBridge>
          <EditorPage />
        </SyncBridge>
      </EditorProvider>
    </SettingsProvider>
  )
}
