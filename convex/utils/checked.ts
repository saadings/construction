import { ConvexError } from 'convex/values'
import type { ZodType, output } from 'zod'

// The one place a schema meets a call: Zod decides what a value may be and rewrites it as it is stored, so trimming and normalising happen on the server rather than on trust.

// The first message comes back as written, because these are sentences meant for Nauman, and a `ConvexError` is what carries them past a production deployment.
export function checked<Schema extends ZodType>(schema: Schema, input: unknown): output<Schema> {
  const result = schema.safeParse(input)

  if (!result.success) {
    throw new ConvexError(result.error.issues[0]?.message ?? 'Check what you have put in.')
  }

  return result.data
}
