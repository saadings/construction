import { z } from 'zod'

// A Convex deployment address and nothing else: `z.string().url()` accepts `https://.convex.cloud`, which cannot resolve.
const CONVEX_HOSTNAME = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+convex\.cloud$|^(localhost|127\.0\.0\.1)$/i

export const convexUrl = z.url({
  hostname: CONVEX_HOSTNAME,
  error:
    'Set VITE_CONVEX_URL to the address of the Convex deployment this app talks to, for example https://handsome-ferret-39.convex.cloud',
})
