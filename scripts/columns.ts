import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from 'playwright'

import { GALLERY, everyScreenItShows, serveTheGallery, unfoldIt } from './theGallerysOwnServer'

// What the browser actually drew, measured rather than described. It began with one question -- whether a column of figures is a column -- and each one since was added the day something got past every check we had: a figure cut in half, a column squeezed to a letter a line, a trail pinned beside the heading that repeats it.

// Eight questions now, and still not *is this usable*. Say which were asked when quoting a clean run; a passing sweep is a reason people stop opening the pictures. Two of them had to change the app to be askable at all: the nav was inside the one component nothing here can draw, and no measurement can tell a name that may be cut from a cheque number that may not -- so the page says which is which.

// `width.test.ts` asserts every figure goes through `<Figure>`, for the stated reason that it is what makes a column of amounts read as one. That guard passes, every figure is in the right face, and the grid moved the columns anyway. It is the one instrument here answering exactly the right question, truthfully, while the outcome it stands in for does not happen -- and nothing else in this repository could see the difference, because nothing else in it lays anything out.

// The defect it is here to stop: a grid written once per row sizes a content-shaped track to that row's own content, so the column lands wherever that row happens to need it. Four screens had it, and the three that did not were not defended against it -- their last cell simply happened to be the same width every time.

/** The same widths the pictures are taken at: a phone, the width the sidebar changes at, and a desk. */
const SCREENS_READ_ON = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]

/** The floor. A run that measured nothing reports the same clean nothing as an app whose columns all line up. */
const AT_LEAST_THIS_MANY_ROWS = 20

/** The same floor for the other half. A selector that stopped finding figures reports the same clean nothing as a screen where none is cut. */
const AT_LEAST_THIS_MANY_FIGURES = 100

/** The same floor again. A selector that stopped finding cells reports the same clean nothing as an app where none is squeezed. */
const AT_LEAST_THIS_MANY_CELLS = 100

/** What a thumb needs, which Apple's guidance and WCAG 2.5.5 arrive at separately. The same bar that made the date input a defect in #96, asked here of the one navigation a phone has. */
const A_THUMB_NEEDS = 44

/** Below this the nav is a sheet and the rows are what a thumb hits; above it there is a column under a mouse and 32px rows are right. A phone-only rule, because one height cannot be correct at both ends. */
const A_PHONE_IS_UNDER = 768

/** The floor for it. Every other check here counts what it saw; this one saw nothing at all until this branch, which is exactly how the nav stayed 32px. */
const AT_LEAST_THIS_MANY_TAPPED = 5

/** And once more for the trails. Only the screens with something above them draw one, so this is well under what a full sweep sees -- but a `data-slot` renamed under us would report every trail unpinned across an app whose trails it never found. */
const AT_LEAST_THIS_MANY_TRAILS = 20

/** The floor for the seventh question. `data-must-be-read` is an attribute one component puts on itself, and an attribute nobody renders any more reports exactly what an app that cuts nothing off reports. */
const AT_LEAST_THIS_MANY_LINES = 4

// Handed to the browser as text rather than as a function, so this file stays a Node script with no DOM types in it -- the same reason the pictures are taken through the locator API. What comes back is checked below rather than trusted, because a string evaluated in a page can return anything at all.

// Three things it is careful about. A class worn by one element is not a column of anything, so only a row written once and drawn many times is compared. And a cell that is not drawn has no position while a browser still answers 0 for it: counted as a column at x=0, every row with an optional cell reads as broken -- `their-account` shows `Billed` or `Paid` and never both, and reading that absence as a position is the instrument inventing the defect it went looking for.

// The third is how many columns the grid actually has, and it is what makes "the same class twice" mean anything. Two rows of one list declare the same tracks and have to line up. Two separate questions can now wear the same class and declare a different number of columns, because a row of choices takes its count from a variable: `coming-in` asks `What this money is` down one column and `How it came` across four, and grouped by class alone that reported six defects that nothing anywhere should line up.

// Grouping by the parent was the first answer and it was wrong in the way that matters: it silently stopped comparing three real lists -- `sites`, `more` and `who-is-on-this-house` -- whose rows each sit in a wrapper of their own, and the count fell from 108 to 81 while reading as a clean sweep. A defective list still declares one shape and resolves it differently per row, so a count of tracks separates the two questions and keeps every row of every list.

