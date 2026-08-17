import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

import type { Page } from 'playwright'

// The built gallery, served to a browser. Written once because two scripts now want it: one takes the pictures, and one measures whether the columns line up in them.

/** Where the gallery draws a screen, and what a picture is a picture of. */
export const THE_SCREEN = '[data-testid="the-screen"]'

export const GALLERY = resolve(import.meta.dirname, '..', 'frontend', 'dist-gallery')

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

// What the gallery is built from. Anything newer than the build means the pictures would be of an older app.
const THE_SOURCES = ['frontend/src', 'frontend/gallery.html', 'frontend/vite.gallery.config.ts', 'shared'].map((from) =>
  resolve(import.meta.dirname, '..', from)
)

function newestUnder(path: string): number {
  const it = statSync(path)

  if (!it.isDirectory()) return it.mtimeMs

  return readdirSync(path).reduce((newest, name) => Math.max(newest, newestUnder(join(path, name))), it.mtimeMs)
}

// A build older than what it was built from. Nothing else notices: the server happily serves it, every screen draws, the count comes out right, and the run reports thirteen screens and fifty pictures of an app four merges old.

// That is what happened -- `yarn shots` serves `dist-gallery` and does not build it, and a stale build produces a complete-looking set with nothing anywhere saying so. Refused rather than rebuilt, because the gallery is a separate artifact and CI builds it in its own step; a silent rebuild here would hide that and pay for it twice.

// Modification times, so a branch switch that rewrites sources reads as stale. That is a false alarm in the cheap direction: the answer is one command, and the alternative is a confident picture of the wrong commit.
function refuseAGalleryOlderThanTheApp(): void {
  const built = statSync(join(GALLERY, 'gallery.html')).mtimeMs
  const newest = Math.max(...THE_SOURCES.map(newestUnder))

  if (newest > built) {
    throw new Error(
      `The built gallery is older than what it is built from. Run \`yarn gallery:build\`.\n` +
        `  built  ${new Date(built).toISOString()}\n` +
        `  source ${new Date(newest).toISOString()}`
    )
  }
}

// Port zero, so a second run of this on the same machine is not fighting the first. Two sessions share this one.
export async function serveTheGallery(): Promise<{ at: string; stop: () => Promise<void> }> {
  if (!existsSync(join(GALLERY, 'gallery.html'))) {
    throw new Error(`No gallery built at ${GALLERY}. Run \`yarn gallery:build\` first.`)
  }

  refuseAGalleryOlderThanTheApp()

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

/** A screen as the gallery describes itself: enough to find it, wait for it and unfold it. */
export type ScreenItShows = { slug: string; proves: string; shownIn: string; tapFirst: Array<string> }

// Every instrument here had the same blindness and each one had to be found separately: the camera, the two jsdom sweeps that render every screen, and the column measurements. Four harnesses waited for a screen at rest, and half the controls in this app are behind a tap.

// So this is written once, here, where all three of the ones that drive a browser already come. The assumption was in the harness rather than in any guard, which is why it was copied rather than reasoned about.

/** Wait for a screen to arrive and tap it open, so what is measured next is the state somebody is really standing in front of. */
export async function unfoldIt(on: Page, screen: ScreenItShows): Promise<void> {
  // What to wait for depends on which state is being asked about. A folded screen proves words that do not exist yet, and the button that unfolds it stops existing the moment it is pressed, so the wait before the taps is for the tap itself.
  const waitingFor =
    screen.tapFirst.length === 0
      ? on.locator(screen.shownIn).getByText(screen.proves, { exact: false }).first()
      : on.getByRole('button', { name: screen.tapFirst[0] }).first()

  await waitingFor.waitFor({ timeout: 15_000 })

  for (const tap of screen.tapFirst) {
    // The first of them, because a way out sits on a row and a screen may draw several rows. Playwright matches part of an accessible name, which is what lets `Take out` find `Take out ₨26,50,000 paid to …`.
    await on.getByRole('button', { name: tap }).first().click()
    await on.waitForTimeout(50)
  }

  await onceItHasStoppedMoving(on, screen.shownIn)
}

// What is drawn, as one string: where the screen is, how big it is, and how far along each bar in it has grown.

// The bars are here because a chart used to animate its own height. Nothing does today -- the sizes are what move now.
async function asItStands(on: Page, shownIn: string): Promise<string | null> {
  const box = await on.locator(shownIn).boundingBox()

  if (box === null) {
    return null
  }

  const bars: unknown = await on.evaluate(
    `[...document.querySelectorAll('[data-bar]')].map((bar) => Math.round(bar.getBoundingClientRect().width)).join(',')`
  )

  return `${String(box.x)},${String(box.y)},${String(box.width)},${String(box.height)}|${String(bars)}`
}

// Waited on the position rather than on a duration: an animation length is a number that goes stale, and a timeout long enough for the slowest machine is a tax on every screen that is not moving at all.

// It lived in `shots` alone, because the thing it was written for was a picture taken mid-animation. Measuring has the same problem and it went unnoticed for a different reason: a sheet slides in without changing the height of anything inside it, so every tapped-open screen measured so far happened to be stable in the one dimension anybody was asking about.

// A dialog is not. It opens with `zoom-in-95`, which scales the whole thing -- so every row inside the search measured **43px** where the class says 44, at every width, and the app was not wrong about any of it. An instrument that reads a number off a moving thing reports a defect that is not there, which is worse than missing one: somebody goes and changes the app until the instrument agrees.
async function onceItHasStoppedMoving(on: Page, shownIn: string): Promise<void> {
  const givingUp = 40

  let before = await asItStands(on, shownIn)

  for (let waited = 0; waited < givingUp; waited += 1) {
    await on.waitForTimeout(50)
    const now = await asItStands(on, shownIn)

    // Both read, and equality asked of a pair that exists: a `null` on either side is a thing that is not on the page, and calling that "not moving" is the not-there-reading-as-a-value this whole harness keeps finding.
    if (before !== null && now !== null && before === now) {
      return
    }

    before = now
  }
}

/** Every screen the gallery shows, read off the page rather than listed here: a list in a script drifts from the gallery silently. */
export async function everyScreenItShows(page: {
  locator: (selector: string) => {
    count: () => Promise<number>
    nth: (at: number) => { getAttribute: (name: string) => Promise<string | null> }
  }
}): Promise<Array<ScreenItShows>> {
  const buttons = page.locator('[data-slug]')
  const screens: Array<ScreenItShows> = []

  for (let at = 0; at < (await buttons.count()); at += 1) {
    const button = buttons.nth(at)

    screens.push({
      slug: (await button.getAttribute('data-slug')) ?? '',
      proves: (await button.getAttribute('data-proves')) ?? '',
      // Where the screen really drew, for the screens that leave the element the gallery draws them into. Almost none do, so the element is the answer unless the screen says otherwise.
      shownIn: (await button.getAttribute('data-shown-in')) ?? THE_SCREEN,
      // What somebody taps to see it, for the screens that fold themselves away until asked. Empty for every other screen; more than one for a way out that lives behind an are-you-sure.
      tapFirst: ((await button.getAttribute('data-tap-first')) ?? '').split('|').filter((tap) => tap !== ''),
    })
  }

  return screens
}
