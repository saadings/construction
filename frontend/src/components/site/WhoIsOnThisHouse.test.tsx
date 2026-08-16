// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { pick, useTheName } from '../../testing/pick'
import type { Claimed, Engaged, Named, NewBill, NewEngagement } from './WhoIsOnThisHouse'
import { WhoIsOnThisHouse } from './WhoIsOnThisHouse'

afterEach(cleanup)

// Akram out of the 199-M sheet, in the shape that sheet keeps him: agreed, billed once extra work landed, and paid.
const ENGAGED: Array<Engaged> = [
  {
    engagementId: 'e1',
    personName: 'A mason',
    tradeName: 'Civil labour',
    agreedPaisa: 300_000_00,
    billedPaisa: 340_000_00,
    paidPaisa: 325_000_00,
  },
  {
    engagementId: 'e2',
    personName: 'A tile fixer',
    tradeName: 'Tiles',
    ratePaisa: 45_00,
    unit: 'square foot',
    billedPaisa: 0,
    paidPaisa: 0,
  },
]

const CLAIMED: Array<Claimed> = [
  {
    _id: 'b1',
    day: '2026-04-21',
    amountPaisa: 340_000_00,
    personName: 'A mason',
    tradeName: 'Civil labour',
    reference: 'CH-12',
    description: 'Including the extra room',
  },
]

const PEOPLE: Array<Named> = [
  { _id: 'p1', name: 'A mason' },
  { _id: 'p2', name: 'A tile fixer' },
]

const TRADES: Array<Named> = [
  { _id: 't1', name: 'Civil labour' },
  { _id: 't2', name: 'Tiles' },
]

function renderWith(over: Partial<Parameters<typeof WhoIsOnThisHouse>[0]> = {}) {
  const onAgree = vi.fn<(engagement: NewEngagement) => Promise<boolean>>(() => Promise.resolve(true))
  const onRaise = vi.fn<(bill: NewBill) => Promise<boolean>>(() => Promise.resolve(true))
  const onTakeOut = vi.fn<(billId: string) => Promise<boolean>>(() => Promise.resolve(true))
  const onAddTrade = vi.fn<(trade: { name: string; countsAsBuildingCost: boolean }) => Promise<string>>(() =>
    Promise.resolve('t9')
  )

  render(
    <WhoIsOnThisHouse
      engaged={ENGAGED}
      claimed={CLAIMED}
      people={PEOPLE}
      trades={TRADES}
      saving={false}
      refusal={null}
      takingOut={null}
      onAgree={onAgree}
      onRaise={onRaise}
      onTakeOut={onTakeOut}
      onAddTrade={onAddTrade}
      {...over}
    />
  )

  return { onAgree, onRaise, onTakeOut, onAddTrade }
}

