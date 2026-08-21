import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { formatPaisa } from '~shared/money'

import { cn } from '../../lib/utils'
import { Figure, Page } from '../shell/Page'
import { Panel, Pill } from '../shell/Panel'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

export type SiteRow = {
  _id: string
  name: string
  stage: 'planning' | 'building' | 'finishing' | 'complete' | 'sold'
  builtForAClient: boolean
  spentPaisa: number
  receivedPaisa: number
  /** Who it is being built for, derived from the house's own roles. Absent where the partnership is building it to sell. */
  clientName?: string
  coveredAreaSqft?: number
  /** What the build is expected to cost. Absent until somebody has said, which is not the same as nothing. */
  budgetEstimatePaisa?: number
}

// The words a person would use for where a house has got to. "Complete" is what the schema calls it; "Finished" is what he calls it.
const STAGE: Record<SiteRow['stage'], string> = {
  planning: 'Planning',
  building: 'Building',
  finishing: 'Finishing',
  complete: 'Finished',
  sold: 'Sold',
}

// A card a house, as drawn, rather than a row. This was a table of four columns -- which is the shape of his **Dashboard**, and nobody had opened his drawing of this screen.

// The card carries what a row could not: who it is for, how big it is, and how far the spending has got against what the build was expected to cost.
export function SitesList({ sites }: { sites: Array<SiteRow> }) {
  return (
    <Page
      title="Sites"
      said={`${String(sites.length)} sites on the books. Open one to see what it has cost and what it has taken in.`}
      beside={<StartOne className="hidden sm:inline-flex" />}
    >
      {sites.length === 0 ? (
        <p className="text-muted-foreground py-10">No houses yet. Start one and the spending goes under it.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {sites.map((site) => (
            <li key={site._id} className="flex">
              <House site={site} />
            </li>
          ))}
        </ul>
      )}

      <StartOne className="fixed right-5 bottom-5 z-10 size-14 justify-center rounded-full shadow-lg sm:hidden" short />
    </Page>
  )
}

function House({ site }: { site: SiteRow }) {
  return (
    <Panel className="hover:border-brass flex w-full transition-colors">
      <Link
        to="/sites/$siteId"
        params={{ siteId: site._id }}
        className="flex h-full w-full flex-col gap-5 p-5 text-left"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-foreground truncate text-[1.0625rem] font-semibold">{site.name}</span>
            <WhatItIs site={site} />
          </span>

          {/* Plain, as drawn. The tinted planes are on his Dashboard's stages and on a partner's role; one here would say a stage is a meaning colour on the screen where he drew it as not. */}
          <Pill className="shrink-0">{STAGE[site.stage]}</Pill>
        </span>

        <AgainstTheEstimate site={site} />

        <span className="border-border grid grid-cols-3 gap-3 border-t pt-4">
          <Sum said="Spent">{formatPaisa(site.spentPaisa)}</Sum>
          <Sum said="Estimate" tone="text-muted-foreground">
            {site.budgetEstimatePaisa === undefined ? '\u2014' : formatPaisa(site.budgetEstimatePaisa)}
          </Sum>
          {/* Green is money coming to the partnership, the same as everywhere else it is shown. */}
          <Sum said="Received" tone="text-green">
            {formatPaisa(site.receivedPaisa)}
          </Sum>
        </span>
      </Link>
    </Panel>
  )
}

// The second line: who it is for and how big it is. Both are optional on a house, and the separator belongs to the pair rather than to the line -- a card showing a lone middle dot is one that looks broken rather than one that has not been told.
function WhatItIs({ site }: { site: SiteRow }) {
  const said = [
    // `{{s.who}}` in the drawing, which is *who it is for*. A house being built for somebody says his name; a client house with nobody named on it still says it is one; and a house the partnership will sell says so, which is the fact the old table's `Whose` column carried and the only thing that would otherwise have been lost in becoming a card.
    whoItIsFor(site),
    site.coveredAreaSqft === undefined ? undefined : `${site.coveredAreaSqft.toLocaleString('en-US')} sqft`,
  ].filter((piece) => piece !== undefined)

  if (said.length === 0) {
    return null
  }

  return <span className="text-muted-foreground truncate text-[0.8125rem]">{said.join(' \u00b7 ')}</span>
}

function whoItIsFor(site: SiteRow): string | undefined {
  if (site.clientName !== undefined) return `For ${site.clientName}`

  return site.builtForAClient ? 'For a client' : 'Ours to sell'
}

// Two quantities, and collapsing them into one `Math.min` is what shipped: **a bar cannot draw past its own track and a percentage has no such limit.**

