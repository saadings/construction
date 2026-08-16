// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from './testing/screens'
import { withoutComments } from './testing/source'

// What to put in front of somebody when the server refuses was written out twenty-four times across eighteen files, in four shapes, and three of the four were wrong in some way.

// Seventeen asserted a shape with a cast — `(thrown as { data?: unknown }).data` — because a component that never imports `ConvexError` cannot ask the question properly and asks it by assertion instead. Five used `instanceof ConvexError` and were right, except that `String(thrown.data)` on anything other than words puts `[object Object]` in front of a person. One read `.message` off any `Error`, which in production is the word `Server Error` and never the refusal. And one had already been extracted, in one file, with its own words.

/** Where it is written, so the exception below is an exception to something that exists. */
const WHERE_IT_IS_WRITTEN = 'components/form/whatWentWrong.ts'

/** The four shapes it was written in, each by the text it really had. */
const WRITTEN_OUT_BY_HAND = [
  { called: 'a cast asserting the thrown thing has a `data`', shape: /\(thrown as \{ data\?: unknown \}\)/ },
  {
    called: 'reading `.message`, which is `Server Error` in production',
    shape: /thrown instanceof Error \? thrown\.message/,
  },
  { called: '`String(thrown.data)`, which is `[object Object]` when it is not words', shape: /String\(thrown\.data\)/ },
  {
    called: 'the sentence itself, rather than the one place that says it',
    shape: /'That did not go in\. Try once more\.'/,
  },
]

/** The screens and routes that each held one, named so the sweep failing to open one is a failure rather than a clean result. */
const THEY_EACH_HELD_ONE = [
  'components/settings/Trades.tsx',
  'components/settings/BankAccounts.tsx',
  'components/moneyIn/ComingIn.tsx',
  // `AddAnAccount.tsx` until the picker took the job over, and now two files rather than one: adding a trade refuses the same way adding an account does.
  'components/form/PickAnAccount.tsx',
  'components/form/PickATrade.tsx',
  'components/sites/HouseDetails.tsx',
  'components/sites/ChangeTheHouse.tsx',
  'components/site/ChangeTheContract.tsx',
  'components/people/People.tsx',
  'components/site/AgreeAContract.tsx',
  'components/site/Stages.tsx',
  'components/site/ExtraWork.tsx',
  'components/shares/PayOut.tsx',
  'components/invites/WhoCanSignIn.tsx',
  'routes/sites.$siteId.day.tsx',
  'routes/sites.$siteId.index.tsx',
  'routes/sites.$siteId.shares.tsx',
  'routes/sites.$siteId.coming-in.tsx',
]

/** Every place a screen works out its own words for a refusal. */
export function saysItItself(written: string): Array<string> {
  const source = withoutComments(written)

  return WRITTEN_OUT_BY_HAND.filter(({ shape }) => shape.test(source)).map(({ called }) => called)
}

describe('a refusal worked out by hand', () => {
  const ours = everyScreen().filter(({ path }) => path !== WHERE_IT_IS_WRITTEN)

  it('is on none of our screens or routes', () => {
    const byHand = ours.flatMap(({ path, source }) => saysItItself(source).map((called) => `${path}: ${called}`))

    expect(byHand).toEqual([])
  })

  it('is asked of the seventeen files that each held one', () => {
    // The floor, anchored on the fix rather than on a count.
    const paths = ours.map(({ path }) => path)

    for (const path of THEY_EACH_HELD_ONE) {
      expect(paths, `${path} is what this rule is about and the sweep is not opening it`).toContain(path)
    }
  })

  it('has each of them asking the one that exists', () => {
    // Absence of a hand-written refusal is also what a file with nothing to refuse looks like.
    const asking = ours.filter(({ source }) => source.includes('whatWentWrong(')).map(({ path }) => path)

    for (const path of THEY_EACH_HELD_ONE) {
      expect(asking, `${path} no longer says it itself and does not ask either`).toContain(path)
    }
  })

  it('would notice each of the four shapes it replaced', () => {
    // Verbatim, in the shape each of them had.
    expect(saysItItself('const said: unknown = (thrown as { data?: unknown }).data')).toEqual([
      'a cast asserting the thrown thing has a `data`',
    ])
    expect(saysItItself("setProblem(thrown instanceof Error ? thrown.message : 'x')")).toEqual([
      'reading `.message`, which is `Server Error` in production',
    ])
    expect(saysItItself('thrown instanceof ConvexError ? String(thrown.data) : x')).toEqual([
      '`String(thrown.data)`, which is `[object Object]` when it is not words',
    ])
    expect(saysItItself("setRefusal('That did not go in. Try once more.')")).toEqual([
      'the sentence itself, rather than the one place that says it',
    ])
  })

  it('leaves the two that pass their own words alone, because those are deliberate', () => {
    // An invitation goes out through Clerk rather than into the ledger, and taking something out is not putting something in. Both are arguments to the one function rather than a second copy of it.
    expect(saysItItself("whatWentWrong(thrown, 'That did not go through. Try once more in a moment.')")).toEqual([])
    expect(saysItItself("whatWentWrong(thrown, 'That did not come out. Try once more.')")).toEqual([])
    expect(saysItItself('setRefusal(whatWentWrong(thrown))')).toEqual([])
  })

  it('reads the code and not what is written about it', () => {
    expect(saysItItself('// it used to be (thrown as { data?: unknown }).data\nconst x = 1')).toEqual([])
    expect(saysItItself("/* the old 'That did not go in. Try once more.' */\nconst y = 2")).toEqual([])
  })
})
