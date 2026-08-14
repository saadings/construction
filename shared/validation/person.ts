import { z } from 'zod'

import { note, pakistaniMobile, personName } from './primitives'

// Everyone the business deals with, with no role on them: the same man invests in one site and sells steel to another.
export const personInput = z.object({
  name: personName,
  phone: pakistaniMobile.optional(),
  notes: note.optional(),
})
