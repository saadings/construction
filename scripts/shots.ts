import { existsSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type { Page } from 'playwright'
import { chromium } from 'playwright'

import { GALLERY, everyScreenItShows, serveTheGallery, unfoldIt } from './theGallerysOwnServer'

// A picture of every screen, at the three widths the app is read at, from the gallery's own build.

// This is the second half of what the gallery was for. The first half is a person opening it; this is so a pull request carries images rather than the sentence "not observed at any width", which three of them shipped with.

// One thing about running this and `yarn columns`, which both drive a browser, that looks like a defect and is not: `playwright` arrived with these scripts, so a `node_modules` from before it gives fifty-odd typecheck and lint errors that read as code problems -- `yarn install` first.

const SHOTS = resolve(import.meta.dirname, '..', 'shots')

// Real screens rather than widths with a made-up height. The middle one is not a guess either: shadcn's sidebar splits at 768, so it is the width where one answer becomes the other.

/** A phone, the width the sidebar changes at, and a desk. */
const SCREENS_READ_ON = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
]

/** The day every picture is taken on, so two runs a week apart are the same picture. The same day the gallery's fixtures are written around. */
const A_DAY = '2026-07-23'

/** How far down the app's screen may begin before the picture stops being a picture of a phone. Not zero, because a browser rounds a fractional layout; anything above this is furniture. */
const TOP_OF_THE_SCREEN = 2

/** How far down the page is, as the page itself says. Asked as text so this file stays a Node script with no DOM types in it, and checked rather than believed for the same reason the column measurements are: a string evaluated in a page can return anything at all, and an answer that is not a number would otherwise arrive as `NaN` and pass every comparison below. */
function howFarDown(said: unknown): number {
  if (typeof said !== 'number' || !Number.isFinite(said)) {
    throw new Error(`The page answered ${JSON.stringify(said)} when it was asked how far down it had been scrolled.`)
  }

  return said
}

// A screen taller than the viewport gets a second picture, scrolled to the bottom. The Dashboard is the first screen in this app that one viewport cannot hold, and its picture ends on the `What came in` heading with the chart entirely below the fold -- looking finished, because a viewport shot always does.

// Two viewport shots rather than one `fullPage`: full page distorts anything sticky, and it photographs the Dashboard's chart blank, because resizing the viewport makes recharts re-measure and the shot lands mid-remeasure. Each capture here stays a true viewport; only the scroll differs.

/** How much taller than the viewport a screen has to be before a second picture is a different picture. */
const WORTH_A_SECOND_PICTURE = 24

// A screen that drew nothing is not a short screen, and the two answer the same way: a page with no body is not taller than the viewport, so it gets one picture and is counted as having fitted. The marker wait above proves one string is visible; it does not prove a screen has body.

/** Shorter than this and it did not draw. The shortest real screen here is `How it looks`, at 344px on a phone. */
const TOO_SHORT_TO_BE_A_SCREEN = 200

// Where the app's screen starts once the page has stopped moving, or where it still is when it has given up.

// Scrolled, the screen's top goes negative by however far the page went -- so the same box that says a picture is a picture of a phone also says whether a second one would be a different picture.

// A picture taken while something is still arriving is a picture of an arrival. The nav below 768 is a sheet that slides in, and Playwright calls it visible the moment it has a box -- so the first picture of it was 30px of sheet and a screenful of the overlay behind it, which reads as a broken nav rather than a photograph taken too early.

// The box is not the whole of what moves. A bar chart grew its bars from nothing over about half a second while its own box was still from the first frame -- so the dashboard was photographed with every bar a few pixels high, and the picture said the houses had brought in almost nothing.

// It had been passing on luck rather than on a wait: the same picture taken minutes earlier caught the animation finished. A machine with a second gate running on it is enough to change which frame lands.

// What it asked for was `.recharts-bar-rectangle path`, which is a claim about a library and not about this app. recharts is gone now -- the chart it drew had no figure anywhere on it, so it became bars this app draws itself -- and that selector would have gone on finding nothing, joining nothing, and reporting a screen at rest forever. A wait that cannot notice movement is a wait that has been deleted without anybody deciding to.

// So it asks `[data-bar]`, which this repo puts on every bar it draws. Nothing here animates its width today, and that is the honest statement of what this now guards: the day something does -- a transition, a bar drawn off a reading that lands late -- the camera has a way to notice, and it is a way that survives whoever draws the bar.
const EVERY_BAR = '[data-bar]'

/** What is drawn, as one string: where the screen is, and how far along each bar in it has grown. */
async function asItStands(on: Page, shownIn: string): Promise<string | null> {
  const box = await on.locator(shownIn).boundingBox()

  if (box === null) {
    return null
  }

  const bars: string = await on.evaluate(
    `[...document.querySelectorAll('${EVERY_BAR}')].map((bar) => Math.round(bar.getBoundingClientRect().width)).join(',')`
  )

  return `${String(box.x)},${String(box.y)},${String(box.width)}|${bars}`
}

