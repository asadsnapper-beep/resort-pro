/**
 * An uploaded or AI-generated theme package may legitimately ask for
 * `about.layout: 'centered'`. Until this test existed, that layout took an
 * early return with its own inline copy of the eyebrow/heading/text markup and
 * never touched the block that rendered `about.bullets` — so a theme that
 * shipped bullets had them dropped from the DOM on that one layout, with no
 * error anywhere. The theme author just saw their content vanish.
 *
 * Confirmed empirically on 2026-10-29 against a throwaway database: with
 * `showBullets: true` and one bullet, `image-right` put the bullet in the
 * rendered DOM and `centered` did not.
 *
 * Every layout in AboutLayout is covered below, because the bug was not about
 * `centered` being special — it was about the markup being duplicated per
 * layout, so any layout that forgets to render the shared piece loses it.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ConfigAbout } from './ConfigAbout'
import { mergeConfig, type AboutLayout } from '../config-types'
import type { ResortData } from '../../types'

afterEach(cleanup)

const data: ResortData = {
  tenant: {
    name:         'Sea Pearl',
    slug:         'sea-pearl',
    currency:     'BDT',
    checkInTime:  '14:00',
    checkOutTime: '11:00',
  },
  website: {
    heroTitle: 'Sea Pearl',
    aboutText: 'A quiet stretch of beach.',
  },
  rooms: [],
}

const BULLET = 'Private beach access'

const renderAbout = (layout: AboutLayout) =>
  render(
    <ConfigAbout
      data={data}
      config={mergeConfig({
        about: { layout, showBullets: true, bullets: [BULLET] },
      })}
    />,
  )

const LAYOUTS: AboutLayout[] = ['image-right', 'image-left', 'centered']

describe('ConfigAbout bullets', () => {
  it.each(LAYOUTS)('renders the configured bullets on the %s layout', (layout) => {
    renderAbout(layout)
    expect(screen.getByText(BULLET)).toBeTruthy()
  })

  it('renders no bullets when showBullets is off', () => {
    render(
      <ConfigAbout
        data={data}
        config={mergeConfig({
          about: { layout: 'centered', showBullets: false, bullets: [BULLET] },
        })}
      />,
    )
    expect(screen.queryByText(BULLET)).toBeNull()
  })
})
