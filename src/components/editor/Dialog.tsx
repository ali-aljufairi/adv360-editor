import { useRef, type ReactNode } from 'react'
import { useFocusTrap } from '../panels/useFocusTrap'
import { ACTIONS, ACTION_LABELS } from '../../lib/navigation/actions'
import { describeSequence } from '../../lib/navigation/keys'
import { resolveBindings, type CustomBindings, type SchemeName } from '../../lib/navigation/schemes'
import { NavigationSettings } from '../settings/NavigationSettings'
import { SidePanel } from './SidePanel'
import { isPlatformSetting, type PlatformSetting } from '../../lib/keycodes/platform'

/** Props for a centred modal dialog. */
export interface DialogProps {
  title: string
  onClose(): void
  children: ReactNode
}

/**
 * A modal dialog with a scrim. Focus is trapped inside it, and Escape or the scrim closes it.
 * @param props - Title, close handler and content.
 * @returns The dialog.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  useFocusTrap(panel, true, onClose)
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl rounded-xl border border-subtle bg-raised p-5 text-primary shadow-[var(--shadow-float)]"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-secondary hover:bg-hover"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Props for the settings dialog. */
export interface SettingsDialogProps {
  platform: PlatformSetting
  onPlatform(platform: PlatformSetting): void
  onClose(): void
}

/**
 * Settings: navigation scheme and options, plus the platform used for shortcut labels.
 * Rendered as a docked side panel rather than a modal.
 * @param props - The current platform, its setter and the close handler.
 * @returns The settings panel.
 */
export function SettingsDialog({ platform, onPlatform, onClose }: SettingsDialogProps) {
  return (
    <SidePanel title="Settings" onClose={onClose}>
      <div className="space-y-6 p-4">
        <NavigationSettings />
        <section aria-labelledby="platform-heading" className="space-y-2">
          <h3 id="platform-heading" className="text-sm font-semibold">
            Platform
          </h3>
          <label className="flex items-center justify-between gap-3 text-sm text-secondary">
            Shortcut labels
            <select
              value={platform}
              onChange={(event) => {
                if (isPlatformSetting(event.target.value)) onPlatform(event.target.value)
              }}
              className="rounded-md border border-subtle bg-canvas px-2 py-1 text-primary"
            >
              <option value="auto">Auto-detect</option>
              <option value="mac">macOS</option>
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
            </select>
          </label>
        </section>
      </div>
    </SidePanel>
  )
}

/** Props for the keyboard cheat sheet. */
export interface CheatSheetProps {
  scheme: SchemeName
  custom: CustomBindings
  arrowsAlwaysOn: boolean
  onClose(): void
}

/**
 * Lists every board action with the keys that trigger it in the active navigation scheme.
 * @param props - The active scheme and its custom sequences.
 * @returns The cheat-sheet dialog.
 */
export function CheatSheet({ scheme, custom, arrowsAlwaysOn, onClose }: CheatSheetProps) {
  const bindings = resolveBindings(scheme, custom, { arrowsAlwaysOn })
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <p className="mb-3 text-sm text-secondary">
        Scheme: <span className="font-medium text-primary">{scheme}</span>. Digits 1–4 pick a layer
        in the arrows and emacs schemes. ⌘K opens themes.
      </p>
      <table className="w-full text-sm">
        <tbody>
          {ACTIONS.map((action) => (
            <tr key={action} className="border-t border-subtle">
              <th scope="row" className="py-1.5 pr-3 text-left font-normal text-secondary">
                {ACTION_LABELS[action]}
              </th>
              <td className="py-1.5 text-right font-mono text-xs text-primary">
                {(bindings[action] ?? [])
                  .map((sequence) => describeSequence(sequence))
                  .join(' · ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  )
}
