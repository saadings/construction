import { SAY_CLERK } from '../../shared/validation/invite'

// What to put in front of somebody when Clerk refuses. Every failure said one sentence before this -- "That did not go through. Try once more in a moment." -- for a duplicate, a rate limit, a permission problem and a misconfiguration alike, which are four things a person would do four different things about.

// The status and the body went to `console.error` and nowhere else, so the whole diagnosis lived in a log nobody watching the screen can read. Nauman got that sentence inviting his first partner and stayed stuck on it.

// The sentences themselves are in `shared/validation/invite.ts` beside the ones a form refuses with, because the screen falls back to the last of them when nothing readable was thrown at all -- so keeping them here would be one sentence written in two places and free to drift.
export { SAY_CLERK }

// Clerk answers a refusal with `{ errors: [{ code, message, long_message, meta }] }`. Read defensively rather than typed: this is somebody else's shape, it has changed before, and a body that arrives as something unexpected must fall through to the generic sentence rather than throw a second time on top of the first.
export function codesIn(body: unknown): Array<string> {
  if (typeof body !== 'object' || body === null) return []

  const errors: unknown = (body as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return []

  return errors
    .map((one: unknown) => (typeof one === 'object' && one !== null ? (one as { code?: unknown }).code : undefined))
    .filter((code): code is string => typeof code === 'string')
}

// Named cases only. Anything not recognised keeps the generic sentence and the log line, because a sentence invented for a case nobody has seen is a guess a person will act on.
export function whatClerkSaid(status: number, body: unknown): string {
  const codes = codesIn(body)

  // The address is already spoken for. Clerk spells it two ways depending on whether it collides with an invitation or with an account, and both mean the same thing to whoever is reading the screen.
  if (codes.includes('duplicate_record') || codes.includes('form_identifier_exists')) {
    return SAY_CLERK.already
  }

  // The one that was actually stopping him, found by asking Clerk rather than by guessing: a 400 saying invitations are only supported on instances that accept email addresses. Nobody could have read it off the screen, and both of our guesses -- a duplicate, a rate limit -- were wrong.

  // Read as a code rather than as a 400, because 400 is what Clerk says to a dozen unrelated things and the code is the part that means this.
  if (codes.includes('invitations_not_supported')) {
    return SAY_CLERK.noEmailSignIn
  }

  if (status === 429) {
    return SAY_CLERK.tooMany
  }

  // Not a mistake anybody using the app can make or fix, so it says which of the two it is rather than reading as a refusal aimed at them. The same sentence a missing key already gives.
  if (status === 401 || status === 403) {
    return SAY_CLERK.notSwitchedOn
  }

  return SAY_CLERK.unknown
}
