import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { chromium } from 'playwright'

import { everyScreenItShows, serveTheGallery } from './theGallerysOwnServer'

// What this app has no instrument for.

// Every gap found in a night of finding them was found by somebody happening to ask, and the question was different each time: a guard sweeping routes while six screens were drawn by components; two exemption floors emptied by one conversion, in files that conversion never touched; a crawl whose controls both sat in the only region it could reach; a tap-target measurement reaching thirteen of seventeen because the other four exist only mid-confirmation; a comparison across ninety-two pictures of which exactly one held the thing being changed.

// Nobody could answer "what has no instrument?", and that is the only question that would have found any of them on purpose.

// **Every number here is counted at run time and none is typed.** A coverage map somebody maintains by hand is a cached query with no invalidation -- which is what an exemption list is, and one of those went stale in forty minutes tonight while its own both-ends check was the thing that caught it. So this asks the tree and the browser, and the day a gap closes the map says so without anybody remembering to edit it.

const SRC = resolve(import.meta.dirname, '..', 'frontend', 'src')
const SHOTS = resolve(import.meta.dirname, '..', 'shots')

/** A subject an instrument sweeps for, and how to find it in each place it could be counted. */
type Subject = {
  what: string
  /** Which instrument asks about it, so a shortfall names the thing that will report a clean nothing. */
  asked: string
  /** How the page identifies one. */
  onThePage: string
  /** How the source identifies a call site, so "what exists" is counted separately from "what is drawn". */
  inTheSource: RegExp
}

const SUBJECTS: Array<Subject> = [
  {
    what: 'a control that removes a row',
    asked: 'yarn columns, the 44px floor',
    onThePage: '[data-removes]',
    inTheSource: /<WayOut\b|look="removing"/g,
  },
  {
    what: 'a skeleton',
    asked: 'yarn what-moved, and any picture of a screen still waiting',
    onThePage: '[data-slot="skeleton"]',
    inTheSource: /<Skeleton\b/g,
  },
  {
    what: 'a figure',
    asked: 'yarn columns, the cut-in-half check',
    onThePage: '.tabular-nums',
    inTheSource: /<Figure\b/g,
  },
  {
    what: 'a row of choices',
    asked: 'nobodyPressesAButtonByHand, which now refuses one written by hand',
    onThePage: '[role="radio"]',
    // `<Choices` and not `role="radio"`: the role is Radix's now and is written in no file this app owns. Asked the old way this would read zero written against thirteen drawn, which is the shape of a subject that has vanished rather than one that has moved -- and the only thing that fails here is a subject nothing draws, so it would have printed a wrong number quietly forever.
    inTheSource: /<Choices\b/g,
  },
  {
    what: 'a trail',
    asked: 'yarn columns, the pinned check',
    onThePage: '[data-slot="breadcrumb"]',
    inTheSource: /<Trail\b/g,
  },
  {
    // The line under a name: a day, how it was paid, a cheque number. Four components drew it by hand and two cut the cheque number off; the one that had been fixed had nothing asserting it stayed fixed.
    what: 'a line that must be read whole',
    asked: 'yarn columns, the cut-off check',
    onThePage: '[data-must-be-read]',
    inTheSource: /<SaidUnderneath\b/g,
  },
]

function withoutComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ')
}

function everyFileUnder(dir: string, ends = 'DRAWN'): Array<string> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return everyFileUnder(path, ends)

    // The default is what the rest of this asks for: a component, which is a `.tsx` that is not a test. Anything else is asked for by suffix.
    if (ends !== 'DRAWN') return path.endsWith(ends) ? [path] : []

    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : []
  })
}

/** Every component a route renders, which is what a person can actually reach. */
function whatARouteDraws(): Map<string, Array<string>> {
  const routed = new Map<string, Array<string>>()

  for (const path of everyFileUnder(join(SRC, 'routes'))) {
    const source = withoutComments(readFileSync(path, 'utf8'))

    for (const [, name] of source.matchAll(/<([A-Z]\w+)/g)) {
      routed.set(name, [...(routed.get(name) ?? []), relative(SRC, path)])
    }
  }

  return routed
}

/** Every component this app writes, by the file that writes it. */
function whatThisAppWrites(): Map<string, string> {
  const written = new Map<string, string>()

  for (const path of everyFileUnder(join(SRC, 'components'))) {
    if (path.includes('/ui/')) continue

    for (const [, name] of withoutComments(readFileSync(path, 'utf8')).matchAll(/export function ([A-Z]\w+)/g)) {
      written.set(name, relative(SRC, path))
    }
  }

  return written
}

// Every file the gallery reaches, followed rather than looked up.

