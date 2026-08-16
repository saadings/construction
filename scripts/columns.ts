import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from 'playwright'

import { GALLERY, everyScreenItShows, serveTheGallery } from './theGallerysOwnServer'

// What the browser actually drew, measured rather than described. It began with one question -- whether a column of figures is a column -- and each one since was added the day something got past every check we had: a figure cut in half, a column squeezed to a letter a line, a trail pinned beside the heading that repeats it.

// Four questions now, and still not *is this usable*. Say which were asked when quoting a clean run; a passing sweep is a reason people stop opening the pictures.

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

/** And once more for the trails. Only the screens with something above them draw one, so this is well under what a full sweep sees -- but a `data-slot` renamed under us would report every trail unpinned across an app whose trails it never found. */
const AT_LEAST_THIS_MANY_TRAILS = 20

// Handed to the browser as text rather than as a function, so this file stays a Node script with no DOM types in it -- the same reason the pictures are taken through the locator API. What comes back is checked below rather than trusted, because a string evaluated in a page can return anything at all.

// Two things it is careful about. A class worn by one element is not a column of anything, so only a row written once and drawn many times is compared. And a cell that is not drawn has no position while a browser still answers 0 for it: counted as a column at x=0, every row with an optional cell reads as broken -- `their-account` shows `Billed` or `Paid` and never both, and reading that absence as a position is the instrument inventing the defect it went looking for.
const WHERE_THE_COLUMNS_ARE = `(() => {
  const grids = [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).display === 'grid')

  const byClass = new Map()
  for (const el of grids) {
    const key = el.className.toString()
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

type Moved = { cls: string; cell: number; xs: Array<number> }

type Cut = { said: string; hidden: number; width: number }

type Crushed = { said: string; wide: number; tall: number }

type Pinned = { said: string; how: string; held: string }

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
        // Waited for by what the screen says rather than by a timer, the same way the pictures are.
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

        const cells = whatIsCrushed(await page.evaluate(WHAT_IS_CRUSHED))
        cellsSeen += cells.cells

        for (const crushed of cells.crushed) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: ${crushed.said} is squeezed into ${String(crushed.wide)}px and ${String(crushed.tall)}px tall`
          )
        }

        const trails = whatIsPinned(await page.evaluate(WHAT_IS_PINNED))
        trailsSeen += trails.trails

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

  if (wrong.length > 0) {
    console.error(`A column of figures does not read as one:\n\n${wrong.join('\n')}\n`)
    console.error(
      'A grid written once per row sizes a content-shaped track to that row alone: declare the tracks once on the list and give every row `grid-cols-subgrid`. A figure cut in half reads as a smaller figure rather than an incomplete one. A column squeezed to a letter a line is a column that should have left the row — give a phone fewer columns rather than narrower ones. And a trail inside a sticky header is a screen saying where you are twice at once: navigation scrolls off, identity stays.'
    )
    process.exitCode = 1

    return
  }

  console.log(
    `Every column holds, no figure is cut, nothing is squeezed and no trail is pinned, across ${String(rowsSeen)} rows, ${String(figuresSeen)} figures, ${String(cellsSeen)} cells and ${String(trailsSeen)} trails at ${String(SCREENS_READ_ON.length)} widths.`
  )
}

await main()
