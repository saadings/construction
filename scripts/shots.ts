import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

import { chromium } from 'playwright'

// A picture of every screen, at the three widths the app is read at, from the gallery's own build.

// This is the second half of what the gallery was for. The first half is a person opening it; this is so a pull request carries images rather than the sentence "not observed at any width", which three of them shipped with.

const GALLERY = resolve(import.meta.dirname, '..', 'frontend', 'dist-gallery')
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

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
}

// Port zero, so a second run of this on the same machine is not fighting the first. Two sessions share this one.
async function serveTheGallery(): Promise<{ at: string; stop: () => Promise<void> }> {
  const server = createServer((request, response) => {
    const asked = new URL(request.url ?? '/', 'http://localhost').pathname
    const wanted = asked === '/' ? '/gallery.html' : asked

    // Kept inside the built gallery whatever was asked for: this serves a directory to a browser, and `../` in a path is how that becomes serving the disk.
    const path = join(GALLERY, normalize(wanted).replace(/^(\.\.[/\\])+/, ''))

    if (!path.startsWith(GALLERY) || !existsSync(path)) {
      response.writeHead(404).end('not here')

      return
    }

    response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
    createReadStream(path).pipe(response)
  })

  await new Promise<void>((ready) => {
    server.listen(0, '127.0.0.1', ready)
  })

  const bound = server.address()
  if (bound === null || typeof bound === 'string') {
    throw new Error('The gallery server did not bind to a port this can read.')
  }

  return {
    at: `http://127.0.0.1:${String(bound.port)}`,
    stop: () =>
      new Promise<void>((stopped) => {
        server.close(() => {
          stopped()
        })
      }),
  }
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

    // Asked through the locator API rather than evaluated in the page, so this stays a Node script with no DOM types in it.
    const buttons = page.locator('[data-slug]')
    const screens: Array<{ slug: string; proves: string }> = []

    for (let at = 0; at < (await buttons.count()); at += 1) {
      const button = buttons.nth(at)

      screens.push({
        slug: (await button.getAttribute('data-slug')) ?? '',
        proves: (await button.getAttribute('data-proves')) ?? '',
      })
    }

    if (screens.length === 0) {
      throw new Error('The gallery offered no screens. A picture of nothing is worse than no picture.')
    }

    await page.close()

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

        // The screen and not the whole page. `fullPage` expands the viewport and leaves anything `sticky` pinned to where the bottom used to be -- the day sheet's footer came out in the middle of its own form, which reads as a broken screen and is a broken photograph. What somebody holds is a screen, so that is what this is a picture of.
        await on.screenshot({ path: join(SHOTS, `${screen.slug}-${String(size.width)}.png`) })
      }

      await on.close()
    }

    const written = await readdir(SHOTS)
    const wanted = screens.length * SCREENS_READ_ON.length

    // Counted from both ends. The loop above throws on a screen it cannot photograph, but a screenshot silently written nowhere leaves a run that reports success and uploads an empty artifact.
    if (written.length !== wanted) {
      throw new Error(`Wrote ${String(written.length)} pictures, expected ${String(wanted)}.`)
    }

    const sizes = SCREENS_READ_ON.map((size) => `${String(size.width)}×${String(size.height)}`).join(', ')

    console.log(`${String(written.length)} pictures in shots/ — ${String(screens.length)} screens at ${sizes}`)
  } finally {
    await browser.close()
    await server.stop()
  }
}

await main()
