import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { chromium } from 'playwright'

// What a change did to the app's appearance, measured rather than argued about.

// Rebuilding `Button` and `WayOut` on shadcn's was meant to change what they were made of and nothing anybody sees. Four of shadcn's defaults changed the app: `whitespace-nowrap` took 24px off the day sheet, `has-[>svg]:px-3` grew a button somebody had deliberately made small, `font-medium` made a way out the boldest thing on its row, and `inline-flex` sat every row one of them is on a pixel off. None was visible in the diff and none was caught by 940 passing tests. All four were found here.

// `yarn what-moved --keep` before the change, `yarn shots` after it, then `yarn what-moved`.

const SHOTS = resolve(import.meta.dirname, '..', 'shots')

// The baseline, and it is load-bearing that it is a directory on somebody's disk rather than anything git knows about. `shots-before/` is gitignored and written by `--keep` at the moment somebody runs it, so a rebase, a branch switch or a stale artifact cannot silently repoint it at a different commit than the one being reported.

// That matters more than it looks: a comparator naming the wrong baseline is the worst instrument on a project, because everything it says is precise and about something else. This one is immune by construction, not by care -- which is exactly why it is written down. A property nobody wrote down is a property the next person removes while tidying, and they would be right to.
const BEFORE = resolve(import.meta.dirname, '..', 'shots-before')

// A pixel counts as moved when any channel differs by more than this. Antialiasing of the same glyph in the same place lands well under it; a changed colour, weight or position does not.

// Byte comparison was the first instrument and is the wrong one: it called 41 of 67 pictures changed when 36 of those were a glyph a fraction of a pixel over. A comparison that is right about everything and useful about nothing gets switched off.
const NOT_JUST_ANTIALIASING = 24

// The second picture of a tall screen is taken after scrolling, and where that scroll lands is not the same twice: two runs of *identical* code differ on four of the thirteen, by up to 2.8% of the picture. They cannot confirm or deny anything, so they are left out.

// Left out **loudly**. A comparison quietly about 54 of 67 pictures is how "nothing moved" comes to mean "nothing I looked at moved" -- which is the failure this exists to catch, arriving inside the tool built to catch it. The count is printed on every run, whether anything moved or not.
const CANNOT_BE_COMPARED = '-lower'

/** What one picture came to. `pixels` counts only what is past the antialiasing floor. */
type Compared = { name: string; pixels: number; share: number; worst: number; resized: string | null }

// The browser this reaches into, described here rather than imported.

// `scripts/` is compiled without the DOM library on purpose, and there is no way to give this file browser types without giving them to every script beside it: a `/// <reference lib="dom" />` here is not file-local -- it was measured, and a second script with no reference of its own then compiled a `document.createElement` happily. That is the same blast radius as widening the project's `lib`, hidden in one line, which is worse rather than better. Importing the browser half from `frontend/` does not work either: the node project type-checks what it imports under its own library, so the errors simply move.

// So the four things the page is asked for are written down. One assertion, at the one boundary where this file genuinely does not know it is talking to a browser, and real types on everything inside it.
type Picture = { width: number; height: number; onload: () => void; onerror: () => void; src: string }
type Pixels = { data: Uint8ClampedArray }
type Face = {
  drawImage: (image: Picture, x: number, y: number) => void
  getImageData: (x: number, y: number, width: number, height: number) => Pixels
}
type Canvas = { width: number; height: number; getContext: (kind: '2d') => Face | null }
type InThePage = { Image: new () => Picture; document: { createElement: (tag: 'canvas') => Canvas } }

