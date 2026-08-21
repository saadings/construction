import { createFileRoute, useRouter } from '@tanstack/react-router'

import { ADayOfPayments } from '../components/daySheet/ADayOfPayments'

/** Somebody this sheet was asked to open on, named the way it reads in an address bar rather than the way the column is named. */
export const PAYING = 'paying'

export const Route = createFileRoute('/sites/$siteId/daybook')({
  component: ADayOnSite,

  // Declared, or nothing arrives: a route without this drops every parameter, and a `Pay` link sending one would navigate, draw the right screen, choose nobody, and photograph exactly like a link that worked.

  // Read as an unknown and narrowed here rather than trusted: an address is typed by people and outlives whatever it was copied from, so the only thing that can be said at this edge is whether there is a non-empty string in it.
  validateSearch: (search: Record<string, unknown>): { paying?: string } => {
    const asked: unknown = search[PAYING]

    return typeof asked === 'string' && asked !== '' ? { paying: asked } : {}
  },
})

// A day of payments against this house, reached from the house itself. The house is in the address, so nothing is picked here.

// Everything under it is `ADayOfPayments`, shared with `/daybook`. The two were the same forty lines of wiring written twice, which is how they come to disagree about what a refusal says or which day the sheet opens on.
function ADayOnSite() {
  const { siteId } = Route.useParams()
  const { paying } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()

  return (
    <ADayOfPayments
      siteId={siteId}
      paying={paying}
      // Taken out of the address once the sheet has decided what to do with it, replacing rather than pushing so it leaves nothing to go back to. An address still naming a person is a refresh away from putting them back over whoever has been chosen since -- and the person it names may by then be somebody nobody is paying.
      onPayingTaken={() => {
        void navigate({ search: (was) => ({ ...was, paying: undefined }), replace: true })
      }}
      // Back to the house and not to the list: the figure he has just moved is that house's, and watching it move is the whole reason the day was entered.
      whereToAfterwards={async (went) => {
        await router.navigate({ to: '/sites/$siteId', params: { siteId: went } })
      }}
    />
  )
}
