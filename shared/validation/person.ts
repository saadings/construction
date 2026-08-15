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

// Everyone the business deals with, with no role on them: the same man invests in one site and sells steel to another.
export const personInput = z.object({
  name: personName,
  phone: pakistaniMobile.optional(),
  notes: note.optional(),
})