// What it does cost, said rather than left in the count: 108 rows to 102. Six of those are the two questions on `coming-in` at three widths, which is the point. The other six are one pair on `who-is-on-this-house` -- a subgrid row of seven columns beside one that spans the list as a single track -- and all that pair ever compared was their first cell, which under subgrid is the list's own left edge and agrees whatever happens.
const WHERE_THE_COLUMNS_ARE = `(() => {
  const grids = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).display === 'grid')

  const byClass = new Map()
  for (const el of grids) {
    const tracks = getComputedStyle(el).gridTemplateColumns
    const key = el.className.toString() + ' | ' + tracks.split(' ').length + ' across'
    byClass.set(key, [...(byClass.get(key) ?? []), el])
  }

  const moved = []
  let rows = 0

  for (const [cls, drawn] of byClass) {
    if (drawn.length < 2) continue
    rows += drawn.length

    const lefts = drawn.map((row) =>
      [...row.children].map((cell) => {
        const box = cell.getBoundingClientRect()
        return box.width === 0 && box.height === 0 ? null : Math.round(box.left)
      })
    )

    const widest = Math.max(...lefts.map((row) => row.length))

    for (let cell = 0; cell < widest; cell += 1) {
      const xs = [...new Set(lefts.map((row) => row[cell]).filter((x) => x !== null && x !== undefined))]
      if (xs.length > 1) moved.push({ cls: cls.slice(0, 70), cell, xs })
    }
  }

  return { rows, moved }
})()`

// The second question, and a different failure from the first. A wide table in its own scroll container is the right pattern and this does not argue with it -- what it asks is which column ends up under the cut.

// Text may truncate; a figure may not. A name cut with an ellipsis reads as incomplete and the reader swipes. `9,310,000` cut to `9,3` reads as a different, smaller number, and nothing on the screen says otherwise -- on a table of house totals that is a wrong figure presented as a right one.

// Asked of the page as first drawn rather than of what a scroll could reveal, because what a person sees is the first state. And a figure with no box answers 0 for every edge, which is the same not-there-reading-as-a-value the sweep above already skips.
const WHAT_IS_CUT_IN_HALF = `(() => {
  const clipping = (el) => {
    const how = getComputedStyle(el)
    return how.overflowX === 'auto' || how.overflowX === 'scroll' || how.overflowX === 'hidden'
  }

  const cut = []
  let figures = 0

  for (const figure of document.querySelectorAll('.tabular-nums')) {
    const box = figure.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    figures += 1

    // The worst of them and not one line each: a figure can sit inside several things that clip, and the same figure reported three times reads as three defects.
    let worst = 0

    for (let above = figure.parentElement; above !== null; above = above.parentElement) {
      if (!clipping(above)) continue

      const holds = above.getBoundingClientRect()
      const hidden = Math.round(Math.max(0, holds.left - box.left) + Math.max(0, box.right - holds.right))

      // A whole figure outside the container is off-screen rather than cut in half, and that is the pattern working: nothing of it is being read.
      if (hidden > 0 && hidden < Math.round(box.width)) worst = Math.max(worst, hidden)
    }

    if (worst > 0) {
      cut.push({ said: figure.textContent.trim().slice(0, 24), hidden: worst, width: Math.round(box.width) })
    }
  }

  return { figures, cut }
})()`

// The third question, and the one that found a screen every other check had cleared. `Stages` passed the two above — no column moved, no figure was cut — while its first column was 38px wide and 189 tall, wrapping `On signing` to one letter a line. A date box beside a button took 289 of the table's 490px and starved everything else.

// A cell far taller than it is wide is a column that has been squeezed rather than one that is long. Twice is the line because two lines of wrapped words in a narrow cell is ordinary and eight lines of single letters is not, and at 390 across seventeen screens it found those two cells and nothing else.
const WHAT_IS_CRUSHED = `(() => {
  const crushed = []
  let cells = 0

  for (const cell of document.querySelectorAll('td, th')) {
    const box = cell.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    cells += 1

    if (box.height > box.width * 2) {
      crushed.push({
        said: cell.textContent.trim().slice(0, 24),
        wide: Math.round(box.width),
        tall: Math.round(box.height),
      })
    }
  }

  return { cells, crushed }
})()`

