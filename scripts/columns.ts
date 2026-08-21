import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from 'playwright'

import { GALLERY, everyScreenItShows, serveTheGallery, unfoldIt } from './theGallerysOwnServer'

// What the browser actually drew, measured rather than described. It began with one question -- whether a column of figures is a column -- and each one since was added the day something got past every check we had: a figure cut in half, a column squeezed to a letter a line, a trail pinned beside the heading that repeats it.

// Eight questions now, and still not *is this usable*. Say which were asked when quoting a clean run; a passing sweep is a reason people stop opening the pictures. Two of them had to change the app to be askable at all: the nav was inside the one component nothing here can draw, and no measurement can tell a name that may be cut from a cheque number that may not -- so the page says which is which.

// `width.test.ts` asserts every figure goes through `<Figure>`, for the stated reason that it is what makes a column of amounts read as one. That guard passes, every figure is in the right face, and the grid moved the columns anyway. It is the one instrument here answering exactly the right question, truthfully, while the outcome it stands in for does not happen -- and nothing else in this repository could see the difference, because nothing else in it lays anything out.

// The defect it is here to stop: a grid written once per row sizes a content-shaped track to that row's own content, so the column lands wherever that row happens to need it. Four screens had it, and the three that did not were not defended against it -- their last cell simply happened to be the same width every time.

// A width list is a claim about which devices exist, and it needs the same scepticism as a selector. This one said phone, breakpoint, desk -- and it had never rendered the state his own phone is in when he turns it sideways to read a column of figures, which is 852 CSS px and lands above every breakpoint the app has.

// Nothing here found that. It was found by somebody measuring the built app at a width the list did not contain, which is the one thing a list cannot do for itself.

