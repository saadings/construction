import { zid } from 'convex-helpers/server/zod4'
import { z } from 'zod'

import { note, pakistaniMobile, personName } from './primitives'

// Two rows for one man split his money across two records, and every figure about him is then wrong and quietly so. So a name is compared the way a person would compare it: the spacing is already normalised by `personName`, and case is not a different man.
export function sameName(one: string, other: string): boolean {
  return one.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === other.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

// Said with the name in it. "Already exists" leaves somebody looking down a list to work out which one, which is the moment he gives up and adds a second.
export function sayTheNameIsTaken(name: string): string {
  return `There is already somebody called ${name}.`
}

// Somebody picked from the list, or a name typed into it. Written once because five screens ask it: a payment, money coming in, a share, an engagement, a contract.

// Both optional and one of them required, which no single field can say. The refusal belongs to whoever is asking -- "say who was paid" and "say whose share this is" are different sentences about the same missing answer.
export const whoWasNamed = {
  personId: zid('people').optional(),
  newPerson: personName.optional(),
}

/** Whether an answer names anybody at all. The half a `.refine` needs, kept beside the shape rather than written out at each of the five. */
export function namesSomebody(who: { personId?: string; newPerson?: string }): boolean {
  return !!who.personId || !!who.newPerson
}

// Everyone the business deals with, with no role on them: the same man invests in one site and sells steel to another.
export const personInput = z.object({
  name: personName,
  phone: pakistaniMobile.optional(),
  notes: note.optional(),
})
