import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

// The built gallery, served to a browser. Written once because two scripts now want it: one takes the pictures, and one measures whether the columns line up in them.

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

// Port zero, so a second run of this on the same machine is not fighting the first. Two sessions share this one.
export async function serveTheGallery(): Promise<{ at: string; stop: () => Promise<void> }> {
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
}): Promise<Array<{ slug: string; proves: string }>> {
  const buttons = page.locator('[data-slug]')
  const screens: Array<{ slug: string; proves: string }> = []

  for (let at = 0; at < (await buttons.count()); at += 1) {
    const button = buttons.nth(at)

    screens.push({
      slug: (await button.getAttribute('data-slug')) ?? '',
      proves: (await button.getAttribute('data-proves')) ?? '',
    })
  }

  return screens
}
