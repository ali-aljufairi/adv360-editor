import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Keep keyboard focus inside a dialog while it is open, close it on Escape, and restore focus to
 * the element that was focused before it opened.
 * @param ref The dialog element.
 * @param open Whether the dialog is open.
 * @param onEscape Called when Escape is pressed while the dialog is open.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onEscape: () => void,
): void {
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  useEffect(() => {
    if (!open) return
    const root = ref.current
    const previous = document.activeElement as HTMLElement | null
    const focusables = () =>
      root ? Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)) : []
    focusables()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        escapeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement
      if (event.shiftKey && (current === first || !root?.contains(current))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (current === last || !root?.contains(current))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, ref])
}
