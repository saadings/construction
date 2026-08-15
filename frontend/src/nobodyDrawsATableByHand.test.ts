// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'
import { tagsWrittenIn } from './testing/tags'

// Nauman: "everything should be done in shadcn ui".

// Four screens had each drawn their own table, and a table is not one tag: it is a scroller, a set of rules between rows, a padding, a text size, and a decision about whether a cell wraps. Four hands answered those five questions four ways -- two different minimum widths, two paddings, and a rule colour nobody had chosen twice. None of that is visible while you are writing the fifth one.
const A_TABLE_BY_HAND = ['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th']

// shadcn's own, copied in by their CLI. `Table` is *made of* these tags -- that is what it is for. The rule is about what this repository writes.
const THEIRS = 'components/ui/'

/** Where shadcn's table is, so the exception below is an exception to something that exists. */
const WHERE_THEIRS_IS = 'components/ui/table.tsx'

/** The screens that each used to hold one, named so this cannot pass by having stopped looking at them. */
const THEY_USED_TO_HOLD_ONE = [
  'components/site/SpentByTrade.tsx',
  'components/site/Stages.tsx',
  'components/site/ExtraWork.tsx',
  'components/moneyIn/WhatHasComeIn.tsx',
]

/** Every place a screen opens a table tag itself. */
export function drawnByHandIn(written: string): Array<string> {
  return tagsWrittenIn(written, A_TABLE_BY_HAND)
}

describe('a table drawn by hand', () => {
  const ours = everyScreen().filter(({ path }) => !path.startsWith(THEIRS))

  it('is on none of our screens', () => {
    const drawn = ours.flatMap(({ path, source }) =>
      drawnByHandIn(source).map((tag) => `${path}: <${tag}> is a table drawn by hand, not shadcn's Table`)
    )

    expect(drawn).toEqual([])
  })

  it('is asked of the four screens that each had one', () => {
    // The floor, anchored on the fix rather than on a count: these four are the files this rule was written about, and a sweep that stopped opening them would report the same clean result.
    const paths = ours.map(({ path }) => path)

    for (const path of THEY_USED_TO_HOLD_ONE) {
      expect(paths, `${path} is what this rule is about and the sweep is not opening it`).toContain(path)
    }
  })

  it('has each of them reading through shadcn instead', () => {
    // Absence of a `<table>` is also what a screen with nothing on it looks like. The four have to be reading through `Table`, not merely be innocent of `<tr>`.
    for (const path of THEY_USED_TO_HOLD_ONE) {
      const screen = ours.find((one) => one.path === path)

      expect(screen?.source, `${path} no longer draws a table and does not use shadcn's either`).toContain(
        "from '../ui/table'"
      )
    }
  })

  it('leaves shadcn their own, which is made of exactly these tags', () => {
    // The exception, proved rather than assumed. If their `Table` stopped being a table -- deleted, or replaced by something that renders divs -- the rule above would still pass over an app with no table in it anywhere.
    const theirs = everyScreen().find(({ path }) => path === WHERE_THEIRS_IS)

    expect(theirs, `${WHERE_THEIRS_IS} is where a table is allowed to be written and it is not there`).toBeDefined()
    expect(drawnByHandIn(theirs?.source ?? '')).toEqual(['table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'])
    expect(ours.map(({ path }) => path).filter((path) => path.startsWith(THEIRS))).toEqual([])
  })

  it('would notice each of the four shapes it replaced', () => {
    // Verbatim, in the shape each screen actually had.
    expect(drawnByHandIn('<table className="w-full min-w-[22rem] border-collapse text-left">')).toEqual(['table'])
    expect(drawnByHandIn('<tbody className="divide-hairline divide-y">')).toEqual(['tbody'])
    expect(drawnByHandIn('<tr key={stage._id}>')).toEqual(['tr'])
    expect(drawnByHandIn('<td className="py-2.5 pr-4">{stage.description}</td>')).toEqual(['td'])
    expect(drawnByHandIn('<th scope="col">What it went on</th>')).toEqual(['th'])
  })

  it('reads the code and not what is written about it', () => {
    expect(drawnByHandIn('// this was a hand-rolled <tr> with its own padding\nconst x = 1')).toEqual([])
    expect(drawnByHandIn('/* four screens each drew a <table> of their own */\nconst y = 2')).toEqual([])
    // And the code under the comment is still read.
    expect(drawnByHandIn('// no more <table>\n<table className="w-full">')).toEqual(['table'])
  })

  it('leaves alone the components that only look like them', () => {
    expect(drawnByHandIn('<Table className="min-w-[22rem] text-base">')).toEqual([])
    expect(drawnByHandIn('<TableRow key={trade.tradeId}>')).toEqual([])
    expect(drawnByHandIn('<TableCell colSpan={2} className="pb-3">')).toEqual([])
    expect(drawnByHandIn('<TableBody>')).toEqual([])
    expect(drawnByHandIn('<TradeSpend />')).toEqual([])
    expect(drawnByHandIn('const thead = whatever')).toEqual([])
  })
})