// The fourth question, and the one this file was extended for. The day sheet drew its trail inside its own sticky header, so `1-A, Phase 0` sat on the screen twice, thirty-four pixels apart, and stayed there through every scroll -- on the screen he uses most.

// Two tests said the trail was present and a picture confirmed it, which was the right question asked twice; neither could say it was present twice. Measured here because that is what nothing else could see: a trail is navigation and belongs at the top of the content where it scrolls away, and a sticky header is for what somebody needs in front of them while typing.
const WHAT_IS_PINNED = `(() => {
  const pinned = []
  let trails = 0

  for (const trail of document.querySelectorAll('[data-slot="breadcrumb-list"]')) {
    const box = trail.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    trails += 1

    for (let above = trail.parentElement; above !== null; above = above.parentElement) {
      const how = getComputedStyle(above).position
      if (how !== 'sticky' && how !== 'fixed') continue

      pinned.push({ said: trail.textContent.trim().slice(0, 40), how, held: above.className.toString().slice(0, 60) })
      break
    }
  }

  return { trails, pinned }
})()`

// The seventh question, and the one a picture found rather than a check. At 390 the payment list read `23/07/2026 · Chequ…` -- the cheque number gone entirely, on the screen where somebody goes to find out which cheque paid what.

// Nothing here could have caught it. `truncate` is exactly how a name is meant to behave, and the sweep for cut figures is about a box clipping a figure, not about an ellipsis doing what it was asked to do. The two lines are the same markup and one of them was right.

// Which is why the page says so rather than this guessing: a name may be cut and a cheque number may not, and no measurement can tell those apart. `SaidUnderneath` marks itself, the way a way out marks itself as removing something.
const WHAT_IS_CUT_OFF = `(() => {
  const cut = []
  let lines = 0

  for (const line of document.querySelectorAll('[data-must-be-read]')) {
    const box = line.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    lines += 1

    // Rounded, because a browser lays text out in fractions and a line that fits exactly is off by half a pixel about as often as not.
    const hidden = Math.round(line.scrollWidth - line.clientWidth)

    if (hidden > 1) {
      cut.push({ said: line.textContent.trim().slice(0, 40), hidden, width: Math.round(box.width) })
    }
  }

  return { lines, cut }
})()`

// The fifth question, and the only one whose answer nobody could have looked up. Nauman found it with a thumb: every row in the nav was 32px on his phone, 27% under the bar, on the only navigation there is at that width once the sidebar is behind a hamburger.

// Nothing here had ever measured it and nothing could have. `Shell` holds Clerk's `UserButton`, Clerk will not render outside its own provider, and the gallery is kept clear of anything that could reach a deployment -- so the shell was exempt from the sweep, and the nav inside it went with it. The nav is its own file now for that reason alone.

// Asked only below 768, and asked of the nav rather than of everything: a first pass over every control in the app at 390 found 104 of 151 under this bar, which is a real finding and a different piece of work. A guard that fails on a hundred things nobody is fixing today gets switched off.
const WHAT_A_THUMB_CANNOT_HIT = `(() => {
  const asked = '[data-sidebar="menu-button"], [data-sidebar="trigger"], [data-slot="sidebar-footer"] > div'

  const small = []
  let tapped = 0

  for (const control of document.querySelectorAll(asked)) {
    const box = control.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    tapped += 1

    if (Math.round(box.height) < ${String(A_THUMB_NEEDS)}) {
      small.push({
        said: (control.textContent ?? '').trim().slice(0, 24) || control.getAttribute('aria-label') || 'the avatar',
        high: Math.round(box.height),
        wide: Math.round(box.width),
      })
    }
  }

  return { tapped, small }
})()`

// The sixth question, and the one with the sharpest cost. A first pass over every control at 390 found 104 of 151 under the bar, which is a real finding and a piece of work nobody is doing today -- and a guard that fails on a hundred things gets switched off. So this asks it of the controls where a mis-tap costs something: the ones that remove a row.

// Thirteen of the thirteen were 20px. Not most of them, not the ones on the crowded screens -- every single control in this app that takes a row out was less than half of what a thumb needs, including `Take out` beside a figure on a phone.

