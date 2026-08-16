// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { everyScreen } from '../../testing/screens'

// `Take out`, `Take it back` and `Hide it?` were one behaviour wearing four phrasings: five mutations, every one of them `removed: true` with who and when. Nothing is destroyed.

// Nobody was ever told that. The reassurance was a **comment** on five screens of six, and a comment ships to nobody -- so the word `Hide` was carrying it alone, which is exactly what the comment above the old `Hide it?` called *said plainly*.

// Renaming to `Remove` without writing the sentence would have taken the only reassurance out of the product and left it true in source, where the person worried about losing a payment cannot read it. Worse than the folksy label it replaced, which is what this whole change exists to avoid.

// So the sentence is a component, and this is the half that stops it being true on two screens and missing on four.

/** What a control that reaches the server to remove something looks like: the screen hands it up and waits for an answer. */
const REMOVES_A_STORED_ROW = /on(?:TakeOut|TakeBack|PutAway|Remove)\??:\s*\([^)]*\)\s*=>\s*Promise</

/** Written once, in the one place a screen can ask for it. */
const THE_SENTENCE = '<NothingIsDeleted'

// Its own sentence, longer and about a house rather than a row: *A house put away comes off the list. What was spent on it is still there, and every payment still points at it.* Held to that below rather than to its name, so an exemption cannot outlive the reason for it.
const SAYS_IT_ITS_OWN_WAY = 'components/sites/ChangeTheHouse.tsx'

// The one screen in the other half of this rename, which still says `Take it back` and gains the sentence in the change that renames it. Named rather than left to fail, because a guard that lands red is a to-do wearing a rule's clothes -- and named with the assertion below rather than on trust, so it cannot outlive the hour it is true for.
const STILL_TO_CONVERT = ['components/shares/PayOut.tsx']

function whatRemovesAStoredRow(): Array<{ path: string; source: string }> {
  return everyScreen()
    .filter(({ path }) => path.startsWith('components/') && !path.startsWith('components/ui/'))
    .filter(({ source }) => REMOVES_A_STORED_ROW.test(source))
}

describe('a control that removes something already entered', () => {
  it('says that nothing is deleted, on every screen that has one', () => {
    const silent = whatRemovesAStoredRow()
      .filter(({ path }) => path !== SAYS_IT_ITS_OWN_WAY)
      .filter(({ path }) => !STILL_TO_CONVERT.includes(path))
      .filter(({ source }) => !source.includes(THE_SENTENCE))
      .map(({ path }) => `${path}: removes a stored row and never says the record is kept`)

    expect(silent).toEqual([])
  })

  it('still names what is left, so the exemption cannot outlive it', () => {
    // The other end, and the reason this file may carry an exemption at all. Each named screen has to still be un-converted: the moment it says the sentence, this fails and the name comes out. An exemption that has stopped being true reads exactly like one that is still needed.
    for (const path of STILL_TO_CONVERT) {
      const screen = whatRemovesAStoredRow().find((one) => one.path === path)

      expect(screen, `${path} is exempted and is not a screen that removes a stored row`).toBeDefined()
      expect(screen?.source.includes(THE_SENTENCE), `${path} is exempted and already says it`).toBe(false)
    }
  })

  it('is asked of the screens that really remove one', () => {
    // The floor. A pattern that stopped matching reports the same clean nothing as an app where every one of them says it -- and this rule was written the day the count of screens saying it went from one to six.
    const removing = whatRemovesAStoredRow().map(({ path }) => path)

    expect(removing.length).toBeGreaterThan(4)
    expect(removing).toContain('components/shares/PayOut.tsx')
    expect(removing).toContain('components/site/SpentByTrade.tsx')
  })

  it('does not ask it of a row nothing has stored yet', () => {
    // `AgreeShares` has a `Remove` beside every partner and removes a line of a form that has not been sent. There is nothing to reassure anybody about, and a sentence promising the record is kept would be a promise about a row that does not exist.

    // Told apart by the type rather than by a list: a control that reaches the server hands back a promise, and this one hands back nothing.
    const shares = everyScreen().find(({ path }) => path === 'components/partners/AgreeShares.tsx')

    expect(shares?.source, 'the screen this exemption is about has changed shape').toMatch(/onTakeOut/)
    expect(whatRemovesAStoredRow().map(({ path }) => path)).not.toContain('components/partners/AgreeShares.tsx')
  })

  it('holds the one screen that says it in its own words to what it actually says', () => {
    // An exemption is only as good as the reason under it, and a reason nobody checks is a name on a list.
    const house = everyScreen().find(({ path }) => path === SAYS_IT_ITS_OWN_WAY)

    expect(house?.source, `${SAYS_IT_ITS_OWN_WAY} no longer removes anything`).toMatch(REMOVES_A_STORED_ROW)
    expect(house?.source, `${SAYS_IT_ITS_OWN_WAY} is excused and says nothing`).toContain('comes off the list')
    expect(house?.source).toContain('every payment still points at it')
  })

  it('is one sentence rather than one per screen', () => {
    // The whole point of a component: five screens saying it four ways is how `Take out`, `Take it back` and `Hide it?` came to be one behaviour with four labels.
    const page = everyScreen().find(({ path }) => path === 'components/shell/Page.tsx')

    expect(page?.source).toContain('export function NothingIsDeleted')
    expect(page?.source).toContain('It comes off this screen.')
  })
})
