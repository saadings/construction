import { Link } from '@tanstack/react-router'
import { formatPaisa } from '~shared/money'

export type SiteRow = {
  _id: string
  name: string
  stage: 'planning' | 'building' | 'finishing' | 'complete' | 'sold'
  builtForAClient: boolean
  spentPaisa: number
}

// The words a person would use for where a house has got to. "Complete" is what the schema calls it; "Finished" is what he calls it.
const STAGE: Record<SiteRow['stage'], string> = {
  planning: 'Planning',
  building: 'Building',
  finishing: 'Finishing',
  complete: 'Finished',
  sold: 'Sold',
}

export function SitesList({ sites }: { sites: Array<SiteRow> }) {
  return (
    <div className="bg-background min-h-dvh pb-28">
      <header className="mx-auto max-w-lg px-5 pt-8 pb-5">
        <h1 className="text-foreground font-display text-[2.25rem] leading-none">Sites</h1>
      </header>

      <main className="mx-auto max-w-lg px-5">
        {sites.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center">
            No houses yet. Start one and the spending goes under it.
          </p>
        ) : (
          <ol className="border-border divide-border divide-y border-t border-b">
            {sites.map((site) => (
              <li key={site._id}>
                <Link
                  to="/sites/$siteId/day"
                  params={{ siteId: site._id }}
                  className="flex items-baseline justify-between gap-4 py-4"
                >
                  <span className="min-w-0">
                    <span className="text-foreground block truncate text-[1.0625rem]">{site.name}</span>
                    <span className="text-muted-foreground block text-sm">
                      {STAGE[site.stage]}
                      {site.builtForAClient ? ' · For a client' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-foreground block text-lg">{formatPaisa(site.spentPaisa)}</span>
                    <span className="text-muted-foreground block text-[0.75rem] tracking-[0.06em] uppercase">
                      Spent
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0">
        <div className="mx-auto max-w-lg px-5 pb-6">
          <Link
            to="/sites/new"
            className="bg-primary text-primary-foreground block rounded-md py-3 text-center font-medium shadow-lg"
          >
            Start a site
          </Link>
        </div>
      </div>
    </div>
  )
}
