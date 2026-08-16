import { existsSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type { Page } from 'playwright'
import { chromium } from 'playwright'

import { GALLERY, everyScreenItShows, serveTheGallery } from './theGallerysOwnServer'

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
const A_DAY = '2026-07-04'

/** How far down the app's screen may begin before the picture stops being a picture of a phone. Not zero, because a browser rounds a fractional layout; anything above this is furniture. */
const TOP_OF_THE_SCREEN = 2

// A screen taller than the viewport gets a second picture, scrolled to the bottom. The Dashboard is the first screen in this app that one viewport cannot hold, and its picture ends on the `What came in` heading with the chart entirely below the fold -- looking finished, because a viewport shot always does.

// Two viewport shots rather than one `fullPage`: full page distorts anything sticky, and it photographs the Dashboard's chart blank, because resizing the viewport makes recharts re-measure and the shot lands mid-remeasure. Each capture here stays a true viewport; only the scroll differs.

/** How much taller than the viewport a screen has to be before a second picture is a different picture. */
const WORTH_A_SECOND_PICTURE = 24

// A screen that drew nothing is not a short screen, and the two answer the same way: a page with no body is not taller than the viewport, so it gets one picture and is counted as having fitted. The marker wait above proves one string is visible; it does not prove a screen has body.

/** Shorter than this and it did not draw. The shortest real screen here is `How it looks`, at 344px on a phone. */
const TOO_SHORT_TO_BE_A_SCREEN = 200

// Where the app's screen starts once the page has stopped moving, or where it still is when it has given up.

// Scrolled, the screen's top goes negative by however far the page went -- so the same box that says a picture is a picture of a phone also says whether a second one would be a different picture.
async function theTopOnceItHasMoved(on: Page): Promise<{ y: number } | null> {
  const givingUp = 40

  let box = await on.locator('[data-testid="the-screen"]').boundingBox()

  for (let waited = 0; waited < givingUp && box !== null && box.y > -WORTH_A_SECOND_PICTURE; waited += 1) {
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
        await on.goto(`${server.at}/?camera#${screen.slug}`)

        // Waited for by what the screen says rather than by a timer. A screenshot on a timeout is a picture of whatever had loaded, and it looks exactly like a screenshot.

        // Asked of the screen and not of the page: the words are on the gallery's own button for that screen too, so unscoped this waits for the picker and is satisfied before the screen has drawn a thing.
        await on
          .locator('[data-testid="the-screen"]')
          .getByText(screen.proves, { exact: false })
          .first()
          .waitFor({ timeout: 15_000 })

        // The picture is only a picture of a phone if the app starts where a phone's screen starts. Hiding the gallery's furniture was not enough and was the second wrong answer: it left 287px of an 844px screen to the banner and the chips, and at that height the day sheet's amount box sat under its own footer. Anybody reading those images would have found a bug that is not there.

        // Asserted every time rather than checked once. Furniture creeps back, and when it does every picture silently becomes a third furniture again with nothing saying so.
        const box = await on.locator('[data-testid="the-screen"]').boundingBox()

        // `null` is not a position. It means the screen is not on the page at all, which would otherwise read as a top of zero and pass this perfectly.
        if (box === null) {
          throw new Error(`Nothing drew on ${screen.slug} at ${String(size.width)}: there is no screen to measure.`)
        }

        const startsAt = box.y

        if (startsAt > TOP_OF_THE_SCREEN) {
          throw new Error(
            `The app's screen starts ${String(Math.round(startsAt))}px down on ${screen.slug} at ${String(size.width)}. ` +
              `A picture with the gallery's own furniture in it is not a picture of a phone.`
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

        // Moved onto the page first: a wheel is delivered to whatever is under the pointer, and the pointer starts at 0,0 where nothing scrollable is.
        await on.mouse.move(size.width / 2, size.height / 2)
        await on.mouse.wheel(0, box.height)

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
  } finally {
    await browser.close()
    await server.stop()
  }
}

await main()