// Waited on the position rather than on a duration: an animation length is a number that goes stale, and `waitForTimeout` long enough for the slowest machine is a tax on every screen that is not moving at all.
async function onceItHasStoppedMoving(on: Page, shownIn: string): Promise<void> {
  const givingUp = 40

  let before = await asItStands(on, shownIn)

  for (let waited = 0; waited < givingUp; waited += 1) {
    await on.waitForTimeout(50)
    const now = await asItStands(on, shownIn)

    // Both read, and equality asked of a pair that exists: a `null` on either side is a thing that is not on the page, and calling that "not moving" is the not-there-reading-as-a-value this whole file keeps finding.
    if (before !== null && now !== null && before === now) {
      return
    }

    before = now
  }

  throw new Error(
    `${shownIn} was still moving after ${String(givingUp * 50)}ms, so any picture of it is a picture of an animation.`
  )
}

async function theTopOnceItHasMoved(on: Page): Promise<{ y: number } | null> {
  const givingUp = 40

  let box = await on.locator('[data-testid="the-screen"]').boundingBox()
  let before: number | null = null

  // Waited for **stillness** rather than for a number far enough up. A screen that starts below the fold passes through every value between its own top and the target, so a reading taken while it is still moving is a real position of a state nobody sees -- the same frame problem as photographing a dialog mid-animation, one page down.

  // It reported `spent-by-trade` as a screen that did not scroll, at a top of `0`, on a page that had in fact scrolled from 814 to -392. Zero was simply on the way past.
  for (let waited = 0; waited < givingUp; waited += 1) {
    if (box !== null && box.y === before) {
      return box
    }

    before = box?.y ?? null
    await on.waitForTimeout(50)
    box = await on.locator('[data-testid="the-screen"]').boundingBox()
  }

  return box
}

