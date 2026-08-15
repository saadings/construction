import { useQuery } from 'convex/react'
import { formatPaisa } from '~shared/money'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Figure } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'

// What a client is being charged: the contract, the stages it is billed in, and the work that was outside it. Only a house built for a client has any of this.
export function Billing({ siteId }: { siteId: Id<'sites'> }) {
  const stages = useQuery(api.milestones.queries.forSite, { siteId })
  const extra = useQuery(api.extraWork.queries.forSite, { siteId })

  // Nothing at all here would be a section that appears out of the page once it arrives, pushing everything under it down.
  if (stages === undefined || extra === undefined) {
    return (
      <WhileWaiting what="Getting the billing">
        <Skeleton className="h-3 w-24" />
        <div className="divide-hairline flex flex-col divide-y">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 py-2.5">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-4 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </WhileWaiting>
    )
  }

  // Both answer null to a caller who may not open the house. Nothing to show is the same thing to look at either way, so they are read together.
  if (stages === null || extra === null) {
    return (
      <section className="flex flex-col gap-2">
        <Heading>Billing</Heading>
        <p className="text-muted">No contract agreed on this house yet.</p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <Heading>The contract</Heading>
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
          <Figures label="Agreed" paisa={stages.contractValuePaisa} />
          <div>
            <Label>Stages agreed</Label>
            {/* Shown as it is, never made to be a hundred: a re-measurement or an unplanned stage leaves real contracts at eighty-five. */}
            <Figure className="text-foreground text-xl">{stages.percentAgreed}%</Figure>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Heading>Billed in stages</Heading>
        {stages.stages.length === 0 ? (
          <p className="text-muted">No stages set out yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-left">
              <tbody className="divide-hairline divide-y">
                {stages.stages.map((stage) => (
                  <tr key={stage._id}>
                    <td className="text-foreground py-2.5 pr-4">{stage.description}</td>
                    <td className="py-2.5 pr-4">
                      <Figure className="text-muted">{stage.percent}%</Figure>
                    </td>
                    {/* Green is money owed to him. */}
                    <td className="py-2.5 pr-4 text-right">
                      <Figure className="text-green">{formatPaisa(stage.amountPaisa)}</Figure>
                    </td>
                    <td className="text-muted py-2.5 text-right text-sm">
                      {stage.billedOn === undefined ? 'Not billed' : stage.billedOn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <Heading>Work outside the contract</Heading>
        {extra.length === 0 ? (
          <p className="text-muted">None billed.</p>
        ) : (
          <ol className="flex flex-col gap-5">
            {extra.map((bill) => (
              <li key={bill._id} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <span className="text-foreground">{bill.description}</span>
                  <Figure className="text-green text-lg">{formatPaisa(bill.totalPaisa)}</Figure>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] border-collapse text-left">
                    <tbody className="divide-hairline divide-y">
                      {bill.lines.map((line) => (
                        <tr key={line._id}>
                          <td className="text-muted py-2 pr-4 text-sm">{line.description}</td>
                          {/* The working exactly as it was measured on site. It is what makes the bill defensible. */}
                          <td className="py-2 pr-4">
                            <Figure className="text-faint text-sm">{line.working ?? ''}</Figure>
                          </td>
                          <td className="py-2 pr-4 text-right">
                            <Figure className="text-muted text-sm">
                              {line.quantity} {line.unit}
                            </Figure>
                          </td>
                          <td className="py-2 text-right">
                            <Figure className="text-foreground text-sm">{formatPaisa(line.amountPaisa)}</Figure>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function Heading({ children }: { children: string }) {
  return <h2 className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{children}</h2>
}

function Label({ children }: { children: string }) {
  return <p className="text-faint text-[0.75rem] font-medium tracking-[0.08em] uppercase">{children}</p>
}

function Figures({ label, paisa }: { label: string; paisa: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Figure className="text-green text-2xl">{formatPaisa(paisa)}</Figure>
    </div>
  )
}