describe('who is on a house', () => {
  it('shows all three figures, because none of them can be worked out from the others', () => {
    // Agreed against billed is the extra work; billed against paid is the balance.
    renderWith()

    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('300,000')).toBeTruthy()
    expect(within(rows[0]).getByText('340,000')).toBeTruthy()
    expect(within(rows[0]).getByText('325,000')).toBeTruthy()
    // And what is still standing, which is the figure somebody is actually asked about.
    expect(within(rows[0]).getByText('15,000')).toBeTruthy()
  })

  it('reads a rate as the rate and what it is for, because the figure alone says nothing', () => {
    renderWith()

    expect(screen.getByText('45 a square foot')).toBeTruthy()
  })

  it('says what to do about a house nobody is down on yet', () => {
    renderWith({ engaged: [], claimed: [] })

    expect(screen.getByText(/Nobody is down on this house yet/)).toBeTruthy()
  })

  it('puts somebody on a trade with a whole figure', async () => {
    const user = userEvent.setup()
    const { onAgree } = renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    await pick(user, 'Who', 'A mason')
    await pick(user, 'Trade', 'Civil labour')
    fireEvent.change(screen.getByLabelText('What was agreed'), { target: { value: '300000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalledWith({
        personId: 'p1',
        tradeId: 't1',
        agreed: '300,000',
        rate: undefined,
        unit: undefined,
      })
    })
  })

  it('puts somebody on a trade with a rate instead, which is the other way it is agreed', async () => {
    const user = userEvent.setup()
    const { onAgree } = renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    await pick(user, 'Who', 'A tile fixer')
    await pick(user, 'Trade', 'Tiles')
    fireEvent.change(screen.getByLabelText('Or a rate'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('For each'), { target: { value: 'square foot' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalledWith({
        personId: 'p2',
        tradeId: 't2',
        agreed: undefined,
        rate: '45',
        unit: 'square foot',
      })
    })
  })

  it('takes a name for somebody the ledger has never met, on a house where that is the ordinary case', async () => {
    // A mason turning up on a site nobody has written down is not the exception here. Before this the picker offered only what was on the list, and the way round it was another screen and a form typed twice.
    const user = userEvent.setup()
    const { onAgree } = renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    await useTheName(user, 'Who', 'A new mason')
    await pick(user, 'Trade', 'Civil labour')
    fireEvent.change(screen.getByLabelText('What was agreed'), { target: { value: '300000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalled()
    })

    // The name goes as a name. Only the server can say whether it is somebody the ledger already has, because only the server can see everybody.
    expect(onAgree).toHaveBeenCalledWith(expect.objectContaining({ newPerson: 'A new mason' }))
    expect(onAgree.mock.calls[0][0]).not.toHaveProperty('personId')
  })

  it('lets a trade be added while somebody is being put on one, and asks what kind of cost it is', async () => {
    // The same picker as the day sheet's `What for`, reading the same list. A trade missing from it stops this form too, and the answer must be his rather than a default: the true ones added together are what the house cost.
    const user = userEvent.setup()
    const { onAddTrade } = renderWith()

    await user.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    await useTheName(user, 'Trade', 'Waterproofing')

    expect(onAddTrade).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Part of what the house cost is the answer it opens on, and it is the one he taps past rather than the one it assumes: nothing is sent until he sends it.
    expect(onAddTrade).toHaveBeenCalledWith({ name: 'Waterproofing', countsAsBuildingCost: true })
  })

  it('says nothing is missing about the figure once a rate has been put in instead', () => {
    renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    fireEvent.change(screen.getByLabelText('Or a rate'), { target: { value: '45' } })
    fireEvent.blur(screen.getByLabelText('What was agreed'))

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('takes a bill somebody has raised, with their own number on it', async () => {
    const user = userEvent.setup()
    const { onRaise } = renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Somebody has billed us' }))
    await pick(user, 'Who', 'A mason')
    await pick(user, 'Trade', 'Civil labour')
    fireEvent.change(screen.getByLabelText('Amount billed'), { target: { value: '340000' } })
    fireEvent.change(screen.getByLabelText('Their bill number'), { target: { value: 'CH-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(onRaise).toHaveBeenCalledWith(
        expect.objectContaining({ personId: 'p1', tradeId: 't1', amount: '340,000', reference: 'CH-12' })
      )
    })
  })

  it('asks a bill for nothing about rates, and an agreement for nothing about days', () => {
    // Two things that ask nearly the same questions, and neither asks the other's.
    renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Somebody has billed us' }))
    expect(screen.getByLabelText('Date')).toBeTruthy()
    expect(screen.queryByLabelText('Or a rate')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    expect(screen.getByLabelText('Or a rate')).toBeTruthy()
    expect(screen.queryByLabelText('Date')).toBeNull()
  })

  it('keeps the form open with what was typed when the server refused it', async () => {
    const user = userEvent.setup()
    renderWith({ refusal: 'Put in what was agreed, either a whole figure or a rate.' })

    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    await pick(user, 'Who', 'A mason')

    expect(screen.getByRole('alert').textContent).toBe('Put in what was agreed, either a whole figure or a rate.')
    // Said by the name rather than by the id it is stored under, because the control holds the row now rather than a string.
    expect(screen.getByLabelText<HTMLInputElement>('Who').value).toBe('A mason')
  })

  it('closes the form once it has gone in', async () => {
    const user = userEvent.setup()
    renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    await pick(user, 'Who', 'A mason')
    await pick(user, 'Trade', 'Civil labour')
    fireEvent.change(screen.getByLabelText('What was agreed'), { target: { value: '300000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))

    await waitFor(() => {
      expect(screen.queryByLabelText('Who')).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Put somebody on a trade' })).toBeTruthy()
  })

  it('leaves the form open when it did not go in, so nothing typed is lost', async () => {
    const user = userEvent.setup()
    const { onAgree } = renderWith()
    onAgree.mockResolvedValue(false)

    fireEvent.click(screen.getByRole('button', { name: 'Put somebody on a trade' }))
    await pick(user, 'Who', 'A mason')
    await pick(user, 'Trade', 'Civil labour')
    fireEvent.change(screen.getByLabelText('What was agreed'), { target: { value: '300000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }))

    await waitFor(() => {
      expect(onAgree).toHaveBeenCalled()
    })
    expect(screen.getByLabelText<HTMLInputElement>('What was agreed').value).toBe('300,000')
  })
})

describe('a bill that should not have been raised', () => {
  it('asks before it takes one out, because a bill cannot be put back from a screen', async () => {
    const { onTakeOut } = renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Remove 340,000 billed by A mason' }))
    expect(onTakeOut).not.toHaveBeenCalled()
    // Said plainly, because somebody disputing a bill is exactly the case the record is kept for.
    expect(screen.getByText('Remove this?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => {
      expect(onTakeOut).toHaveBeenCalledWith('b1')
    })
  })

  it('lets somebody change their mind without anything happening', () => {
    const { onTakeOut } = renderWith()

    fireEvent.click(screen.getByRole('button', { name: 'Remove 340,000 billed by A mason' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])

    expect(onTakeOut).not.toHaveBeenCalled()
  })

  it('reads a bill the way somebody would say it', () => {
    renderWith()

    // The day first and the month second, on a day past the twelfth so both orders cannot be read into it.
    const bill = screen.getByText('CH-12').parentElement
    expect(bill?.textContent).toContain('21/04/2026')
    expect(bill?.textContent).toContain('Civil labour')
    expect(bill?.textContent).toContain('Including the extra room')
  })

  it('keeps the cheque number in one piece, however narrow the screen is', () => {
    // Found in a picture and then found again in the next picture. This line was truncated, so at 390 it read `Civil labour · 27/06/2026 · CH…` -- two characters of the number, on the screen where somebody checks which cheque paid which bill, and the number is nowhere else on it.

    // Letting it wrap fixed that and made a second one: `CH-114` came out as `CH-` and `114`, because a browser breaks a line at a hyphen. A cheque number in two halves is no better than one in two characters.

    // Asserted as what holds each piece together rather than as where the line breaks, because nothing here lays anything out -- jsdom has no widths and `columns.ts` measures figures and cells rather than this. What can be asked is that every piece is inside something that refuses to break.
    renderWith()

    // Found from the cheque number, which is the one piece that appears once on the screen: the trade name is on the row above as well, and asking for it by text finds two.
    const line = screen.getByText('CH-12').parentElement
    const pieces = [...(line?.children ?? [])]

    expect(pieces.map((piece) => piece.textContent)).toEqual([
      'Civil labour',
      '21/04/2026',
      'CH-12',
      'Including the extra room',
    ])

    for (const piece of pieces) {
      expect(piece.className, `${String(piece.textContent)} can be broken across two lines`).toContain(
        'whitespace-nowrap'
      )
    }
  })
})

describe('while the readings are on their way', () => {
  it('puts up the shape of what is coming, and nothing for a house that is not there', () => {
    renderWith({ engaged: undefined, claimed: undefined })
    expect(screen.getByRole('status', { name: 'Getting who is on this house' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Getting what has been billed' })).toBeTruthy()

    cleanup()
    renderWith({ engaged: null, claimed: null })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('says nothing technical anywhere on it', () => {
    renderWith()

    expect(document.body.textContent).not.toMatch(/record|entity|paisa|query|database|engagement|null|undefined/i)
  })
})
