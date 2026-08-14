import type { WebhookEvent } from '@clerk/backend'
import { Webhook } from 'svix'

// The two failures stay apart because they need opposite answers: a bad signature never succeeds, a missing secret will.
export type WebhookCheck =
  | { outcome: 'fromClerk'; event: WebhookEvent }
  | { outcome: 'notFromClerk' }
  | { outcome: 'nothingToCheckAgainst' }

const SIGNED_HEADERS = ['svix-id', 'svix-timestamp', 'svix-signature'] as const

/** Null when any signed header is absent, which means this is not from Clerk. */
function signedHeaders(req: Request): Record<string, string> | null {
  const headers: Record<string, string> = {}

  for (const name of SIGNED_HEADERS) {
    const value = req.headers.get(name)
    if (value === null) {
      return null
    }
    headers[name] = value
  }

  return headers
}

export async function validateRequest(req: Request): Promise<WebhookCheck> {
  const payloadString = await req.text()

  const headers = signedHeaders(req)
  if (headers === null) {
    return { outcome: 'notFromClerk' }
  }

  // Built here, not at module load: svix throws from its constructor on a missing secret, and that throw escaped the handler.
  let webhook: Webhook
  try {
    webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET ?? '')
  } catch {
    return { outcome: 'nothingToCheckAgainst' }
  }

  try {
    return { outcome: 'fromClerk', event: webhook.verify(payloadString, headers) as WebhookEvent }
  } catch (error) {
    console.error('Could not verify a webhook against the signing secret', error)
    return { outcome: 'notFromClerk' }
  }
}
