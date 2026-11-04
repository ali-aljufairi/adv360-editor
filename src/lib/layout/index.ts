export * from './types'
export * from './qmk-info-json'
export * from './zmk-dts'

import type { ProfileLayoutSource } from '../profile/types'
import type { LayoutSource } from './types'
import { qmkInfoJsonLayoutSource } from './qmk-info-json'
import { zmkDtsLayoutSource } from './zmk-dts'

/** Return the implemented source adapter for a profile layout source. */
export function getLayoutSource(source: ProfileLayoutSource): LayoutSource {
  if (source === 'qmk-info-json') return qmkInfoJsonLayoutSource
  if (source === 'zmk-dts') return zmkDtsLayoutSource
  throw new Error(`Layout source ${source} is not supported yet`)
}
