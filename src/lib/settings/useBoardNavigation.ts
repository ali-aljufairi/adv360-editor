import { useEffect, useMemo, useRef, useState } from 'react'
import type { PhysicalKey } from '../zmk/types'
import type { Action } from '../navigation/actions'
import { eventToToken, shouldHandleKeydown } from '../navigation/keys'
import { createSequenceMatcher, type MatchResult, type SequenceMatcher } from '../navigation/matcher'
import {
  first,
  last,
  nextKey,
  orderNext,
  orderPrev,
  rowEnd,
  rowStart,
  type Direction,
} from '../navigation/spatial'
import { resolveBindings, usesCounts } from '../navigation/schemes'
import { useSettings } from './context'

/** Inputs to {@link useBoardNavigation}. */
export interface BoardNavigationOptions {
  /** Physical keys in binding order; `selected` indexes this array. */
  keys: PhysicalKey[]
  /** Index of the selected key, or -1 for none. */
  selected: number
  /** Called when a movement action changes the selection. */
  onSelect: (index: number) => void
  /** Called for every matched action, including movement, after the selection has moved. */
  onAction?: (action: Action, count: number) => void
  /** Set to false to stop listening, for example while a modal owns the keyboard. */
  enabled?: boolean
}

/** What the board navigation reports back for display. */
export interface BoardNavigationState {
  /** Partial sequence or count typed so far, empty when idle. */
  pending: string
  /** The most recent matched action. */
  lastAction: Action | null
}

const DIRECTION_OF: Partial<Record<Action, Direction>> = {
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
}

/** Pending sequences that never complete are dropped after this long. */
const FLUSH_DELAY_MS = 800

/**
 * Listens on `window` for keydown and turns matched sequences into board actions. Movement
 * actions move the selection through `onSelect`; every action is also reported via `onAction`.
 * Keys are ignored inside text fields, inside contenteditable regions and while a dialog holds
 * focus. Must be used inside a SettingsProvider.
 */
export function useBoardNavigation(options: BoardNavigationOptions): BoardNavigationState {
  const { settings } = useSettings()
  const { scheme, arrowsAlwaysOn, wrap, custom } = settings.navigation
  const enabled = options.enabled ?? true

  const matcher = useMemo<SequenceMatcher>(() => {
    const bindings = resolveBindings(scheme, custom, { arrowsAlwaysOn })
    return createSequenceMatcher(bindings, { counts: usesCounts(scheme) })
  }, [scheme, custom, arrowsAlwaysOn])

  const latest = useRef(options)
  latest.current = options
  const [pending, setPending] = useState('')
  const [lastAction, setLastAction] = useState<Action | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined
    let flushTimer: ReturnType<typeof setTimeout> | undefined

    const cancelFlush = () => {
      if (flushTimer !== undefined) clearTimeout(flushTimer)
      flushTimer = undefined
    }

    const finish = (result: MatchResult) => {
      if (result.kind !== 'match') return
      setLastAction(result.action)
      setPending('')
      runAction(result.action, result.count, latest.current, wrap)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandleKeydown(event)) return
      const token = eventToToken(event)
      if (!token) return
      const result = matcher.feed(token, event.timeStamp)
      if (result.kind === 'pending') {
        event.preventDefault()
        setPending(matcher.pending())
        cancelFlush()
        flushTimer = setTimeout(() => {
          flushTimer = undefined
          finish(matcher.flush())
        }, FLUSH_DELAY_MS)
        return
      }
      cancelFlush()
      if (result.kind === 'none') {
        setPending('')
        return
      }
      event.preventDefault()
      finish(result)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      cancelFlush()
      window.removeEventListener('keydown', onKeyDown)
      matcher.reset()
    }
  }, [enabled, matcher, wrap])

  return { pending, lastAction }
}

/** Applies a matched action to the selection and forwards it to `onAction`. */
function runAction(
  action: Action,
  count: number,
  current: BoardNavigationOptions,
  wrap: boolean,
): void {
  const { keys, selected, onSelect, onAction } = current
  const moveOpts = { wrap }
  const direction = DIRECTION_OF[action]
  if (keys.length > 0) {
    let index = selected
    if (direction) {
      for (let repeat = 0; repeat < count; repeat += 1) {
        index = nextKey(keys, index, direction, moveOpts)
      }
    } else if (action === 'next' || action === 'prev') {
      const stepOrder = action === 'next' ? orderNext : orderPrev
      for (let repeat = 0; repeat < count; repeat += 1) {
        index = stepOrder(keys, index, moveOpts)
      }
    } else if (action === 'first') {
      index = first(keys)
    } else if (action === 'last') {
      index = last(keys)
    } else if (action === 'rowStart') {
      index = rowStart(keys, index)
    } else if (action === 'rowEnd') {
      index = rowEnd(keys, index)
    }
    if (index !== selected && index >= 0) onSelect(index)
  }
  onAction?.(action, count)
}
