import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

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

/** Every screen the gallery shows, read off the page rather than listed here: a list in a script drifts from the gallery silently. */
export async function everyScreenItShows(page: {
  locator: (selector: string) => {
    count: () => Promise<number>
    nth: (at: number) => { getAttribute: (name: string) => Promise<string | null> }
  }
}): Promise<Array<{ slug: string; proves: string; shownIn: string }>> {
  const buttons = page.locator('[data-slug]')
  const screens: Array<{ slug: string; proves: string; shownIn: string }> = []

  for (let at = 0; at < (await buttons.count()); at += 1) {
    const button = buttons.nth(at)

    screens.push({
      slug: (await button.getAttribute('data-slug')) ?? '',
      proves: (await button.getAttribute('data-proves')) ?? '',
      // Where the screen really drew, for the screens that leave the element the gallery draws them into. Almost none do, so the element is the answer unless the screen says otherwise.
      shownIn: (await button.getAttribute('data-shown-in')) ?? THE_SCREEN,
    })
  }

  return screens
}
