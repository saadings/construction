import { ConvexError } from 'convex/values'

import { sameName } from '../../shared/validation/person'
import type { Doc, Id } from '../_generated/dataModel'
import type { LedgerMutationCtx } from '../utils/ledgerAccess'

// Three screens each needed to name somebody, so three mutations write to `people`: the people screen, the day sheet, and money coming in. A rule enforced at one of them is a rule about that door rather than about the table, and two rows for one man split his money across both -- every figure about him wrong, and quietly so.

// Read whole rather than through `byName`, because the index answers about the name exactly as typed and the same man is the same man in any case and any spacing.
export async function personAlreadyCalled(
  ctx: Pick<LedgerMutationCtx, 'db'>,
  name: string
): Promise<Doc<'people'> | null> {
  const everyone = await ctx.db.query('people').withIndex('byName').collect()

  return everyone.find((person) => sameName(person.name, name)) ?? null
}

// Written once because it was written twice and is now wanted six times: a payment, money coming in, an engagement, a bill, a contract, a share. A rule kept at one door is a rule about that door, and this rule is the whole reason typing a name is safe.

/** Who an answer means, whether he was picked from the list or typed into it. Every door that can name somebody goes through this one. */
export async function whoIsMeant(
  ctx: Pick<LedgerMutationCtx, 'db'>,
  who: { personId?: Id<'people'>; newPerson?: string },
  sayNobody: string
): Promise<Id<'people'>> {
  if (who.personId !== undefined) {
    return who.personId
  }

  // The schema has already refused an answer naming nobody. This is how the type sees that, and it says the same sentence, so one mistake can never come back worded two ways.
  if (who.newPerson === undefined) {
    throw new ConvexError(sayNobody)
  }

  // Somebody already on the list, typed rather than picked, is that person. Inserting regardless puts a second row under one name through a door the people screen refuses -- and two rows for one man split his money across both, so every figure about him is wrong and quietly so.
  const already = await personAlreadyCalled(ctx, who.newPerson)

  // Left hidden if he is hidden: taking somebody off the list is a decision about the list, not about who was named here.
  return already?._id ?? (await ctx.db.insert('people', { name: who.newPerson, hidden: false }))
}