// `204-C` had spent 8,140,000 against an estimate of 7,250,000 and the card said `100%`. The colour was right, the bar was right, and the figure said *at the limit* where the ledger meant *twelve per cent past it* -- which on an overspent house is the entire content of the number and the one thing somebody would act on.

// Nothing in the suite could have caught it. Every guard passed and the arithmetic was correct; the only wrong thing was a plausible number. `100%` is exactly what a capped overspend produces **and** exactly what a house spent to the rupee produces -- one string, two ideas, which is this app's oldest failure.

/** How much of the estimate the spending has used, uncapped: past a hundred is the state that matters. */
export function acrossTheEstimate(spentPaisa: number, estimatePaisa: number): number {
  if (estimatePaisa <= 0 || spentPaisa <= 0) {
    return 0
  }

  return Math.round((spentPaisa / estimatePaisa) * 100)
}

/** How wide to draw it, which is the one place the hundred belongs. */
export function howWideTheBarIs(share: number): number {
  return Math.min(100, Math.max(0, share))
}

// The bar he drew, and what stands in its place until an estimate has been set. A blank reads as broken; a sentence reads as a ledger saying what it has not been told, which is what this app already does with `Not yet spent`.

// It is also where the missing figure is most likely to get decided: a sentence in the bar's place, on the screen he opens, says the thing a message from us does not.
function AgainstTheEstimate({ site }: { site: SiteRow }) {
  if (site.budgetEstimatePaisa === undefined) {
    return (
      <span className="text-muted-foreground text-[0.8125rem]">
        No estimate set. Put one on this house and its spending is measured against it.
      </span>
    )
  }

  const across = acrossTheEstimate(site.spentPaisa, site.budgetEstimatePaisa)
  const over = site.spentPaisa > site.budgetEstimatePaisa

  return (
    <span className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
        <span className="text-muted-foreground">Spent against estimate</span>
        <Figure className={over ? 'text-destructive' : undefined}>{across}%</Figure>
      </span>

      {/* Drawn rather than classed: a proportion is a number, and there is no class for "sixty-three percent of whatever this is". */}
      <span className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <span
          data-bar=""
          className={`block h-full rounded-full ${over ? 'bg-destructive' : 'bg-brass'}`}
          style={{ width: `${String(howWideTheBarIs(across))}%` }}
        />
      </span>
    </span>
  )
}

function Sum({ said, tone, children }: { said: string; tone?: string; children: string }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="text-faint text-[0.6875rem] font-semibold tracking-[0.1em] uppercase">{said}</span>
      <Figure className={`text-[0.9375rem] ${tone ?? 'text-foreground'}`}>{children}</Figure>
    </span>
  )
}

// The same page, the same grid, the same card height, with nothing in it yet, so the screen does not jump when the houses arrive.
export function SitesListWaiting() {
  return (
    <Page title="Sites" beside={<StartOne className="hidden sm:inline-flex" />}>
      <WhileWaiting what="Getting your houses">
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {/* Three, because a house being built for somebody is a short list and a screenful of grey cards is a worse promise than a short one. */}
          {[0, 1, 2].map((card) => (
            <li key={card} className="flex">
              <Panel className="flex w-full flex-col gap-5 p-5">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="h-3 w-32" />
                  </span>
                  <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
                </span>
                <Skeleton className="h-2 w-full rounded-full" />
                <span className="border-border grid grid-cols-3 gap-3 border-t pt-4">
                  {[0, 1, 2].map((sum) => (
                    <span key={sum} className="flex flex-col gap-1.5">
                      <Skeleton className="h-2.5 w-14" />
                      <Skeleton className="h-4 w-20" />
                    </span>
                  ))}
                </span>
              </Panel>
            </li>
          ))}
        </ul>
      </WhileWaiting>
    </Page>
  )
}

// One button in two shapes: beside the heading where there is room, and under the thumb where there is not.

// **Both were on the screen at 390**, and had been in every picture of it since the day it was drawn. The class list here says `inline-flex` and the caller says `hidden sm:inline-flex`; joined with a template string both reach the page, they set the same property, they have equal specificity, and which one wins is decided by the order Tailwind happens to emit them in. It emitted the wrong one, so the button meant for a desk sat under the round one meant for a thumb.

// `cn` is what this needed and what every other component here already uses: tailwind-merge knows `hidden` and `inline-flex` are the same property and keeps the one the caller asked for. This file is the last in the app joining a `className` with a template string, which is why it is the only one that could have this.
function StartOne({ className, short = false }: { className?: string; short?: boolean }) {
  return (
    <Link
      to="/sites/new"
      aria-label="Add a site"
      className={cn(
        'bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2.5 font-medium',
        className
      )}
    >
      <Plus className="size-5" aria-hidden />
      {short ? null : 'Add a site'}
    </Link>
  )
}
