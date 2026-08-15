import { ConvexError } from 'convex/values'

// Test-only. Nothing that runs in the app imports this, so it is never bundled into a deployment.

// `convex-test` hands a thrown value back as it crossed the wire, where a sentence is JSON -- quotes and all. The sentence inside is what a phone is shown.
export function theSentenceIn(data: unknown): string {
  const asItCrossed = String(data)

  return asItCrossed.startsWith('"') ? (JSON.parse(asItCrossed) as string) : asItCrossed
}

// The whole sentence, so an assertion can compare all of it. `toContain` cannot tell a refusal apart from a refusal with something else stuck to it, which is how a wrapped or truncated message would have passed unnoticed.

// A refusal thrown as anything but a `ConvexError` reaches a phone as "Server Error" and says nothing at all, so it is named rather than compared.
export async function refusalFrom(promise: Promise<unknown>): Promise<string> {
  return await promise.then(
    () => 'nothing was refused',
    (thrown: unknown) =>
      thrown instanceof ConvexError ? theSentenceIn(thrown.data) : 'thrown as something a phone never sees'
  )
}
