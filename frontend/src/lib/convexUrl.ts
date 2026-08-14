import { z } from 'zod'

/**
 * A Convex deployment address, and nothing else.
 *
 * `z.string().url()` — which this replaced — accepts `https://.convex.cloud`
 * and `https://construction`. Both are what a mis-derived deployment address
 * actually looks like when a key is parsed wrongly, so the permissive check
 * would have let the app boot and then fail against an address that cannot
 * resolve. Requiring a real hostname turns that into a refusal to start, with
 * a sentence saying what to fix.
 *
 * Localhost is allowed so a locally-run backend still works.
 */
const CONVEX_HOSTNAME = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+convex\.cloud$|^(localhost|127\.0\.0\.1)$/i

export const convexUrl = z.url({
  hostname: CONVEX_HOSTNAME,
  error:
    'Set VITE_CONVEX_URL to the address of the Convex deployment this app talks to, for example https://handsome-ferret-39.convex.cloud',
})