async function main(): Promise<void> {
  if (!existsSync(join(GALLERY, 'gallery.html'))) {
    throw new Error(`No gallery built at ${GALLERY}. Run \`yarn gallery:build\` first.`)
  }

  await rm(SHOTS, { recursive: true, force: true })
  await mkdir(SHOTS, { recursive: true })

  const server = await serveTheGallery()
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()
    await page.goto(server.at)

    // Read off the page rather than kept here. A list in this file is a list that drifts from the gallery, and the drift is silent: it photographs eleven screens and says nothing about the twelfth.
    const screens = await everyScreenItShows(page)

    if (screens.length === 0) {
      throw new Error('The gallery offered no screens. A picture of nothing is worse than no picture.')
    }

    await page.close()

    /** Every lower half this run decided was owed, named when the measurement said so rather than when a file was written. */
    const tooTall: Array<string> = []

    for (const size of SCREENS_READ_ON) {
      const on = await browser.newPage({ viewport: size })

      // Every form on these screens opens on today's date, which is right in the app and wrong in a picture: the same screenshot taken tomorrow differs by a date box, and a set of images that changes daily cannot be compared with anything. Frozen at the day the fixtures are written around.
      await on.clock.install({ time: new Date(`${A_DAY}T09:00:00`) })

      for (const screen of screens) {
        // The slug is in the query as well as the hash, so this is a real load rather than a jump within one document. Going to a new hash alone leaves everything as it was -- including how far down the page was scrolled for the lower half of the screen before it, which put `extra-work` 348px above the top of its own picture and opened it on the form instead of the bill list.
        await on.goto(`${server.at}/?camera&screen=${screen.slug}#${screen.slug}`)

        // Scroll left over from the screen before, asked here rather than inferred from a negative top further down. Nothing on this screen has been tapped yet, so at this moment the two are the same measurement -- and after the taps they are not, because a screen two taps in may scroll itself and a picture of it should say so.
        const leaked = howFarDown(await on.evaluate('window.scrollY'))

        if (leaked > TOP_OF_THE_SCREEN) {
          throw new Error(
            `${screen.slug} at ${String(size.width)} opened ${String(Math.round(leaked))}px down the page, before anything on it was touched. ` +
              `Going to a new hash on the same document is not a reload, so that is where the screen before this one was left.`
          )
        }

        // Waited for by what the screen says rather than by a timer. A screenshot on a timeout is a picture of whatever had loaded, and it looks exactly like a screenshot.

        // Asked of the screen and not of the page: the words are on the gallery's own button for that screen too, so unscoped this waits for the picker and is satisfied before the screen has drawn a thing.

        // Where the screen says it drew, which is the gallery's own element for all but one of them. A sheet is portalled onto `body`, so scoping this to the element the gallery draws into waits fifteen seconds for a marker that is on the page and not in there -- and had it not timed out, the picture would have been of an element the screen had left.

        // Waited for by what it proves, unless it has to be tapped open first: what a folded-up screen proves is true of the state after the taps, and `Change it` is a button that stops existing the moment it is pressed. So the wait before is for the tap itself, and the proof is asked for after, where it is. Shared with the column measurements, which had the same blindness and needed the same fix.
        await unfoldIt(on, screen)

        // The picture is only a picture of a phone if the app starts where a phone's screen starts. Hiding the gallery's furniture was not enough and was the second wrong answer: it left 287px of an 844px screen to the banner and the chips, and at that height the day sheet's amount box sat under its own footer. Anybody reading those images would have found a bug that is not there.

        // Asserted every time rather than checked once. Furniture creeps back, and when it does every picture silently becomes a third furniture again with nothing saying so.
        await onceItHasStoppedMoving(on, screen.shownIn)

        // What the wait above does not prove. Playwright's `visible` means drawn with a box, not in the frame -- so a marker below the fold satisfies it exactly, and `a-send-that-has-not-come-back` came out framing a form that could have been any screen while the sentence it is named for sat 300px under the picture.

        // Four lines above this file already said the sharper version of the thought -- the marker proves one string is drawn, not that the screen has a body -- and then let `visible` stand in for `in the picture`.

        // Failed rather than scrolled to. A picture that had to be scrolled to is a picture of something he would have to scroll to, and auto-scrolling would produce a correct-looking photograph of a screen he does not have.
        const proving = on.locator(screen.shownIn).getByText(screen.proves, { exact: false }).first()
        await proving.waitFor({ timeout: 15_000 })

        const proof = await proving.boundingBox()

        if (proof === null) {
          throw new Error(
            `${screen.slug} at ${String(size.width)}: what it proves has no box, so there is nothing to photograph.`
          )
        }

        if (proof.y + proof.height > size.height) {
          throw new Error(
            `${screen.slug} at ${String(size.width)}: "${screen.proves}" ends ${String(Math.round(proof.y + proof.height - size.height))}px below the picture. ` +
              `A picture named for a state has to contain it -- draw the screen so the state is in frame, or photograph a screen where it is.`
          )
        }

        const box = await on.locator(screen.shownIn).boundingBox()

        // `null` is not a position. It means the screen is not on the page at all, which would otherwise read as a top of zero and pass this perfectly.
        if (box === null) {
          throw new Error(`Nothing drew on ${screen.slug} at ${String(size.width)}: there is no screen to measure.`)
        }

        // Where the screen begins on the page, rather than where it begins in the frame. Those were one number until a screen scrolled itself: the are-you-sure on a house replaces a line of text with a taller row of controls, and it brings itself into view because at 390 it otherwise opens five pixels under the fold and nothing appears to happen.

        // Read after the taps and added back, so what is asserted is the property that was always meant -- the app's screen starts at the top of the page -- and the two ways it can be false are asked about separately: furniture pushing it down is caught here, and a page left scrolled by the screen before is caught above, before anything on this one has moved.
        const startsAt = box.y + howFarDown(await on.evaluate('window.scrollY'))

        // An overlay is not a page and does not begin where one does. A dialog is `top-[50%]` with itself pulled back half its height, so on a phone it begins 247px down and always will -- the search is one, and the assertion below is about a screen that is *in* the page rather than lifted out of it.

        // Asked of the element rather than excused by name: `position: fixed` is what taken-out-of-the-flow means, and a sheet says it too while still starting at zero, because it is anchored to an edge. So this is not a way round the rule for anything that wants one.
        const liftedOut: unknown = await on.evaluate(
          `getComputedStyle(document.querySelector('${screen.shownIn}')).position === 'fixed'`
        )

        // What is true of a lifted-out screen instead, and it is the property the top-of-the-page rule was standing in for: the thing being photographed is wholly inside the picture. A centred dialog taller than the viewport is cut off at both ends and the picture says nothing about the half that is missing.
        if (liftedOut === true) {
          if (box.y < -TOP_OF_THE_SCREEN || box.y + box.height > size.height + TOP_OF_THE_SCREEN) {
            throw new Error(
              `${screen.slug} at ${String(size.width)} is lifted out of the page and runs from ${String(Math.round(box.y))}px to ${String(Math.round(box.y + box.height))}px, outside a ${String(size.height)}px picture. ` +
                `An overlay is photographed where it opens, and what has to be true of it is that all of it is in frame.`
            )
          }
        } else if (Math.abs(startsAt) > TOP_OF_THE_SCREEN) {
          // Both directions. This was `> TOP_OF_THE_SCREEN` alone, which is only half an assertion: it catches furniture pushing the screen down and says nothing about the screen being pushed *up*.
          throw new Error(
            `The app's screen starts ${String(Math.round(startsAt))}px from the top of the page on ${screen.slug} at ${String(size.width)}. ` +
              `Positive is the gallery's own furniture in the picture; negative is the screen drawn above where the page begins.`
          )
        }

        // A screen with no body in it. Asked separately from the marker above, because that one proves a string rendered and this one proves a screen did -- and without it a page that drew nothing is simply a page that fits.
        if (box.height < TOO_SHORT_TO_BE_A_SCREEN) {
          throw new Error(
            `${screen.slug} at ${String(size.width)} is ${String(Math.round(box.height))}px tall. ` +
              `That is not a short screen, it is a screen that did not draw.`
          )
        }

        // The screen and not the whole page. `fullPage` expands the viewport and leaves anything `sticky` pinned to where the bottom used to be -- the day sheet's footer came out in the middle of its own form, which reads as a broken screen and is a broken photograph. What somebody holds is a screen, so that is what this is a picture of.
        await on.screenshot({ path: join(SHOTS, `${screen.slug}-${String(size.width)}.png`) })

        if (box.height <= size.height + WORTH_A_SECOND_PICTURE) continue

        // Written down from the measurement, before anything is taken. Counting as the pictures are taken makes one decision answer for both, and the tally then agrees with whatever the run did -- deleting the screenshot below and the count together left thirty-nine pictures and a cheerful "0 of them too tall", which is precisely the defect this count exists to catch.
        const lowerHalf = `${screen.slug}-${String(size.width)}-lower.png`
        tooTall.push(lowerHalf)

        // The window, told where to go, rather than a wheel aimed at whatever happens to be under the pointer. A wheel is delivered to the element beneath it, so what it scrolls depends on what a screen happens to draw in the middle -- and asking for the bottom is what the second picture is of.
        await on.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)

        // Waited for by the thing that has to be true, not by a sleep. `mouse.wheel` returns when the event is dispatched rather than when the page has moved, so reading the position straight afterwards reports zero on a page that is about to scroll -- which it did, on a different screen each run, which is what a race looks like.
        const after = await theTopOnceItHasMoved(on)

        if (after === null || after.y > -WORTH_A_SECOND_PICTURE) {
          throw new Error(
            `${screen.slug} at ${String(size.width)} is ${String(Math.round(box.height))}px tall and did not scroll ` +
              `(its top is at ${after === null ? 'no box' : String(Math.round(after.y))}). ` +
              `The second picture would be the first one again.`
          )
        }

        // The pointer taken back off the content before the picture is taken. Left in the middle where the wheel needed it, it lands on whatever scrolled up under it -- on the Dashboard that is the chart, which opened a hover tooltip over its own bars and photographed it. An instrument that changes what it is measuring, which is the fault this whole exercise exists to catch.
        await on.mouse.move(size.width - 2, 2)
        await on.waitForTimeout(100)

        await on.screenshot({ path: join(SHOTS, lowerHalf) })
      }

      await on.close()
    }

    const written = new Set(await readdir(SHOTS))

    // Asked of the disk, against a list the measurement wrote. Two facts rather than one: this screen did not fit, and a picture of its lower half is there. A count kept alongside the taking answers for both and agrees with itself.
    const owed = tooTall.filter((name) => !written.has(name))

    if (owed.length > 0) {
      throw new Error(`${String(owed.length)} screens did not fit and have no lower half: ${owed.join(', ')}`)
    }

    const wanted = screens.length * SCREENS_READ_ON.length + tooTall.length

    // And the other end, which catches a picture written that nothing asked for.
    if (written.size !== wanted) {
      throw new Error(`Wrote ${String(written.size)} pictures, expected ${String(wanted)}.`)
    }

    const sizes = SCREENS_READ_ON.map((size) => `${String(size.width)}×${String(size.height)}`).join(', ')
    console.log(
      `${String(written.size)} pictures in shots/ — ${String(screens.length)} screens at ${sizes}, ` +
        `${String(tooTall.length)} of them too tall for the screen they are on and photographed twice`
    )

    // Said here as well as in `what-moved`, because this is the file somebody would look in. The second picture of a tall screen is not reproducible: the page is scrolled before it is taken and where that scroll lands is not the same twice, so two runs of *identical* code differ on four of these by up to 2.8% of the picture.

    // Which makes them evidence of what a screen looks like and not evidence of whether it changed. Everything above asserts the geometry of every picture; nothing above asserts that the same app produces the same picture, and a fifth of what we photograph had never been asked. Recording it is the smaller of the two answers -- making them settle would be the better one.
    console.log(
      `${String(tooTall.length)} of those are the scrolled second picture and are not reproducible run to run, ` +
        'so `yarn what-moved` leaves them out.'
    )
  } finally {
    await browser.close()
    await server.stop()
  }
}

await main()
