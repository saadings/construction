// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SpentByTrade } from './SpentByTrade'

afterEach(cleanup)

// The figures a client site shows are the ones pass 4 works out, so what is tested here is that the screen shows them rather than that the sums are right.

describe('what a house was spent on', () => {
  const cement = { tradeId: 't1', name: 'Cement', paisa: 859_280_00 }
  const bricks = { tradeId: 't2', name: 'Bricks', paisa: 786_000_00 }

  it('reads every trade with its figure', () => {
    render(<SpentByTrade byTrade={[cement, bricks]} />)

    expect(screen.getByText('Cement')).toBeTruthy()
    expect(screen.getByText('859,280')).toBeTruthy()
    expect(screen.getByText('Bricks')).toBeTruthy()
  })

  it('says so plainly when nothing has been spent', () => {
    render(<SpentByTrade byTrade={[]} />)

    expect(screen.getByText('Nothing spent on this house yet.')).toBeTruthy()
  })

  it('sets every figure in the face that makes a column read as a column', () => {
    // Without `tabular-nums` a column of amounts is a list of different-width strings, which is the whole reason the mono face is here.
    render(<SpentByTrade byTrade={[cement, bricks]} />)

    for (const shown of ['859,280', '786,000']) {
      expect(screen.getByText(shown).className).toContain('font-mono')
      expect(screen.getByText(shown).className).toContain('tabular-nums')
    }
  })

  it('lets a wide table scroll inside itself rather than pushing the page sideways', () => {
    // A phone is narrower than this table. The page must not gain a horizontal scrollbar because of it.
    const { container } = render(<SpentByTrade byTrade={[cement, bricks]} />)

    expect(container.querySelector('.overflow-x-auto')).not.toBeNull()
  })

  it('shows money going out in brass, which is what brass means everywhere', () => {
    render(<SpentByTrade byTrade={[cement]} />)

    expect(screen.getByText('859,280').className).toContain('text-brass')
  })
})
