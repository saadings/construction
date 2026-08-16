import { ConvexError } from 'convex/values'

// What to put in front of somebody when the server has refused. Written out twenty-four times in eighteen files, in four shapes, and three of the four were wrong in some way.

// The one that was right is what this is: `instanceof ConvexError`, which is typed, rather than a cast asserting that whatever was thrown has a `data` on it. Seventeen of the copies used the cast, because a component that never imports `ConvexError` cannot ask the question properly and asks it by assertion instead.

// It refuses a `data` that is not words. `String(thrown.data)` on an object puts `[object Object]` in front of a person, which five of the route copies would have done -- and a refusal nobody can read is worse than the plain sentence underneath, because it looks like the app talking to itself.
export function whatWentWrong(thrown: unknown, ifItSaidNothing = 'That did not go in. Try once more.'): string {
  if (!(thrown instanceof ConvexError)) {
    return ifItSaidNothing
  }

  const said: unknown = thrown.data

  return typeof said === 'string' && said !== '' ? said : ifItSaidNothing
}
