// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { everythingKeptUnder, keepOnThisDevice } from '../../lib/keptOnThisDevice'
import { anEmptyDraft } from './sitting'
import type { Draft } from './sitting'
import { howManyAreWaiting, whatIsStillWaiting, whereASittingIsKept } from './theSittingKept'

// What has been typed on this device and has not gone in, across every house and every day.

// The unposted work that gets lost is by definition on the house nobody is looking at, so a count scoped to the house on the screen sits at nought in exactly the case it exists for.

afterEach(() => {
  window.localStorage.clear()
})

// The ids are what the ledger's own are, stood in for. A `Draft` carries branded ids and nothing here is talking to a deployment, so they are cast at the one place they enter rather than at each use.
const A_TRADE = 't1' as Draft['tradeId']
const A_PERSON = 'p1' as Draft['paidToId']

function aLine(over: Partial<Draft> = {}): Draft {
  return anEmptyDraft({ tradeId: A_TRADE, paidToId: A_PERSON, amount: '25,000', ...over })
}

function keep(siteId: string, day: string, done: Array<Draft>, draft: Draft = anEmptyDraft()) {
  keepOnThisDevice(whereASittingIsKept(siteId, day), { done, draft })
}

describe('what has not gone in yet', () => {
  it('finds every house and every day, not the one being looked at', () => {
    keep('s1', '2026-07-23', [aLine()])
    keep('s2', '2026-07-11', [aLine(), aLine({ amount: '10,000' })])

    expect(whatIsStillWaiting().map((one) => [one.siteId, one.day, one.entries])).toEqual([
      // Oldest first: the one furthest from being remembered is the one worth saying first.
      ['s2', '2026-07-11', 2],
      ['s1', '2026-07-23', 1],
    ])
  })

  it('counts entries rather than sittings, which is the thing that can be lost', () => {
    // Three payments typed against one house is one key holding three rows. `3 have not gone in` names the loss; `1 sitting` names a word he has never seen.
    keep('s1', '2026-07-23', [aLine(), aLine({ amount: '10,000' }), aLine({ amount: '5,000' })])

    expect(howManyAreWaiting(whatIsStillWaiting())).toBe(3)
  })

  it('adds up what is at risk on each of them', () => {
    keep('s1', '2026-07-23', [aLine(), aLine({ amount: '10,000' })])

    expect(whatIsStillWaiting()[0].paisa).toBe(35_000_00)
  })

  it('counts the line still in the boxes when it carries an amount', () => {
    // The line the keeping exists for: typed in full and left when the phone locked, and the one he is least likely to remember.
    keep('s1', '2026-07-23', [], aLine())

    expect(howManyAreWaiting(whatIsStillWaiting())).toBe(1)
  })

  it('says nothing about a keystroke', () => {
    // A picked category and nothing else would otherwise be `1 waiting, 0` -- a badge shouting about a touch, and a row in the list with a nought where the figure goes.
    keep('s1', '2026-07-23', [], anEmptyDraft({ tradeId: A_TRADE }))

    expect(whatIsStillWaiting()).toEqual([])
  })

  it('is not fooled by anything else kept on the device', () => {
    // `howItLooks` is kept under the same store. A sweep by prefix that took everything would count the theme as unposted work.
    window.localStorage.setItem('howItLooks', 'dark')
    keep('s1', '2026-07-23', [aLine()])

    expect(whatIsStillWaiting()).toHaveLength(1)
    expect(everythingKeptUnder('sitting:')).toHaveLength(1)
  })

  it('ignores a key that is not a sitting, and one whose name says nothing', () => {
    // Left behind by an older shape of this app, or half-written when the tab died. Unreadable is the same as nothing, and it must never be the reason a badge throws.
    window.localStorage.setItem('sitting:broken', '{ this is not json')
    window.localStorage.setItem('sitting:', JSON.stringify({ done: [aLine()], draft: anEmptyDraft() }))
    keep('s1', '2026-07-23', [aLine()])

    expect(whatIsStillWaiting().map((one) => one.siteId)).toEqual(['s1'])
  })

  it('says nothing at all when nothing is waiting', () => {
    // The badge's resting state, and the one it is in on almost every day. A count that is never nought is a count nobody reads.
    expect(whatIsStillWaiting()).toEqual([])
    expect(howManyAreWaiting([])).toBe(0)
  })
})