// The first version of this asked whether a file's component was named in `screens.tsx`, and reported `HowItWasPaid.tsx` as drawn by nothing -- while its rows of choices were being counted on seven screens, because the day sheet draws it. **A component drawn inside another screen is photographed just as well as one named directly**, and a check that cannot see that reports three false gaps out of five and reads exactly like a check that found three real ones.
function everyFileTheGalleryReaches(named: Set<string>, written: Map<string, string>): Set<string> {
  const reached = new Set<string>()
  const toFollow = [...named]

  while (toFollow.length > 0) {
    const name = toFollow.pop()
    const path = name === undefined ? undefined : written.get(name)
    if (path === undefined || reached.has(path)) continue

    reached.add(path)

    for (const [, drawn] of withoutComments(readFileSync(join(SRC, path), 'utf8')).matchAll(/<([A-Z]\w+)/g)) {
      if (written.has(drawn)) toFollow.push(drawn)
    }
  }

  return reached
}

// Which files write a subject at all. Counted as **files** rather than as call sites, and the difference is the whole reason this is not the obvious version.

// A call-site count is not comparable to what a page draws: one `<Figure>` inside a `.map` renders forty, so "89 drawn, 40 written" reads as more than complete coverage and means nothing at all. The honest fraction is how many of the files that can draw one are on a screen the gallery shows -- that is two counts of the same kind of thing.
function whereItIsWritten(found: RegExp): Array<string> {
  return (
    everyFileUnder(SRC)
      // The gallery is the instrument, not the app. Routes are how a person arrives at a screen and are never drawn by it, so a route holding a `<Skeleton />` is not a gap in coverage -- it is the route handing a waiting state to a component the gallery does draw. And shadcn's own are theirs.
      .filter((path) => !path.includes('/gallery/') && !path.includes('/routes/') && !path.includes('/components/ui/'))
      .filter((path) => found.test(withoutComments(readFileSync(path, 'utf8'))))
      .map((path) => relative(SRC, path))
  )
}

// What each instrument runs *against*, which sits a level above what each one can see.

// An instrument's blind spot is not always a subject it cannot reach -- sometimes it is a **build it cannot reproduce**. React Compiler is on for the app and on for the gallery, and off for vitest, so the whole unit suite compiles a different program from the one that ships. A component with a hook not named `use*` passed 218 tests and threw `Rendered fewer hooks than expected` the moment somebody tapped it in the app.

// A thousand tests were on one side of that and the ninety-two pictures were on the other, which is why a confirmation dialog found it and nothing else did. Read off the configs rather than written down, so it stays true when somebody changes one.
const BUILDS = [
  { what: 'the app itself', config: 'frontend/vite.config.ts' },
  {
    what: 'the gallery, which the pictures and the measurements are taken from',
    config: 'frontend/vite.gallery.config.ts',
  },
  { what: 'every unit and scenario test', config: 'vitest.config.ts' },
]

function whatItCompilesWith(): Array<{ what: string; compiler: boolean; config: string }> {
  return BUILDS.map(({ what, config }) => ({
    what,
    config,
    compiler: readFileSync(resolve(import.meta.dirname, '..', config), 'utf8').includes('babel-plugin-react-compiler'),
  }))
}

// Whether this map is current about itself, which is the first thing it has to be.

// Everything above is computed, and the *lists* of what to compute over were typed -- three builds, five subjects. That is the same shape as an exemption list, and one of those went stale in forty minutes tonight. The hour this was written, two new instruments landed with the hooks crash: a `rules-of-hooks` lint rule and a scenario test asserting that vitest does not run the compiler. **Neither appeared here, because neither was in a list somebody had edited.**

// So the instruments are counted off the tree, and what this file describes is counted off this file, and the difference is printed. It does not name what is missing -- it cannot, without knowing what a new instrument is for -- but it can say that the number has moved, which is the only thing needed to send somebody looking.
function everyInstrumentThereIs(): { suites: number; scenarios: number; sweeps: number; rules: number } {
  const root = resolve(import.meta.dirname, '..')

  const under = (dir: string, ends: string): Array<string> =>
    everyFileUnder(dir, ends).filter((path) => !path.includes('node_modules'))

  const eslint = readFileSync(join(root, 'eslint.config.ts'), 'utf8')

  return {
    suites: under(join(root, 'frontend'), '.test.tsx').length + under(join(root, 'frontend'), '.test.ts').length,
    scenarios: under(join(root, 'scenarios'), '.scenario.test.ts').length,
    sweeps: under(join(root, 'scripts'), '.ts').length,
    rules: [...withoutComments(eslint).matchAll(/'[\w-]+\/[\w-]+':\s*'(error|warn)'/g)].length,
  }
}

