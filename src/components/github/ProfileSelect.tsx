import { useEffect, useRef, useState } from 'react'
import type { ActiveProfileContext } from '../../lib/profile/active'
import type { KeyboardProfile } from '../../lib/profile/types'

/** Props for the keyboard selector. Plain data and the switch action only. */
export interface ProfileSelectProps {
  profiles: ActiveProfileContext['profiles']
  activeProfile: KeyboardProfile
  setActiveProfile: ActiveProfileContext['setActiveProfile']
  /** Muted text shown after the selector, such as a pending load; null hides it. */
  status: string | null
}

/**
 * The keyboard name as a text button that opens a menu of profiles. Renders nothing when there
 * is only one profile, so the single-keyboard header stays as it was.
 * @param props - The profile list, the active profile, the switch action and the status line.
 * @returns The selector and its menu, or null.
 */
export function ProfileSelect({
  profiles,
  activeProfile,
  setActiveProfile,
  status,
}: ProfileSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (profiles.length <= 1) return null
  const choose = (id: string) => {
    setOpen(false)
    if (id === activeProfile.id) return
    const result = setActiveProfile(id)
    if (result.ok || result.reason !== 'dirty') return
    if (window.confirm('Discard unsaved edits and switch keyboard?'))
      setActiveProfile(id, { discard: true })
  }
  return (
    <div ref={rootRef} className="relative flex items-baseline gap-2">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="px-1 py-1 text-sm text-secondary hover:text-primary"
      >
        {activeProfile.name}
      </button>
      {status ? <span className="text-sm text-muted">{status}</span> : null}
      {open ? (
        <ProfileMenuList profiles={profiles} activeId={activeProfile.id} onChoose={choose} />
      ) : null}
    </div>
  )
}

/**
 * The open profile menu, placed below the header. The active profile is bold and marked checked.
 * @param props - The profiles, the active id and the choose handler.
 * @returns The menu element.
 */
export function ProfileMenuList({
  profiles,
  activeId,
  onChoose,
}: {
  profiles: ActiveProfileContext['profiles']
  activeId: string
  onChoose(id: string): void
}) {
  return (
    <div
      role="menu"
      className="absolute left-0 top-full z-30 mt-1 flex min-w-44 flex-col border border-subtle bg-raised py-1 text-sm"
    >
      {profiles.map((profile) => {
        const active = profile.id === activeId
        return (
          <button
            key={profile.id}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => onChoose(profile.id)}
            className={`px-3 py-1.5 text-left hover:text-primary ${active ? 'font-semibold text-primary' : 'text-secondary'}`}
          >
            {profile.name}
          </button>
        )
      })}
    </div>
  )
}