// Asked of `[data-removes]`, which `WayOut` and `Button look="removing"` put on themselves, rather than worked out from colour or class. A probe that infers what a control is from how it looks agrees with its own guess; one that asks the control what it does cannot.

// And what is measured is the box a finger lands on rather than the visible size, which is why the fix moved nothing: `py-3 -my-3` grows the hit area by 24px and gives the same 24 back to the layout. A rule read as "44px tall" is one somebody argues an exemption out of the first time it would double a dense table.
const WHAT_REMOVES_SOMETHING = `(() => {
  const small = []
  let tapped = 0

  for (const control of document.querySelectorAll('[data-removes]')) {
    const box = control.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    tapped += 1

    if (Math.round(box.height) < ${String(A_THUMB_NEEDS)}) {
      small.push({
        said: (control.textContent ?? '').trim().slice(0, 24) || control.getAttribute('aria-label') || 'a way out',
        high: Math.round(box.height),
        wide: Math.round(box.width),
      })
    }
  }

  return { tapped, small }
})()`

// What this could not reach, and no longer cannot. Thirteen controls were measured and all thirteen were a `WayOut`: the other four -- `Button look="removing"`, the press that actually takes the row out -- sit behind an are-you-sure, and every screen was photographed at rest, so the confirming step was never on the page while this ran.

// The gallery taps its way in now, so the confirmations are drawn and measured with the rest: twenty-one, against thirteen. What was left to `Button.test.tsx` reading a merged class list is measured on the page.

/** The floor for it. Thirteen were found the day this was written and twenty-one once the confirmations could be reached; a selector that stopped matching would report the same clean nothing as an app where every one of them is big enough. */
const AT_LEAST_THIS_MANY_REMOVE = 10

// The eighth question. A row of labelled boxes is the control a day sheet is tapped on four times per entry, and until the six hand-written rows became one component they were 36px and 40px -- under the floor every nav control and every way out is held to.

// The component sets `min-h-11` and nothing checked it, which is how the seventh row stayed 36px: `HowItLooks` drew shadcn's `ToggleGroup` itself, so the rule that refuses `role="radio"` written by hand had nothing to say about it -- Radix writes the role there. A measured claim with no instrument behind it is a paragraph somebody has to remember.

// Asked of `[role="radio"]`, which is what a person taps, wherever the role came from.
const WHAT_IS_CHOSEN_FROM = `(() => {
  const small = []
  let tapped = 0

  for (const choice of document.querySelectorAll('[role="radio"]')) {
    const box = choice.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    tapped += 1

    if (Math.round(box.height) < ${String(A_THUMB_NEEDS)}) {
      small.push({
        said: (choice.textContent ?? '').trim().slice(0, 24) || choice.getAttribute('aria-label') || 'a choice',
        high: Math.round(box.height),
        wide: Math.round(box.width),
      })
    }
  }

  return { tapped, small }
})()`

/** The floor for it. Thirty-two were drawn at 390 the day this was written, across seven screens. */
const AT_LEAST_THIS_MANY_CHOICES = 20

type Moved = { cls: string; cell: number; xs: Array<number> }

type Cut = { said: string; hidden: number; width: number }

type Crushed = { said: string; wide: number; tall: number }

type Pinned = { said: string; how: string; held: string }

type TooSmall = { said: string; high: number; wide: number }

/** What came back from the page, checked rather than assumed: a bad shape here would read as a screen with nothing wrong on it. */
function whatItMeasured(said: unknown): { rows: number; moved: Array<Moved> } {
  if (typeof said !== 'object' || said === null || !('rows' in said) || !('moved' in said)) {
    throw new Error('The page answered something that is not a measurement.')
  }

  const { rows, moved } = said
  if (typeof rows !== 'number' || !Array.isArray(moved)) {
    throw new Error('The page answered a measurement with no rows or no findings in it.')
  }

  return {
    rows,
    moved: moved.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('cls' in one) || !('cell' in one) || !('xs' in one)) {
        throw new Error('The page answered a finding with nothing in it.')
      }

      const { cls, cell, xs } = one
      if (typeof cls !== 'string' || typeof cell !== 'number' || !Array.isArray(xs)) {
        throw new Error('The page answered a finding of the wrong shape.')
      }

      return { cls, cell, xs: xs.map(Number) }
    }),
  }
}