async function main(): Promise<void> {
  const routed = whatARouteDraws()
  const written = whatThisAppWrites()

  console.log('What each instrument runs against, before what any of them can see:\n')

  for (const { what, compiler, config } of whatItCompilesWith()) {
    console.log(`  ${compiler ? 'ships' : 'DOES NOT SHIP'}  ${what}`)
    console.log(`            ${config} ${compiler ? 'runs' : 'does not run'} the React Compiler`)
  }

  console.log(
    '\n  A check that does not run the shipped compiler is checking a different program. The pictures are the only\n  instrument here compiled the way the app is.\n'
  )

  // How many instruments there are, against how many this file has anything to say about. The first version of this map described three builds and five subjects and knew nothing of the lint rule and scenario test that landed the same hour -- because both lists were typed, which is the failure the whole map exists to name.
  const there = everyInstrumentThereIs()
  const described = BUILDS.length + SUBJECTS.length

  console.log(
    `Instruments on this project: ${String(there.suites)} unit suites, ${String(there.scenarios)} scenarios, ` +
      `${String(there.sweeps)} scripts, ${String(there.rules)} lint rules turned on.`
  )
  console.log(
    `  This map describes ${String(described)} of them. It cannot say which of the rest are uncovered -- only that\n` +
      '  the number is what it is, which is enough to send somebody looking when it moves.\n'
  )

  const server = await serveTheGallery()
  const browser = await chromium.launch()

  try {
    const page = await browser.newPage()
    await page.goto(server.at)
    const screens = await everyScreenItShows(page)
    const drawnByTheGallery = new Set(
      [...withoutComments(readFileSync(join(SRC, 'gallery', 'screens.tsx'), 'utf8')).matchAll(/<([A-Z]\w+)/g)].map(
        ([, name]) => name
      )
    )
    await page.close()

    const reached = everyFileTheGalleryReaches(drawnByTheGallery, written)

    // What a person can reach and no instrument can. Every visual check on this project reaches the app through the gallery, so a screen it does not draw is a screen nothing measures, photographs or compares.
    const unseen = [...routed.keys()]
      .filter((name) => written.has(name) && !reached.has(written.get(name) ?? ''))
      .map((name) => ({ name, where: written.get(name) ?? '', routes: [...new Set(routed.get(name) ?? [])] }))

    console.log('Components a route draws that the gallery does not:\n')
    for (const one of unseen.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  ${one.name.padEnd(20)} ${one.where.padEnd(38)} ${one.routes.join(', ')}`)
    }

    const reachable = [...routed.keys()].filter((name) => written.has(name))
    console.log(
      `\n  ${String(unseen.length)} of ${String(reachable.length)} routed components are outside every visual instrument.\n`
    )

    // And for each thing a sweep asks about: how much of it any picture can contain. A comparison across ninety-two pictures holding none of the subject reports "nothing moved" exactly as loudly as a correct one.
    const on = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const short: Array<string> = []

    console.log('What each sweep can see, counted rather than claimed:\n')

    for (const subject of SUBJECTS) {
      let drawn = 0
      const screensWithOne: Array<string> = []

      for (const screen of screens) {
        await on.goto(`${server.at}/?camera&screen=${screen.slug}#${screen.slug}`)
        await on.waitForTimeout(80)

        const here = await on.locator(subject.onThePage).count()
        if (here > 0) {
          drawn += here
          screensWithOne.push(screen.slug)
        }
      }

      // Which files can draw one, and which of those the gallery has a screen for. Two counts of the same kind of thing, so the fraction means something.
      const files = whereItIsWritten(subject.inTheSource)
      const outside = files.filter((path) => !reached.has(path))

      console.log(`  ${subject.what}`)
      console.log(`    asked by  ${subject.asked}`)
      console.log(
        `    reach     ${String(drawn)} on the page, across ${String(screensWithOne.length)} of ${String(screens.length)} screens`
      )
      console.log(
        `    written   in ${String(files.length)} files, ${String(outside.length)} of which the gallery draws no screen for`
      )

      for (const path of outside) console.log(`                ${path}`)

      if (drawn === 0) {
        short.push(`${subject.what}: nothing the gallery draws holds one, so ${subject.asked} sweeps an empty page`)
      }

      console.log('')
    }

    // The one hard failure. A sweep whose subject appears on no screen is not a passing sweep -- it is an instrument pointed at nothing, and it reports the same clean answer either way.
    if (short.length > 0) {
      throw new Error(`\n${short.join('\n')}\n`)
    }

    const pictures = readdirSync(SHOTS).filter((name) => name.endsWith('.png'))
    const cannot = pictures.filter((name) => name.includes('-lower'))

    console.log(
      `Pictures: ${String(pictures.length)} taken, ${String(cannot.length)} of them the scrolled second shot, which lands at a different scroll each run and cannot be compared.\n`
    )
  } finally {
    await browser.close()
    await server.stop()
  }
}

await main()