function asDataUri(path: string): string {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

function everyPicture(where: string): Array<string> {
  return readdirSync(where)
    .filter((name) => name.endsWith('.png'))
    .sort()
}

// Decoded in a browser because Playwright is already here for taking the pictures and nothing else in this repository can read a PNG.

// The helper assigned to `globalThis` is not decoration: esbuild compiles this file before `tsx` runs it and keeps function names by injecting a `__name` helper, which exists in the module and not in the page -- so anything sent to `evaluate` dies on a ReferenceError about a helper nobody wrote. Given as raw text so nothing compiles it.
async function comparing(): Promise<{
  ask: (before: string, after: string) => Promise<Omit<Compared, 'name'>>
  close: () => Promise<void>
}> {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.setContent('<canvas></canvas>')
  await page.evaluate('globalThis.__name = (fn) => fn')

  return {
    ask: (before, after) =>
      page.evaluate(
        async ([beforeUri, afterUri, floor]: readonly [string, string, number]) => {
          const inThePage = globalThis as unknown as InThePage

          const load = (src: string) =>
            new Promise<Picture>((settle, fail) => {
              const image = new inThePage.Image()
              image.onload = () => {
                settle(image)
              }
              image.onerror = () => {
                fail(new Error('not a picture'))
              }
              image.src = src
            })

          const [one, two] = await Promise.all([load(beforeUri), load(afterUri)])

          if (one.width !== two.width || one.height !== two.height) {
            return {
              resized: `${String(one.width)}x${String(one.height)} became ${String(two.width)}x${String(two.height)}`,
              pixels: 0,
              share: 0,
              worst: 0,
            }
          }

          const read = (image: Picture) => {
            const canvas = inThePage.document.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height

            const face = canvas.getContext('2d')
            if (face === null) throw new Error('no canvas to draw on')
            face.drawImage(image, 0, 0)

            return face.getImageData(0, 0, image.width, image.height).data
          }

          const [left, right] = [read(one), read(two)]
          let pixels = 0
          let worst = 0

          for (let at = 0; at < left.length; at += 4) {
            const delta = Math.max(
              Math.abs(left[at] - right[at]),
              Math.abs(left[at + 1] - right[at + 1]),
              Math.abs(left[at + 2] - right[at + 2])
            )

            if (delta > worst) worst = delta
            if (delta > floor) pixels += 1
          }

          return { resized: null, pixels, share: (pixels / (left.length / 4)) * 100, worst }
        },
        [asDataUri(before), asDataUri(after), NOT_JUST_ANTIALIASING] as const
      ),
    close: () => browser.close(),
  }
}

function keepThemForLater(): void {
  if (!existsSync(SHOTS) || everyPicture(SHOTS).length === 0) {
    throw new Error(`No pictures in ${SHOTS}. Run \`yarn shots\` first, then keep them.`)
  }

  rmSync(BEFORE, { recursive: true, force: true })
  mkdirSync(BEFORE, { recursive: true })
  cpSync(SHOTS, BEFORE, { recursive: true })

  console.log(
    `${String(everyPicture(BEFORE).length)} pictures kept. Make the change, run \`yarn shots\`, then \`yarn what-moved\`.`
  )
}

async function main(): Promise<void> {
  if (process.argv.includes('--keep')) {
    keepThemForLater()

    return
  }

  if (!existsSync(BEFORE)) {
    throw new Error('Nothing to compare against. Run `yarn what-moved --keep` before making the change.')
  }

  const kept = everyPicture(BEFORE)
  const asked = kept.filter((name) => !name.includes(CANNOT_BE_COMPARED))

  // Said before anything is compared rather than after, so the number is read as part of the question and not as a footnote to a clean answer.
  console.log(
    `${String(kept.length - asked.length)} of ${String(kept.length)} pictures cannot be compared and are left out: ` +
      'the second picture of a tall screen lands at a different scroll each run, by up to 2.8% of the picture. ' +
      `This run is about the other ${String(asked.length)}.\n`
  )

  if (asked.length === 0) {
    throw new Error('No comparable pictures at all, so this run would report a clean nothing either way.')
  }

  const comparator = await comparing()
  const moved: Array<Compared> = []
  const gone: Array<string> = []
  let same = 0

  try {
    for (const name of asked) {
      if (!existsSync(join(SHOTS, name))) {
        gone.push(name)
        continue
      }

      const answer = await comparator.ask(join(BEFORE, name), join(SHOTS, name))

      if (answer.resized === null && answer.pixels === 0) {
        same += 1
        continue
      }

      moved.push({ name, ...answer })
    }
  } finally {
    await comparator.close()
  }

  const fresh = everyPicture(SHOTS).filter((name) => !name.includes(CANNOT_BE_COMPARED) && !kept.includes(name))

  for (const name of gone) console.log(`GONE      ${name}`)
  for (const name of fresh) console.log(`NEW       ${name}`)

  for (const one of [...moved].sort((first, second) => second.pixels - first.pixels)) {
    const said =
      one.resized === null
        ? `${String(one.pixels).padStart(7)} px  ${one.share.toFixed(3)}%  worst channel ${String(one.worst)}`
        : one.resized

    console.log(`MOVED     ${one.name.padEnd(32)} ${said}`)
  }

  console.log()
  console.log(
    `${String(same)} identical past antialiasing, ${String(moved.length)} moved, ${String(gone.length)} gone, ` +
      `${String(fresh.length)} new, of ${String(asked.length)} compared.`
  )

  // Nothing here fails a build, and it is deliberately not in `yarn gate`. Two runs of *identical* code move up to five of these, because the dashboard chart never draws twice the same -- so a clean answer means "probably nothing" and a red one would usually be the chart. A check whose clean answer means probably is one people learn to skip, and one that cries wolf is one they learn to ignore. This is for reading.
  console.log('Two runs of identical code move up to five of these. Open the ones you did not expect.')
}

await main()
