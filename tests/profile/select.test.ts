import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProfileMenuList, ProfileSelect } from '../../src/components/github/ProfileSelect'
import { ADV360_PROFILE } from '../../src/lib/profile/registry'
import type { KeyboardProfile } from '../../src/lib/profile/types'

const second: KeyboardProfile = { ...ADV360_PROFILE, id: 'second', name: 'Second keyboard' }
const switchOk = () => ({ ok: true as const })

describe('ProfileSelect', () => {
  it('renders nothing with a single profile', () => {
    const html = renderToStaticMarkup(
      createElement(ProfileSelect, {
        profiles: [ADV360_PROFILE],
        activeProfile: ADV360_PROFILE,
        setActiveProfile: switchOk,
        status: null,
      }),
    )
    expect(html).toBe('')
  })

  it('shows the active profile name and the pending status with two profiles', () => {
    const html = renderToStaticMarkup(
      createElement(ProfileSelect, {
        profiles: [ADV360_PROFILE, second],
        activeProfile: second,
        setActiveProfile: switchOk,
        status: 'Loading Second keyboard…',
      }),
    )
    expect(html).toContain('Second keyboard</button>')
    expect(html).toContain('Loading Second keyboard…')
  })
})

describe('ProfileMenuList', () => {
  it('lists every profile and marks only the active one as checked', () => {
    const html = renderToStaticMarkup(
      createElement(ProfileMenuList, {
        profiles: [ADV360_PROFILE, second],
        activeId: ADV360_PROFILE.id,
        onChoose: () => undefined,
      }),
    )
    expect(html.match(/role="menuitemradio"/g)).toHaveLength(2)
    expect(html).toContain(`>${ADV360_PROFILE.name}</button>`)
    expect(html).toContain(`>${second.name}</button>`)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
  })
})
