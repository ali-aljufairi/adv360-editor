import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useEditor } from '../editor-state'
import { profileRegistry } from './registry'
import type { KeyboardProfile } from './types'

/** Result of attempting to switch keyboard profiles. */
export type ProfileSwitchResult = { ok: true } | { ok: false; reason: 'dirty' | 'unknown-profile' }

/** Profile selection exposed to the keyboard selector. */
export interface ActiveProfileContext {
  profiles: readonly KeyboardProfile[]
  activeProfile: KeyboardProfile
  setActiveProfile(id: string, options?: { discard?: boolean }): ProfileSwitchResult
}

/** Check whether a requested profile switch is safe. */
export function checkProfileSwitch(
  profiles: readonly KeyboardProfile[],
  currentId: string,
  nextId: string,
  dirty: boolean,
  discard = false,
): ProfileSwitchResult {
  if (!profiles.some((profile) => profile.id === nextId))
    return { ok: false, reason: 'unknown-profile' }
  if (currentId !== nextId && dirty && !discard) return { ok: false, reason: 'dirty' }
  return { ok: true }
}

const Context = createContext<ActiveProfileContext | null>(null)
const storageKey = 'adv360-editor:active-profile'

/** Provide browser-persisted profile selection inside the editor provider. */
export function ActiveProfileProvider({ children }: { children: ReactNode }) {
  const editor = useEditor()
  const [activeProfile, setProfile] = useState(editor.profile)
  const setActiveProfile = (id: string, options?: { discard?: boolean }): ProfileSwitchResult => {
    const result = checkProfileSwitch(
      profileRegistry.profiles,
      activeProfile.id,
      id,
      editor.getSnapshot().dirty,
      options?.discard,
    )
    if (!result.ok) return result
    const next = profileRegistry.profiles.find((profile) => profile.id === id)!
    if (next.id === activeProfile.id) return result
    if (editor.getSnapshot().dirty) editor.reset()
    setProfile(next)
    try {
      window.localStorage.setItem(storageKey, id)
    } catch {
      /* Storage is optional. */
    }
    return { ok: true }
  }
  useEffect(() => {
    try {
      const id = window.localStorage.getItem(storageKey)
      if (id) setActiveProfile(id)
    } catch {
      /* Storage is optional. */
    }
    // Restore once after hydration; do not overwrite a user's subsequent selection.
  }, [])
  return (
    <Context.Provider
      value={{ profiles: profileRegistry.profiles, activeProfile, setActiveProfile }}
    >
      {children}
    </Context.Provider>
  )
}

/** Read available profiles and switch the active profile. */
export function useActiveProfile(): ActiveProfileContext {
  const context = useContext(Context)
  if (!context) throw new Error('useActiveProfile must be used inside ActiveProfileProvider')
  return context
}