/** The other half of what came back, checked the same way and for the same reason. */
function whatIsCut(said: unknown): { figures: number; cut: Array<Cut> } {
  if (typeof said !== 'object' || said === null || !('figures' in said) || !('cut' in said)) {
    throw new Error('The page answered something that is not a count of figures.')
  }

  const { figures, cut } = said
  if (typeof figures !== 'number' || !Array.isArray(cut)) {
    throw new Error('The page answered a count with no figures or no findings in it.')
  }

  return {
    figures,
    cut: cut.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('hidden' in one) || !('width' in one)) {
        throw new Error('The page answered a cut figure with nothing in it.')
      }

      const { said: text, hidden, width } = one
      if (typeof text !== 'string' || typeof hidden !== 'number' || typeof width !== 'number') {
        throw new Error('The page answered a cut figure of the wrong shape.')
      }

      return { said: text, hidden, width }
    }),
  }
}

/** The seventh, checked the same way and for the same reason: a string evaluated in a page can return anything at all. */
function whatIsCutOff(said: unknown): { lines: number; cut: Array<Cut> } {
  if (typeof said !== 'object' || said === null || !('lines' in said) || !('cut' in said)) {
    throw new Error('The page answered something that is not a count of lines.')
  }

  const { lines, cut } = said
  if (typeof lines !== 'number' || !Array.isArray(cut)) {
    throw new Error('The page answered a count with no lines or no findings in it.')
  }

  return {
    lines,
    cut: cut.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('hidden' in one) || !('width' in one)) {
        throw new Error('The page answered a cut line with nothing in it.')
      }

      const { said: text, hidden, width } = one
      if (typeof text !== 'string' || typeof hidden !== 'number' || typeof width !== 'number') {
        throw new Error('The page answered a cut line of the wrong shape.')
      }

      return { said: text, hidden, width }
    }),
  }
}

/** The third measurement, checked the same way and for the same reason. */
function whatIsCrushed(said: unknown): { cells: number; crushed: Array<Crushed> } {
  if (typeof said !== 'object' || said === null || !('cells' in said) || !('crushed' in said)) {
    throw new Error('The page answered something that is not a count of cells.')
  }

  const { cells, crushed } = said
  if (typeof cells !== 'number' || !Array.isArray(crushed)) {
    throw new Error('The page answered a count with no cells or no findings in it.')
  }

  return {
    cells,
    crushed: crushed.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('wide' in one) || !('tall' in one)) {
        throw new Error('The page answered a crushed cell with nothing in it.')
      }

      const { said: text, wide, tall } = one
      if (typeof text !== 'string' || typeof wide !== 'number' || typeof tall !== 'number') {
        throw new Error('The page answered a crushed cell of the wrong shape.')
      }

      return { said: text, wide, tall }
    }),
  }
}

/** The fourth measurement, checked the same way and for the same reason. */
function whatIsPinned(said: unknown): { trails: number; pinned: Array<Pinned> } {
  if (typeof said !== 'object' || said === null || !('trails' in said) || !('pinned' in said)) {
    throw new Error('The page answered something that is not a count of trails.')
  }

  const { trails, pinned } = said
  if (typeof trails !== 'number' || !Array.isArray(pinned)) {
    throw new Error('The page answered a count with no trails or no findings in it.')
  }

  return {
    trails,
    pinned: pinned.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('how' in one) || !('held' in one)) {
        throw new Error('The page answered a pinned trail with nothing in it.')
      }

      const { said: text, how, held } = one
      if (typeof text !== 'string' || typeof how !== 'string' || typeof held !== 'string') {
        throw new Error('The page answered a pinned trail of the wrong shape.')
      }

      return { said: text, how, held }
    }),
  }
}

