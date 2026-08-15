import { useMutation, useQuery } from 'convex/react'
import { ConvexError } from 'convex/values'
import { formatPaisa } from '~shared/money'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Figure } from '../shell/Page'
import { Skeleton, WhileWaiting } from '../shell/Skeleton'
import { AgreeAContract } from './AgreeAContract'
import { ChangeTheContract } from './ChangeTheContract'
import { ExtraWork } from './ExtraWork'
import { Stages } from './Stages'

// What a client is being charged: the contract, the stages it is billed in, and the work that was outside it. Only a house built for a client has any of this.
export function Billing({ siteId }: { siteId: Id<'sites'> }) {
  const contract = useQuery(api.contracts.queries.forSite, { siteId })
  const stages = useQuery(api.milestones.queries.forSite, { siteId })
  const extra = useQuery(api.extraWork.queries.forSite, { siteId })
  const people = useQuery(api.people.queries.list, {})

  const agree = useMutation(api.contracts.mutations.agree)
  const measure = useMutation(api.contracts.mutations.measure)
  const revise = useMutation(api.contracts.mutations.revise)
  const cancel = useMutation(api.contracts.mutations.cancel)
  const addStage = useMutation(api.milestones.mutations.add)
  const billStage = useMutation(api.milestones.mutations.bill)
  const raiseExtra = useMutation(api.extraWork.mutations.raise)
  const takeBackExtra = useMutation(api.extraWork.mutations.takeBack)

  // Nothing at all here would be a section that appears out of the page once it arrives, pushing everything under it down.
  if (contract === undefined || stages === undefined || extra === undefined || people === undefined) {
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

  // No contract yet, which is where every house built for somebody starts. It used to say so and stop, and there was nowhere in the app to say what was agreed.
  if (contract === null || stages === null) {
    return (
      <section className="flex flex-col gap-3">
        <Heading>The contract</Heading>
        <p className="text-muted-foreground max-w-prose">
          Nothing agreed on this house yet. Put in what the client is paying, and the stages and the bills follow it.
        </p>
        {people === null ? (
          // Nobody to pick from is not an empty list: the read was refused, and offering a picker with nothing in it would look like a house with no client to choose.
          <p className="text-muted-foreground">The list of people did not come back. Open the house again.</p>
        ) : (
          <AgreeAContract
            people={people}
            onAgree={async ({ clientId, ...agreed }) => {
              // Looked up rather than cast: the picker holds a plain string, and the one place that string becomes a person is here, where the list it came from is in hand.
              const client = people.find((person) => person._id === clientId)
              if (client === undefined) {
                throw new ConvexError('Say who the house is being built for.')
              }

              await agree({ siteId, clientId: client._id, ...agreed })
            }}
          />
        )}
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

        <ChangeTheContract
          contract={contract}
          onMeasure={async (actualAreaSqft) => {
            await measure({ siteId, contractId: contract._id, actualAreaSqft })
          }}
          onRevise={async (revision) => {
            await revise({ siteId, contractId: contract._id, ...revision })
          }}
          onCancel={async () => {
            await cancel({ siteId, contractId: contract._id })
          }}
        />
      </section>

      <Stages
        stages={stages.stages}
        percentAgreed={stages.percentAgreed}
        onAdd={async (stage) => {
          await addStage({ siteId, contractId: contract._id, ...stage })
        }}
        onBill={async (milestoneId, billedOn) => {
          // Looked up in the list it came from rather than cast, the same way the client is: the row is in hand here, and a cast would be a promise about a string.
          const stage = stages.stages.find((one) => one._id === milestoneId)
          if (stage === undefined) {
            throw new ConvexError('That stage is not on this house.')
          }

          await billStage({ siteId, milestoneId: stage._id, billedOn })
        }}
      />

      {extra === null ? (
        // A refusal rather than an absence. Every other read on this house came back, so saying "none billed" here would be inventing an answer nobody gave.
        <section className="flex flex-col gap-3">
          <p className="text-muted-foreground">Work outside the contract did not come back. Open the house again.</p>
        </section>
      ) : (
        <ExtraWork
          bills={extra}
          onRaise={async (bill) => {
            await raiseExtra({ siteId, ...bill })
          }}
          onTakeBack={async (billId) => {
            // Looked up in the list it came from rather than cast, the same as the client and the stage.
            const bill = extra.find((one) => one._id === billId)
            if (bill === undefined) {
              throw new ConvexError('That bill is not on this house.')
            }

            await takeBackExtra({ siteId, billId: bill._id })
          }}
        />
      )}
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
