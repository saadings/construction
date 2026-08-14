import type { WebhookEvent } from '@clerk/backend'
import { Webhook } from 'svix'

/**
 * What came of trying to check an incoming request.
 *
 * The two failures are kept apart because they call for opposite answers. A
 * signature that does not match is the sender's problem and will never match
 * however many times it is sent. A signing secret this deployment does not
 * have is our problem, and the very same message succeeds once it does.
 */
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

  // Built here rather than at module load, and outside the verification catch
  // below, so a deployment that has no signing secret is answered rather than
  // crashed through. Svix throws from its constructor on an absent or
  // unreadable secret, and that throw used to escape the handler entirely.
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