/** The fifth measurement, checked the same way and for the same reason. */
function whatIsTooSmall(said: unknown): { tapped: number; small: Array<TooSmall> } {
  if (typeof said !== 'object' || said === null || !('tapped' in said) || !('small' in said)) {
    throw new Error('The page answered something that is not a count of controls.')
  }

  const { tapped, small } = said
  if (typeof tapped !== 'number' || !Array.isArray(small)) {
    throw new Error('The page answered a count with no controls or no findings in it.')
  }

  return {
    tapped,
    small: small.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('high' in one) || !('wide' in one)) {
        throw new Error('The page answered a control with nothing in it.')
      }

      const { said: text, high, wide } = one
      if (typeof text !== 'string' || typeof high !== 'number' || typeof wide !== 'number') {
        throw new Error('The page answered a control of the wrong shape.')
      }

      return { said: text, high, wide }
    }),
  }
}

async function main(): Promise<void> {
  if (!existsSync(join(GALLERY, 'gallery.html'))) {
    throw new Error(`No gallery built at ${GALLERY}. Run \`yarn gallery:build\` first.`)
  }

  const server = await serveTheGallery()
  const browser = await chromium.launch()
  const wrong: Array<string> = []
  let rowsSeen = 0
  let figuresSeen = 0
  let cellsSeen = 0
  let trailsSeen = 0
  let tappedSeen = 0
  let removesSeen = 0
  let choicesSeen = 0
  let linesSeen = 0

  try {
    const page = await browser.newPage()
    await page.goto(server.at)

    const screens = await everyScreenItShows(page)
    if (screens.length === 0) {
      throw new Error('The gallery showed no screens, so nothing was measured.')
    }

    for (const size of SCREENS_READ_ON) {
      await page.setViewportSize(size)

      for (const screen of screens) {
        await page.goto(`${server.at}/gallery.html#${screen.slug}`)

        // Waited for by what the screen says rather than by a timer, and tapped open first where a screen keeps itself folded -- the same way the pictures are, out of the same function, because this had the same blindness and found out about it separately.
        await unfoldIt(page, screen)
        await page.getByText(screen.proves, { exact: false }).first().waitFor({ timeout: 15_000 })

        const measured = whatItMeasured(await page.evaluate(WHERE_THE_COLUMNS_ARE))
        rowsSeen += measured.rows

        for (const moved of measured.moved) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: cell ${String(moved.cell)} sits at ${moved.xs.join(', ')} — ${moved.cls}`
          )
        }

        const figures = whatIsCut(await page.evaluate(WHAT_IS_CUT_IN_HALF))
        figuresSeen += figures.figures

        for (const cut of figures.cut) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: ${cut.said} is cut in half — ${String(cut.hidden)}px of ${String(cut.width)} is outside what holds it`
          )
        }

        const lines = whatIsCutOff(await page.evaluate(WHAT_IS_CUT_OFF))
        linesSeen += lines.lines

        for (const cut of lines.cut) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: "${cut.said}" must be read and ${String(cut.hidden)}px of it is cut off — a name cut short is still a name, a cheque number cut short is not a cheque number`
          )
        }

        const cells = whatIsCrushed(await page.evaluate(WHAT_IS_CRUSHED))
        cellsSeen += cells.cells

        for (const crushed of cells.crushed) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: ${crushed.said} is squeezed into ${String(crushed.wide)}px and ${String(crushed.tall)}px tall`
          )
        }

        const trails = whatIsPinned(await page.evaluate(WHAT_IS_PINNED))
        trailsSeen += trails.trails

        if (size.width < A_PHONE_IS_UNDER) {
          const thumb = whatIsTooSmall(await page.evaluate(WHAT_A_THUMB_CANNOT_HIT))
          tappedSeen += thumb.tapped

          for (const small of thumb.small) {
            wrong.push(
              `${screen.slug} at ${String(size.width)}: ${small.said} is ${String(small.high)}px high and ${String(small.wide)} wide, under the ${String(A_THUMB_NEEDS)} a thumb needs`
            )
          }

          const choices = whatIsTooSmall(await page.evaluate(WHAT_IS_CHOSEN_FROM))
          choicesSeen += choices.tapped

          for (const small of choices.small) {
            wrong.push(
              `${screen.slug} at ${String(size.width)}: "${small.said}" is a choice ${String(small.high)}px high, under the ${String(A_THUMB_NEEDS)} a thumb needs`
            )
          }

          const removes = whatIsTooSmall(await page.evaluate(WHAT_REMOVES_SOMETHING))
          removesSeen += removes.tapped

          for (const small of removes.small) {
            wrong.push(
              `${screen.slug} at ${String(size.width)}: "${small.said}" removes something and is ${String(small.high)}px high, under the ${String(A_THUMB_NEEDS)} a thumb needs`
            )
          }
        }

        for (const pinned of trails.pinned) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: the trail \`${pinned.said}\` is held ${pinned.how} by ${pinned.held}, so it never scrolls away`
          )
        }
      }
    }
  } finally {
    await browser.close()
    await server.stop()
  }

  // Counted from both ends. A run that found no rows to compare reports the same clean nothing as a run where every column held.
  if (rowsSeen < AT_LEAST_THIS_MANY_ROWS) {
    throw new Error(
      `Only ${String(rowsSeen)} repeated rows were measured across every screen, which is too few to have looked.`
    )
  }

  if (figuresSeen < AT_LEAST_THIS_MANY_FIGURES) {
    throw new Error(
      `Only ${String(figuresSeen)} figures were measured across every screen, which is too few to have looked.`
    )
  }

  if (cellsSeen < AT_LEAST_THIS_MANY_CELLS) {
    throw new Error(
      `Only ${String(cellsSeen)} table cells were measured across every screen, which is too few to have looked.`
    )
  }

  if (trailsSeen < AT_LEAST_THIS_MANY_TRAILS) {
    throw new Error(
      `Only ${String(trailsSeen)} trails were measured across every screen, which is too few to have looked.`
    )
  }

  // The same floor for the sixth question, and it needs its own: `[data-removes]` is an attribute two components put on themselves, and an attribute nobody renders any more reports exactly what an app whose ways out are all big enough reports.
  if (removesSeen < AT_LEAST_THIS_MANY_REMOVE) {
    throw new Error(
      `Only ${String(removesSeen)} controls that remove something were measured on a phone, which is too few to have looked -- there were thirteen the day this was written, and they are the controls where a mis-tap costs a row.`
    )
  }

  if (linesSeen < AT_LEAST_THIS_MANY_LINES) {
    throw new Error(
      `Only ${String(linesSeen)} lines that must be read were measured across every screen, which is too few to have looked -- a component that stopped marking itself reports exactly what an app that cuts nothing off reports.`
    )
  }

  if (choicesSeen < AT_LEAST_THIS_MANY_CHOICES) {
    throw new Error(
      `Only ${String(choicesSeen)} choices were measured on a phone, which is too few to have looked -- there were thirty-two the day this was written, and a row of them is the control a day sheet is tapped on four times per entry.`
    )
  }

  if (tappedSeen < AT_LEAST_THIS_MANY_TAPPED) {
    throw new Error(
      `Only ${String(tappedSeen)} nav controls were measured on a phone, which is too few to have looked -- and the nav being unreachable from the gallery is how this went unmeasured in the first place.`
    )
  }

  if (wrong.length > 0) {
    console.error(`A column of figures does not read as one:\n\n${wrong.join('\n')}\n`)
    console.error(
      'A grid written once per row sizes a content-shaped track to that row alone: declare the tracks once on the list and give every row `grid-cols-subgrid`. A figure cut in half reads as a smaller figure rather than an incomplete one. A column squeezed to a letter a line is a column that should have left the row — give a phone fewer columns rather than narrower ones. A trail inside a sticky header is a screen saying where you are twice at once: navigation scrolls off, identity stays. And a nav row a thumb cannot hit is the whole navigation on a phone -- give the phone the taller rows and leave the desk its own.'
    )
    process.exitCode = 1

    return
  }

  console.log(
    `Every column holds, no figure is cut, nothing is squeezed, nothing that must be read is cut off, no trail is pinned and every nav control, every way out and every choice clears ${String(A_THUMB_NEEDS)}px on a phone, across ${String(rowsSeen)} rows, ${String(figuresSeen)} figures, ${String(cellsSeen)} cells, ${String(linesSeen)} lines that must be read, ${String(trailsSeen)} trails, ${String(tappedSeen)} nav controls, ${String(removesSeen)} controls that remove something and ${String(choicesSeen)} choices, at ${String(SCREENS_READ_ON.length)} widths.`
  )
}

await main()