/** A phone, the same phone turned sideways, the width the rail appears at, and a desk. */
const SCREENS_READ_ON = [
  { width: 390, height: 844 },
  { width: 852, height: 393 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]

/** The floor. A run that measured nothing reports the same clean nothing as an app whose columns all line up. */
const AT_LEAST_THIS_MANY_ROWS = 20

/** The same floor for the other half. A selector that stopped finding figures reports the same clean nothing as a screen where none is cut. */
const AT_LEAST_THIS_MANY_FIGURES = 100

/** The same floor again. A selector that stopped finding cells reports the same clean nothing as an app where none is squeezed. */
const AT_LEAST_THIS_MANY_CELLS = 100

/** What a thumb needs, which Apple's guidance and WCAG 2.5.5 arrive at separately. The same bar that made the date input a defect in #96, asked of every standalone control. */
const A_THUMB_NEEDS = 44

// The other bar, for a link sitting in a line of text or at the start of a table row, and it is WCAG 2.5.8's number: 24 across. Holding all fifteen of these to 44 doubles every table in the app, which is the exemption somebody argues for the first time it would.

// Twenty-four across is not enough on its own. A column of house names each 24 tall and eight pixels apart passes it, and that is the failure that actually costs somebody something -- a thumb aimed at one house opening the one below it.

// So the same number is asked twice: 24 across, **and** 24 clear from the centre of any other target. Two circles 24 wide do not intersect exactly when their centres are 24 apart.

// Said plainly rather than dressed as the standard: **this is stricter than 2.5.8, deliberately.** There, spacing is an *alternative* offered to a target that is under 24 -- a target that reaches 24 needs no clearance at all. Read faithfully, the spacing half here would apply to nothing, because everything now reaches 24: a rule that cannot fire.

// Kept as a rule of its own because the thing it protects is real whatever a standard permits, and because a guard whose second half is unreachable is a guard with one half. The plant is a second link put beside a house name in the dashboard table; it lands 16px away and this names it.
const A_LINE_NEEDS = 24

// This was `A_PHONE_IS_UNDER = 768`, and the sentence under it described a shell that no longer exists: below it a sheet, above it a column under a mouse. There is no sheet, and above 768 the rail is the only navigation there is -- so every touch device from a tablet up was getting rows the sweep never asked about, at a width it never ran at.

// The widths were a premise rather than a measurement, inherited from a shape that was deleted. So the question is asked of the pointer instead, at every width, in a context that reports a coarse one -- which is what the app's own rule now keys on.

// The floor for it. Every other check here counts what it saw; this one saw nothing at all until it was written, which is exactly how the nav stayed 32px.

// Its subject has moved twice and the number did not, which is the failure a floor is itself vulnerable to. It was five when the sheet held five rows; it stayed five when the sheet was deleted and a strip held five; and with the sheet back it would be satisfied by a sweep that opened nothing and found the hamburger alone. So it is set from what the nav actually contains: six rows and a sign-out in the rail, the same again in the sheet, and the button that opens it -- at four widths.

// Two floors now, because widening the question would have let one of them stop meaning anything. A sweep of every control sees a thousand of them, so a number set from what the nav contains would be cleared by the app's buttons alone -- and the sheet could go back to never being opened without the count moving.

/** Well under what a sweep of every control sees, and far above a run that stopped at one screen. */
const AT_LEAST_THIS_MANY_TAPPED = 700

/** The nav's own floor, kept separate for the reason above: it is the one that proves the sheet was opened. Six rows and a sign-out in the rail, the same again in the sheet, and the button that opens it, at four widths. */
const AT_LEAST_THIS_MANY_NAV_ROWS = 40

/** And once more for the trails. Only the screens with something above them draw one, so this is well under what a full sweep sees -- but a `data-slot` renamed under us would report every trail unpinned across an app whose trails it never found. */
const AT_LEAST_THIS_MANY_TRAILS = 20

/** The floor for the seventh question. `data-must-be-read` is an attribute one component puts on itself, and an attribute nobody renders any more reports exactly what an app that cuts nothing off reports. */
const AT_LEAST_THIS_MANY_LINES = 4

// Handed to the browser as text rather than as a function, so this file stays a Node script with no DOM types in it -- the same reason the pictures are taken through the locator API. What comes back is checked below rather than trusted, because a string evaluated in a page can return anything at all.

// Three things it is careful about. A class worn by one element is not a column of anything, so only a row written once and drawn many times is compared. And a cell that is not drawn has no position while a browser still answers 0 for it: counted as a column at x=0, every row with an optional cell reads as broken -- `their-account` shows `Billed` or `Paid` and never both, and reading that absence as a position is the instrument inventing the defect it went looking for.

// The third is how many columns the grid actually has, and it is what makes "the same class twice" mean anything. Two rows of one list declare the same tracks and have to line up. Two separate questions can now wear the same class and declare a different number of columns, because a row of choices takes its count from a variable: `coming-in` asks `What this money is` down one column and `How it came` across four, and grouped by class alone that reported six defects that nothing anywhere should line up.

// Grouping by the parent was the first answer and it was wrong in the way that matters: it silently stopped comparing three real lists -- `sites`, `more` and `who-is-on-this-house` -- whose rows each sit in a wrapper of their own, and the count fell from 108 to 81 while reading as a clean sweep. A defective list still declares one shape and resolves it differently per row, so a count of tracks separates the two questions and keeps every row of every list.

// What it does cost, said rather than left in the count: 108 rows to 102. Six of those are the two questions on `coming-in` at three widths, which is the point. The other six are one pair on `who-is-on-this-house` -- a subgrid row of seven columns beside one that spans the list as a single track -- and all that pair ever compared was their first cell, which under subgrid is the list's own left edge and agrees whatever happens.

// Measured from each grid's own left edge rather than from the page's. For rows of a list the two are the same number -- every row starts where the list starts -- so nothing about the original defect changes.

// What it fixes is a grid whose copies are **side by side**. His Sites screen is a card a house, three across at 1280, and each card holds a three-up of `Spent` / `Estimate` / `Received`: same class list, same tracks, three different left edges. Read against the page, cell two of the middle card is 612px from cell two of the first and the sweep reports a column that moved. Read against its own card, all three agree, which is what a person sees.

// The absolute reading was right while every grid in a group was a row stacked under the last one. It stopped being right the moment a screen drew the same grid in two places at once, and it reported that as the defect it was built to find.
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

    const lefts = drawn.map((row) => {
      const from = row.getBoundingClientRect().left

      return [...row.children].map((cell) => {
        const box = cell.getBoundingClientRect()
        return box.width === 0 && box.height === 0 ? null : Math.round(box.left - from)
      })
    })

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

// WHAT EACH OTHER ANSWER WOULD HAVE MEANT, because this pair was wrong in three different ways before it was right and each way printed a number that had to be read rather than a colour. Three states are built on one screen -- a figure too big for its own box, a figure too big for its cell inside a scrolling table, and a table drawn wider than its own panel, which is a design and not a fault.

// `12/27/0` is correct. `0/0/0` is blind, or a plant that built nothing, or a file that did not compile. `12/0/0` is an exemption too broad, which has swallowed the case inside the table. `12/27/40` is the exemption gone, and every wide table reporting every run for ever.

// A single count of zero is all four of the first row's causes at once, which is how a blind survey was nearly published as a finding, twice.

// A FIGURE ON TWO LINES IS THE SAME LIE WITHOUT A BOX TO BLAME. `883,701` broken after `883,7` reads as a smaller figure, and there is even less saying otherwise than when a container clips it: nothing is hidden, so nothing is clipping, so the question above answers no. The question below answers no too, because a wrapped cell occupies its box neatly and a column of them is still a column. On the payables rail a phone drew exactly that for as long as the screen has existed, and this file called it clean at four widths every time it was asked.

// Asked of the page as first drawn rather than of what a scroll could reveal, because what a person sees is the first state. And a figure with no box answers 0 for every edge, which is the same not-there-reading-as-a-value the sweep above already skips.
const WHAT_IS_CUT_IN_HALF = `(() => {
  const clipping = (el) => {
    const how = getComputedStyle(el)
    return how.overflowX === 'auto' || how.overflowX === 'scroll' || how.overflowX === 'hidden'
  }

  const cut = []
  const broken = []
  const spilling = []
  let figures = 0

  for (const figure of document.querySelectorAll('.tabular-nums')) {
    const box = figure.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    figures += 1

    // Where the text really is, which is not where its element is. A figure that overflows sits outside its own box, so the box answers for the space it was given rather than the space it takes.
    const over = document.createRange()
    over.selectNodeContents(figure)
    const rects = [...over.getClientRects()]
    if (rects.length === 0) continue

    const textLeft = Math.min(...rects.map((rect) => rect.left))
    const textRight = Math.max(...rects.map((rect) => rect.right))

    // The worst of them and not one line each: a figure can sit inside several things that clip, and the same figure reported three times reads as three defects.
    let worst = 0

    // Held rather than reported, because whether it counts depends on something the walk has not reached yet.
    let candidate = null
    let scrolls = false

    // What is too big, carried up the tree. It starts as the text and becomes whatever box failed to hold it, because the thing that overflows is not always the text: a cell floored at its own content fits its figure exactly and is itself the thing that lands on the column beside it. Asking only about the text reports that clean.
    let inside = { left: textLeft, right: textRight }

    // Starting at the figure itself and not at its parent. The first box that can fail to hold a figure's text is the figure's own: give one a fixed width and the text leaves it while every ancestor still contains it comfortably, so a walk that begins one level up finds nothing to report and says so.
    for (let above = figure; above !== null; above = above.parentElement) {
      const holds = above.getBoundingClientRect()

      if (!clipping(above)) {
        // Nothing is hiding it, so every pixel is on the screen -- lying on whatever is drawn beside it. The nearest one only: further out everything contains it again, and naming them all would report one spill six times.
        const outside = Math.round(Math.max(0, holds.left - inside.left) + Math.max(0, inside.right - holds.right))

        if (outside > 1 && holds.width > 0 && candidate === null) {
          candidate = {
            said: figure.textContent.trim().slice(0, 24),
            outside,
            width: Math.round(holds.width),
            // Whether the thing that got out is still the figure's own text, measured exactly rather than counted in levels: the extent is the text's until some box on the way up is wider than it.
            wasText: inside.left === textLeft && inside.right === textRight,
            // Which level gave way, because a figure too big for its cell and a cell too big for its column are different bugs with different fixes.
            over: above.tagName.toLowerCase() + (above.className ? '.' + String(above.className).trim().split(/\\s+/)[0] : ''),
          }
        }

        inside = { left: Math.min(inside.left, holds.left), right: Math.max(inside.right, holds.right) }
        continue
      }

      // SOMETHING ABOVE IT SCROLLS. That does not excuse everything underneath: a figure whose own text has left its cell is a defect inside a wide table exactly as it is outside one. What it excuses is a BOX deliberately wider than the box above it -- \`TablePanel\` is \`overflow-x-auto\` wrapping a \`min-w-full\` div precisely so a table may be wider than the panel, and reporting that is reporting the pattern working.

      // So the two are told apart by what left the box: still the figure's own text, or a box that grew. Clamping the extent was the first attempt and changed nothing, because the box being overflowed sits inside the scroller and is judged long before the walk reaches it.
      scrolls = true

      inside = { left: Math.max(inside.left, holds.left), right: Math.min(inside.right, holds.right) }

      const hidden = Math.round(Math.max(0, holds.left - box.left) + Math.max(0, box.right - holds.right))

      // A whole figure outside the container is off-screen rather than cut in half, and that is the pattern working: nothing of it is being read.
      if (hidden > 0 && hidden < Math.round(box.width)) worst = Math.max(worst, hidden)
    }

    // A figure whose own text has left its box is a defect wherever it happens. A box deliberately wider than the one above it, inside something built to scroll, is the pattern working -- so only that combination is let through.
    if (candidate !== null && (candidate.wasText || !scrolls)) {
      spilling.push({ said: candidate.said, outside: candidate.outside, width: candidate.width, over: candidate.over })
    }

    if (worst > 0) {
      cut.push({ said: figure.textContent.trim().slice(0, 24), hidden: worst, width: Math.round(box.width) })
    }

    // Counted off the same range, because height answers for whatever box the figure happens to sit in and the lines are a property of the text. One rect per line box, so the tops are the lines.
    const lines = new Set(rects.map((rect) => Math.round(rect.top))).size

    if (lines > 1) {
      broken.push({ said: figure.textContent.trim().slice(0, 24), lines, width: Math.round(box.width) })
    }
  }

  return { figures, cut, broken, spilling }
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

// It asked `[data-nav-row]`, and the sentence here said why it asked so little: *a first pass over every control in the app at 390 found 104 of 151 under this bar, which is a real finding and a different piece of work.*

// That figure was measured through the harness. An unscoped sweep of this page finds **the gallery's own screen picker** -- thirty-odd buttons at 34px, drawn on every one of thirty-two screens -- so most of what it counted was not the app. Asked again with the picker excluded, it is 53 controls out of 1,117 measurements. The reason for narrowing the question was itself an unmeasured number, which is the thing this file exists to refuse.

// Before that it asked shadcn's `data-sidebar="menu-button"`: a generator's attribute, owned by whatever the next `shadcn add` writes. It found zero and refused, which is the floor working. But fixing the ownership problem narrowed the *subject* -- from every shadcn menu button to every row we tag -- and the narrowing is invisible, because 48 measured controls reads as better coverage than 7 while a whole class drops out. **Neither version ever asked the question this is named for**, and the sheet's own close button lived in the gap between the two definitions: inside our sheet, shadcn's markup, wearing none of our attributes.

// So it asks what a person can press, and takes the answer from what the page is rather than from what anything is called.

/** Two bars, because there are two kinds of target and one number for both is a number somebody argues an exemption out of. */
const WHAT_A_THUMB_CANNOT_HIT = `(() => {
  const asked = [
    'button',
    'a[href]',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="option"]',
    '[role="switch"]',
    '[role="checkbox"]',
    '[role="radio"]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
  ].join(',')

  const small = []
  const targets = []
  let tapped = 0
  let navRows = 0

  // Which plane a control sits on: the nearest ancestor that positions itself. Two controls on different planes are not near each other in any stable way -- one of them moves independently of the other as the page scrolls, so the gap between them is a fact about a scroll position rather than about the layout.
  const stuckTo = (el) => {
    for (let up = el.parentElement; up !== null && up !== document.body; up = up.parentElement) {
      const how = getComputedStyle(up).position
      if (how === 'fixed' || how === 'sticky') return up
    }

    return null
  }

  for (const control of document.querySelectorAll(asked)) {
    // The gallery's own chrome is not the app. Its screen picker is thirty-odd buttons on every screen, which is most of what an unscoped sweep finds -- and counting them is how the recorded reason for not doing this got its number.
    if (control.closest('[data-slug]') !== null) continue

    // Two exemptions, and both are a property the page states rather than a name somebody chose. A control that stops being hidden or disabled comes back into this sweep by itself.

    // \`aria-hidden\`: base-ui gives every combobox a 1x1 \`*-hidden-input\` to carry the form value. Nobody can see it and nobody can reach it.

    // \`aria-disabled\`: shadcn's \`BreadcrumbPage\` is a \`span role="link" aria-disabled="true"\` -- the screen you are already on, drawn like the steps above it and pressing nowhere. Eleven of them, and every one a false positive.

    // There was a third, and taking it out is the best thing that happened to this sweep. \`tabindex="-1"\` was written to catch the same hidden input, and it reads as unarguable -- a control nobody can tab to. But **not-focusable and not-tappable are different facts**, and the difference is exactly a mouse: a combobox's chevron and its clear button both carry \`tabindex="-1"\` because the input owns the keyboard, and both are pressed with a finger all day.

    // It was hiding **184 measurements** and two real defects, both 24 by 24, one of which empties a field somebody has just filled. The count went from 793 to 977 by deleting one line. An exemption written on a property the page states can still be an exemption about the wrong property, and this one had every quality we ask of a good exemption except being true.
    if (control.getAttribute('aria-hidden') === 'true') continue
    if (control.getAttribute('aria-disabled') === 'true') continue

    const box = control.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue

    tapped += 1
    if (control.hasAttribute('data-nav-row')) navRows += 1

    const said =
      (control.getAttribute('aria-label') || (control.textContent ?? '').trim() || control.getAttribute('placeholder') || '')
        .slice(0, 32) || 'a control with no words on it'

    // Which bar a control answers to, decided by what it is and how tall it is rather than by a list of names.

    // A \`button\`, an \`input\`, anything with a control's role: 44, always. Whether it is drawn as a box or as text on a line is a look, and \`WayOut\` already shows a text-drawn control reaching 44 with \`py-3 -my-3\` -- padding a finger lands on, given straight back to the layout, so nothing moves.

    // A link gets the other bar, and only when it is a run of words rather than a box: no border, no background of its own, and a content height of exactly one line. That is WCAG 2.5.8's wording for what it exempts -- *its size is otherwise constrained by the line-height of non-target text* -- read as three things the page can be asked.

    // A nav row is a control whether or not it is drawn as one, said here rather than left to the shape: an inactive row has no border and no background and is one line of words, and the whole reason any of this exists is that those rows were 32px.

    // Two wrong versions before this, and both looked clean. \`display === 'inline'\` was the first: a flex or grid parent **blockifies** its children, so every anchor in this app computes to \`block\`, including the ones sitting in a line of text -- fifteen text links on the 44 bar.

    // The second asked whether the box height equalled the line-height, which is the same sentence read one word short. It classified correctly and then **the remedy undid the classification**: giving a 20px link the four pixels it needed made its box 24 and its box was no longer its line, so it left the rule that had just been applied to it and failed the other one. A rule whose own fix moves a thing out of its scope has no fixed point.
    const style = getComputedStyle(control)
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    const boxed =
      style.borderTopWidth !== '0px' ||
      style.borderBottomWidth !== '0px' ||
      (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent')

    const isALink = control.tagName === 'A' || control.getAttribute('role') === 'link'
    const inALine =
      isALink && !boxed && !control.hasAttribute('data-nav-row') && Math.round(box.height - padding) <= Math.round(line) + 1

    targets.push({ x: box.x + box.width / 2, y: box.y + box.height / 2, said, inALine, stuck: stuckTo(control) })

    // WCAG 2.5.5 and Apple's guidance arrive at 44 separately, and it is what a standalone control is held to here.

    // A link inside a line of text is held to WCAG 2.5.8 instead -- 24, plus a 24px circle nothing else's circle may enter -- which is the AA rule written for exactly this case. Sizing every house name in a table to 44 doubles the table; the thing that actually costs somebody money is a mis-tap onto the *wrong house*, and spacing is what measures that.
    const floor = inALine ? ${String(A_LINE_NEEDS)} : ${String(A_THUMB_NEEDS)}

    if (Math.round(box.height) < floor || Math.round(box.width) < floor) {
      small.push({ said, high: Math.round(box.height), wide: Math.round(box.width), floor })
    }
  }

  // The spacing half, and only for the ones sitting in a line. Asked of every one of them rather than only of the undersized, which is where this parts company with 2.5.8 on purpose: there, clearance is the concession offered to a target under 24, so a rule read faithfully would apply to nothing once everything reaches 24.

  // Pairs on the same plane only, and that is a correction rather than an exemption. A sticky footer is pinned to the viewport and passes over every link on the page as somebody scrolls -- so it comes within 24px of one of them at some scroll position, always, and holding it to clearance from the things it scrolls past measures the scroll rather than the layout.

  // Found when a one-word change to a footer button made it one line shorter, and its centre moved 12px into range of a trail link 770px above it in the document. Nothing about that pair could collide under a thumb: the trail scrolls and the footer does not.
  const crowded = []

  for (let one = 0; one < targets.length; one += 1) {
    if (!targets[one].inALine) continue

    for (let other = 0; other < targets.length; other += 1) {
      if (one === other) continue
      if (targets[one].stuck !== targets[other].stuck) continue

      const apart = Math.hypot(targets[one].x - targets[other].x, targets[one].y - targets[other].y)

      if (apart < ${String(A_LINE_NEEDS)}) {
        crowded.push({ said: targets[one].said, near: targets[other].said, apart: Math.round(apart) })
      }
    }
  }

  return { tapped, navRows, small, crowded }
})()`

// The ninth question, and it came out of the eighth. `ROOM_FOR_A_THUMB` grows the box a finger lands on past the box anybody sees, so a control can clear 44 in every direction and still be standing on its neighbour -- and a sweep that measures each control on its own reports both of them clean.

// It found four pixels of `Yes, remove` underneath `Cancel`. Not a control that is hard to hit: a control that is easy to hit **by mistake**, on the pair where the mistake removes a row somebody has to remember to re-enter. Nothing in this file could have seen it, because every question here until now was about one element at a time.

// Asked only of pairs that sit in the same plane. A sticky bar sits over the content behind it and an open sheet sits over the trigger that opened it -- those are two things where one is deliberately in front, the top one takes the tap, and that is the whole design. What is wrong is two peers on one line each reaching into the other, where a tap near the join lands on whichever happens to be later in the document.

// Which plane a control is in is read off the page rather than reasoned about: it is the nearest ancestor that is positioned, or the body when there is none.

// The first version asked whether an element was in the *ordinary flow* -- nothing positioned anywhere above it -- and const-2 named what that also drops. A dialog is `fixed` and a sheet is `fixed`, so **every control inside the search and inside the phone nav was invisible to this question at every width**: counted by the 44px pass, never compared with anything by this one. The search is a list of rows a thumb goes down and the newest thing in the app; the sheet's rows are twenty-five controls nothing had measured until yesterday.

// So it is the same plane rather than no plane. Two peers on a line inside a dialog is the same defect as two peers on a line in the page, and what wants excluding is *one thing deliberately in front of another* -- which is a pair whose planes differ, not a pair that is positioned at all.
const WHAT_STANDS_ON_WHAT = `(() => {
  const planes = []

  const planeOf = (el) => {
    let found = document.body

    for (let up = el.parentElement; up !== null && up !== document.body; up = up.parentElement) {
      const how = getComputedStyle(up).position
      if (how === 'fixed' || how === 'sticky' || how === 'absolute' || how === 'relative') {
        found = up
        break
      }
    }

    let at = planes.indexOf(found)
    if (at === -1) {
      at = planes.length
      planes.push(found)
    }

    return at
  }

  const boxes = []

  for (const control of document.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,summary,[role="button"],[role="radio"],[role="switch"],[role="checkbox"],[role="tab"],[role="option"],[role="menuitem"]')) {
    if (control.closest('[data-slug]') !== null) continue
    if (control.getAttribute('aria-hidden') === 'true') continue
    if (control.getAttribute('aria-disabled') === 'true') continue

    const box = control.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue

    boxes.push({
      said: (control.getAttribute('aria-label') || (control.textContent ?? '').trim() || 'a control with no words on it').slice(0, 32),
      plane: planeOf(control),
      x: box.x,
      y: box.y,
      right: box.x + box.width,
      bottom: box.y + box.height,
    })
  }

  const standing = []

  for (let one = 0; one < boxes.length; one += 1) {
    for (let other = one + 1; other < boxes.length; other += 1) {
      const a = boxes[one]
      const b = boxes[other]

      if (a.plane !== b.plane) continue

      const across = Math.round(Math.min(a.right, b.right) - Math.max(a.x, b.x))
      const down = Math.round(Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y))

      // A pixel of touching is a rounding artefact rather than a shared target.
      if (across > 1 && down > 1) {
        standing.push({ said: a.said, near: b.said, apart: -Math.min(across, down) })
      }
    }
  }

  return { tapped: boxes.length, navRows: 0, small: [], crowded: standing }
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

/** A figure the browser drew on more than one line, which no box is hiding and no column is squeezing. */
type Broken = { said: string; lines: number; width: number }

/** A figure whose content left the box meant to hold it, with nothing hiding the part that got out. */
type Spilling = { said: string; outside: number; width: number; over: string }

type Crushed = { said: string; wide: number; tall: number }

type Pinned = { said: string; how: string; held: string }

type TooSmall = { said: string; high: number; wide: number }

type Crowded = { said: string; near: string; apart: number }

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
function whatIsCut(said: unknown): {
  figures: number
  cut: Array<Cut>
  broken: Array<Broken>
  spilling: Array<Spilling>
} {
  if (
    typeof said !== 'object' ||
    said === null ||
    !('figures' in said) ||
    !('cut' in said) ||
    !('broken' in said) ||
    !('spilling' in said)
  ) {
    throw new Error('The page answered something that is not a count of figures.')
  }

  const { figures, cut, broken, spilling } = said
  if (typeof figures !== 'number' || !Array.isArray(cut) || !Array.isArray(broken) || !Array.isArray(spilling)) {
    throw new Error('The page answered a count with no figures or no findings in it.')
  }

  return {
    figures,
    spilling: spilling.map((one: unknown) => {
      if (
        typeof one !== 'object' ||
        one === null ||
        !('said' in one) ||
        !('outside' in one) ||
        !('width' in one) ||
        !('over' in one)
      ) {
        throw new Error('The page answered a spilling figure with nothing in it.')
      }

      const { said: text, outside, width, over } = one
      if (typeof text !== 'string' || typeof outside !== 'number' || typeof width !== 'number') {
        throw new Error('The page answered a spilling figure of the wrong shape.')
      }

      return { said: text, outside, width, over: String(over) }
    }),
    broken: broken.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('lines' in one) || !('width' in one)) {
        throw new Error('The page answered a broken figure with nothing in it.')
      }

      const { said: text, lines, width } = one
      if (typeof text !== 'string' || typeof lines !== 'number' || typeof width !== 'number') {
        throw new Error('The page answered a broken figure of the wrong shape.')
      }

      return { said: text, lines, width }
    }),
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

/** The widened fifth, checked the same way and for the same reason, and separately because it answers four things rather than two. */
function whatCannotBeHit(said: unknown): {
  tapped: number
  navRows: number
  small: Array<TooSmall & { floor: number }>
  crowded: Array<Crowded>
} {
  if (
    typeof said !== 'object' ||
    said === null ||
    !('tapped' in said) ||
    !('navRows' in said) ||
    !('small' in said) ||
    !('crowded' in said)
  ) {
    throw new Error('The page answered something that is not a sweep of what a thumb can hit.')
  }

  const { tapped, navRows, small, crowded } = said
  if (typeof tapped !== 'number' || typeof navRows !== 'number' || !Array.isArray(small) || !Array.isArray(crowded)) {
    throw new Error('The page answered a sweep with no counts or no findings in it.')
  }

  return {
    tapped,
    navRows,
    small: small.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('high' in one) || !('floor' in one)) {
        throw new Error('The page answered a control with nothing in it.')
      }

      const { said: text, high, wide, floor } = one as Record<string, unknown>
      if (
        typeof text !== 'string' ||
        typeof high !== 'number' ||
        typeof wide !== 'number' ||
        typeof floor !== 'number'
      ) {
        throw new Error('The page answered a control of the wrong shape.')
      }

      return { said: text, high, wide, floor }
    }),
    crowded: crowded.map((one: unknown) => {
      if (typeof one !== 'object' || one === null || !('said' in one) || !('near' in one) || !('apart' in one)) {
        throw new Error('The page answered a crowding with nothing in it.')
      }

      const { said: text, near, apart } = one as Record<string, unknown>
      if (typeof text !== 'string' || typeof near !== 'string' || typeof apart !== 'number') {
        throw new Error('The page answered a crowding of the wrong shape.')
      }

      return { said: text, near, apart }
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
  let navRowsSeen = 0
  let standingSeen = 0
  let removesSeen = 0
  let choicesSeen = 0
  let linesSeen = 0

  try {
    const page = await browser.newPage({ hasTouch: true })
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

        for (const spill of figures.spilling) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: ${spill.said} is ${String(spill.outside)}px outside the ${spill.over} that holds it — nothing hides it, so it is lying on whatever is drawn beside it`
          )
        }

        for (const broken of figures.broken) {
          wrong.push(
            `${screen.slug} at ${String(size.width)}: ${broken.said} is drawn on ${String(broken.lines)} lines in ${String(broken.width)}px — the first line reads as the whole figure and nothing says there is more`
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

        {
          const thumb = whatCannotBeHit(await page.evaluate(WHAT_A_THUMB_CANNOT_HIT))
          tappedSeen += thumb.tapped
          navRowsSeen += thumb.navRows

          for (const small of thumb.small) {
            wrong.push(
              `${screen.slug} at ${String(size.width)}: ${small.said} is ${String(small.high)}px high and ${String(small.wide)} wide, under the ${String(small.floor)} it needs`
            )
          }

          for (const near of thumb.crowded) {
            wrong.push(
              `${screen.slug} at ${String(size.width)}: "${near.said}" and "${near.near}" are ${String(near.apart)}px apart, inside the ${String(A_LINE_NEEDS)} this keeps clear around a link`
            )
          }

          const standing = whatCannotBeHit(await page.evaluate(WHAT_STANDS_ON_WHAT))
          standingSeen += standing.tapped

          for (const on of standing.crowded) {
            wrong.push(
              `${screen.slug} at ${String(size.width)}: "${on.said}" and "${on.near}" overlap by ${String(-on.apart)}px. ` +
                `Both are in the flow of the page, so a tap near the join lands on whichever is later in the document rather than on the one it was aimed at.`
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
      `Only ${String(tappedSeen)} controls were measured under a thumb, which is too few to have looked -- and a selector that stopped matching reports the same clean nothing as an app a thumb can use.`
    )
  }

  if (standingSeen < AT_LEAST_THIS_MANY_TAPPED) {
    throw new Error(
      `Only ${String(standingSeen)} controls were compared against each other, which is too few to have looked -- and a comparison of nothing with nothing reports exactly what an app where no two targets overlap reports.`
    )
  }

  if (navRowsSeen < AT_LEAST_THIS_MANY_NAV_ROWS) {
    throw new Error(
      `Only ${String(navRowsSeen)} nav rows were among them, which means the sheet was never opened -- and the nav being unreachable from the gallery is how this went unmeasured in the first place.`
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
    `Every column holds, no figure is cut, no figure is drawn on two lines or lying outside the box that holds it, nothing is squeezed, nothing that must be read is cut off, no trail is pinned, every control clears ${String(A_THUMB_NEEDS)}px under a thumb and every link in a line clears ${String(A_LINE_NEEDS)} with ${String(A_LINE_NEEDS)} kept clear around it, no two controls in one plane stand on each other, across ${String(rowsSeen)} rows, ${String(figuresSeen)} figures, ${String(cellsSeen)} cells, ${String(linesSeen)} lines that must be read, ${String(trailsSeen)} trails, ${String(tappedSeen)} controls (${String(navRowsSeen)} of them nav rows), ${String(removesSeen)} controls that remove something and ${String(choicesSeen)} choices, at ${String(SCREENS_READ_ON.length)} widths.` +
      // The levers, beside the number, permanently. A zero read on its own says nothing about whether anything was looked at -- this file has produced a zero from a blind instrument, a zero from a plant that built nothing, and a zero from a program that did not compile, and all three read exactly like a clean run.
      `\nThe three about a figure were last seen to answer 12 for a figure out of its own box, 27 for a figure out of its cell inside a scrolling table, and 0 for a table drawn wider than its own panel -- which is the pattern working, and which answered 40 before this file could tell the two apart.`
  )
}

await main()
