import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { formatPaisa } from '~shared/money'

import { ROOM_FOR_A_LINK, ROOM_FOR_A_THUMB } from '../roomForAThumb'
import { Figure } from '../shell/Page'
import { Panel, Pill } from '../shell/Panel'
import type { PillTone } from '../shell/Panel'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'

export type House = {
  siteId: string
  name: string
  stage: string
  builtForAClient: boolean
  forWhom: string | null
  coveredAreaSqft: number | null
  goneOutPaisa: number
  comeInPaisa: number
}

// The words for a stage and the plane each one sits on. His drawing tints them here and leaves them plain on the Sites screen, which is his inconsistency to settle rather than ours to smooth over -- both are built as drawn.

// The tints are the app's own three, which are his hexes: `--green-tint` is `#eef2ec` and `--brass-tint` is `#f5efe4`, exactly what the drawing carries.

// Typed as possibly missing on purpose. A stage arrives here as a string off the wire, and a lookup the compiler believes always hits is a lookup that renders `undefined` into the pill the day a stage is added to the schema and not to this list.
const STAGE: Record<string, { said: string; tone: PillTone } | undefined> = {
  planning: { said: 'Planning', tone: 'quiet' },
  building: { said: 'Building', tone: 'green' },
  finishing: { said: 'Finishing', tone: 'brass' },
  complete: { said: 'Finished', tone: 'green' },
  sold: { said: 'Sold', tone: 'green' },
}

// The line under a house's name: who it is going up for, and how big it is. Either half can be missing -- a house with nobody named and no area entered is a house with a name and nothing else, which is what one looks like on the day it is started.

// Three sentences and not two, because `Own build, for sale` and `For a client` are what the two states of that flag say, and both are his own words. A house whose client has not been entered says so rather than reading as a house going up to sell -- which is a different business decision, not a missing field.
export function whatItIs(house: Pick<House, 'builtForAClient' | 'forWhom' | 'coveredAreaSqft'>): string | null {
  const said: Array<string> = []

  if (!house.builtForAClient) said.push('Own build, for sale')
  else said.push(house.forWhom === null ? 'For a client' : `For ${house.forWhom}`)

  if (house.coveredAreaSqft !== null) said.push(`${house.coveredAreaSqft.toLocaleString('en-GB')} sqft`)

  return said.length === 0 ? null : said.join(' · ')
}

export function TheSites({ houses }: { houses: Array<House> }) {
  return (
    <Panel className="flex flex-col gap-4 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="leading-none font-semibold">Sites</h2>
          {/* His subtitle is `Spent against estimate, and what each has taken in`. There is no estimate on a site, so the column it names is not here and neither is the half of the sentence promising it. */}
          <p className="text-muted-foreground text-[0.8125rem]">What each one has spent, and what it has taken in</p>
        </div>

        {/* `ROOM_FOR_A_THUMB` and not `ROOM_FOR_A_LINK`. This one carries an arrow, so it is two lines of content tall and `columns` reads it as a control standing on its own rather than a link inside a sentence -- it measured 43px against the 44 a control needs. The four pixels a link is given are the right number for a link and the wrong one for this. */}

        {/* And it does not break in half. At 390 the subtitle beside it wraps to two lines and takes the row's width with it, leaving this squeezed to `All` over `sites` with the arrow beside the second word -- a control that reads as a rendering fault. `shrink-0` is the half that matters: without it, `whitespace-nowrap` only moves the overflow somewhere else. */}
        <Link
          to="/"
          className={`text-brass flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-medium whitespace-nowrap ${ROOM_FOR_A_THUMB}`}
        >
          All sites
          <ArrowRight aria-hidden className="size-3.5 shrink-0" />
        </Link>
      </div>

      {houses.length === 0 ? (
        <p className="text-muted-foreground px-5 pb-5">No houses yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground px-5 text-[0.75rem] font-semibold">Site</TableHead>
              {/* The column a phone gives up, which is the app's own measured decision rather than his: with four columns at 390 the name cell was 62px wide and 279px tall, wrapping `1-A, Phase 0For The fami` to about a letter a line. A phone gets fewer columns rather than narrower ones, and where a house has got to is a word somebody can get from the house itself -- the two figures beside it are not. */}
              <TableHead className="text-muted-foreground hidden text-[0.75rem] font-semibold sm:table-cell">
                Stage
              </TableHead>
              <TableHead className="text-muted-foreground text-right text-[0.75rem] font-semibold">Spent</TableHead>
              <TableHead className="text-muted-foreground px-5 text-right text-[0.75rem] font-semibold">
                Received
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {houses.map((house) => {
              const stage = STAGE[house.stage]
              const what = whatItIs(house)

              return (
                <TableRow key={house.siteId}>
                  {/* His row is clickable all over. It is the name that carries the link here, because a `tr` with an `onClick` is reachable by a mouse and by nothing else -- and the row still lights under a finger, so the affordance he drew survives. */}

                  {/* The name was 20px high, under WCAG 2.5.8's floor for a link in a line. `ROOM_FOR_A_LINK` is four pixels given straight back to the layout, so the table is as tall as it was. */}
                  <TableCell className="px-5 py-3 align-middle whitespace-normal">
                    <Link
                      to="/sites/$siteId"
                      params={{ siteId: house.siteId }}
                      className={`text-foreground block font-medium ${ROOM_FOR_A_LINK}`}
                    >
                      {house.name}
                    </Link>
                    {what === null ? null : <span className="text-muted-foreground block text-[0.75rem]">{what}</span>}
                  </TableCell>

                  <TableCell className="hidden py-3 align-middle sm:table-cell">
                    <Pill tone={stage?.tone ?? 'quiet'}>{stage?.said ?? house.stage}</Pill>
                  </TableCell>

                  <TableCell className="py-3 text-right align-middle">
                    <Figure>{formatPaisa(house.goneOutPaisa)}</Figure>
                  </TableCell>

                  <TableCell className="px-5 py-3 text-right align-middle">
                    <Figure className="text-green">{formatPaisa(house.comeInPaisa)}</Figure>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  )
}
