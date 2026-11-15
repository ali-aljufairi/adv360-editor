import type { Issue } from '../../lib/zmk/types'

/** Named problem sets the dev pages can show, selected with `?problems=`. */
export const PROBLEM_STATES = ['none', 'one', 'mixed', 'many', 'long'] as const
export type ProblemState = (typeof PROBLEM_STATES)[number]

const MIXED: Issue[] = [
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

const ONE: Issue[] = [MIXED[0]]

const LONG: Issue[] = [
  {
    file: 'combos.dtsi',
    start: 300,
    end: 340,
    code: 'combo-name',
    severity: 'error',
    message:
      'Combo combo_studio_unlock_really_long_name_without_spaces uses key position 44, which is past the end of this keyboard layout and cannot be pressed.',
    layer: 1,
    key: 44,
  },
  {
    file: 'base.keymap',
    start: 900,
    end: 940,
    code: 'unknown-macro',
    severity: 'error',
    message:
      'Macro “&macro_very_long_unbroken_identifier_for_testing_wrapping_in_narrow_panels” is not defined in macros.dtsi or in this keymap.',
    layer: 0,
    key: 7,
  },
  {
    file: 'macros.dtsi',
    start: 12,
    end: 48,
    code: 'unused-macro',
    severity: 'info',
    message: 'Macro mac_unused_helper_with_a_long_identifier_and_no_spaces_at_all is never used.',
  },
  {
    file: 'behaviors.dtsi',
    start: 600,
    end: 660,
    code: 'hold-tap-timing',
    severity: 'warning',
    message:
      'Hold-tap behaviour hm_left_index_with_a_quite_long_label_name has tapping-term-ms 0 and will never resolve as a hold.',
    layer: 2,
    key: 3,
  },
]

const MANY: Issue[] = Array.from({ length: 36 }, (_, index) => {
  const severity = (['error', 'warning', 'info'] as const)[index % 3]
  const layer = index % 4
  const key = (index * 7) % 40
  return {
    file: index % 5 === 0 ? 'combos.dtsi' : 'base.keymap',
    start: 100 + index * 40,
    end: 120 + index * 40,
    code: `check-${index}`,
    severity,
    message:
      index % 4 === 0
        ? `Binding ${index} on layer ${layer} refers to a behaviour that is not defined in this firmware.`
        : `Binding ${index} on layer ${layer} needs review.`,
    layer,
    key,
  }
})

const SETS: Record<ProblemState, Issue[]> = {
  none: [],
  one: ONE,
  mixed: MIXED,
  many: MANY,
  long: LONG,
}

/**
 * Sample problems for a dev state. Unknown names fall back to the mixed set.
 * @param state The named set to show.
 * @returns The issues for that state.
 */
export function problemFixture(state: ProblemState): Issue[] {
  return SETS[state]
}
