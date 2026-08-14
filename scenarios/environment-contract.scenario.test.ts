import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Two pieces of wiring that break silently, which is what makes them worth
 * testing at all — both keep working from the outside for a while.
 *
 *   - `.env.example` drifting from what the typed loader requires. It is the
 *     only instruction anyone gets for setting this project up, and it is
 *     never executed, so nothing tells it when it has gone stale. The template
 *     shipped it already wrong: it set CONVEX_URL while the loader asked for
 *     VITE_CONVEX_URL.
 *
 *   - `convex/auth.config.ts` losing its grip on the Clerk issuer. If `domain`
 *     stops coming from the environment, or `applicationID` stops being exactly
 *     `convex`, every token Convex is handed fails its audience check.
 *     `getUserIdentity()` then returns null and every access check denies —
 *     while sign-in in the browser still looks completely normal.
 *
 * The environment is stubbed rather than read, because these tests run with
 * `.env.local` already loaded. Left alone, they would pass on the strength of
 * the machine they run on rather than on the files under test.
 */

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/**
 * A single value that satisfies every shape the loader currently asks for, so
 * this test never has to restate the schema it is checking. Restating it is the
 * drift it exists to catch.
 *
 * It has to be a Convex address, because the strictest shape the loader asks
 * for is `VITE_CONVEX_URL`, which refuses anything that is not one — a bare
 * `https://example.invalid/placeholder` used to pass here only because the
 * check was loose enough to accept `https://.convex.cloud` as well.
 *
 * A Convex address is also a non-empty string, which is all the other variables
 * require. If a future variable wants a shape this cannot satisfy, this
 * constant is where that shows up, and it should move to one placeholder per
 * variable rather than be loosened back.
 */
const PLACEHOLDER = 'https://placeholder.convex.cloud'

function exampleKeys(): Array<string> {
  return readFileSync(join(repoRoot, '.env.example'), 'utf8')
    .split('\n')
    .map((line) => /^([A-Z_][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter((key) => key !== undefined)
}

/**
 * Everything the loader could plausibly reach for, cleared before each run.
 *
 * Wider than the loader's current list on purpose: a variable it starts
 * requiring tomorrow must not be satisfied by this machine's `.env.local`
 * while `.env.example` stays silent about it.
 */
function ambientProjectKeys(): Array<string> {
  return Object.keys(process.env).filter((key) => /^(VITE_|CLERK_|CONVEX_|CLOUDFLARE_)/.test(key))
}

async function loadTypedEnvironment(present: Record<string, string>) {
  vi.resetModules()

  for (const key of new Set([...ambientProjectKeys(), ...exampleKeys()])) {
    vi.stubEnv(key, undefined)
  }
  for (const [key, value] of Object.entries(present)) {
    vi.stubEnv(key, value)
  }

  const loaded: unknown = await import('../frontend/src/lib/env')
  return (loaded as { env: Record<string, string | undefined> }).env
}

async function loadAuthConfig(issuer: string | undefined) {
  vi.resetModules()
  vi.stubEnv('CLERK_FRONTEND_API_URL', issuer)

  return (await import('../convex/auth.config')).default
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the environment file people are told to copy', () => {
  it('carries everything the app refuses to start without', async () => {
    const fromExample = Object.fromEntries(exampleKeys().map((key) => [key, PLACEHOLDER]))

    const env = await loadTypedEnvironment(fromExample)

    // Reading the placeholder back proves the loader took the stubbed values
    // rather than this machine's, so a pass means the example really is enough.
    expect(env.VITE_CONVEX_URL).toBe(PLACEHOLDER)
  })

  it('is what makes the difference — the app will not start without it', async () => {
    // The control. If clearing the environment left the real values in place,
    // the test above would pass no matter what `.env.example` said.
    await expect(loadTypedEnvironment({})).rejects.toThrow()
  })
})

describe('the join between Clerk and Convex', () => {
  const issuer = 'https://scenario-check.clerk.accounts.dev'

  it('takes the issuer from the deployment it is running on', async () => {
    const config = await loadAuthConfig(issuer)

    expect(config.providers[0].domain).toBe(issuer)
  })

  it('has no issuer to fall back on when the deployment has none', async () => {
    // The one that matters. A fallback added for local convenience would keep
    // the test above passing while quietly pointing production Convex at the
    // development Clerk instance — where sign-in works, tokens are issued, and
    // every one of them is rejected.
    const config = await loadAuthConfig(undefined)

    expect(config.providers[0].domain).toBeUndefined()
  })

  it('answers to exactly the name the JWT template is given', async () => {
    // Checked against the token's `aud` claim character for character. The
    // Clerk template is named `convex`; anything else here denies everything.
    const config = await loadAuthConfig(issuer)

    expect(config.providers[0].applicationID).toBe('convex')
  })
})

describe('what the deployment has to be told', () => {
  /**
   * Convex sets these on every deployment itself. Naming them keeps the check
   * below from crying wolf the first time one is read, which is how a check
   * like this ends up deleted.
   */
  const SET_BY_CONVEX = new Set(['CONVEX_CLOUD_URL', 'CONVEX_SITE_URL'])

  function readByTheBackend(): Array<string> {
    const source = execFileSync('git', ['grep', '-ho', '-E', 'process\\.env\\.[A-Z0-9_]+', '--', 'convex/'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })

    return [...new Set(source.split('\n').map((line) => line.replace('process.env.', '').trim()))]
      .filter((name) => name.length > 0 && !SET_BY_CONVEX.has(name))
      .sort()
  }

  it('names every variable the backend reads', () => {
    // The frontend comparison above cannot see these. It checks `.env.example`
    // against the typed loader, which is a frontend-only list, so a variable
    // read by Convex alone is structurally invisible to it — and going without
    // one is not a crash. CLERK_WEBHOOK_SECRET missing makes the webhook answer
    // 500, which leaves the users table empty while the browser shows a
    // completed sign-up.
    const documented = new Set(exampleKeys())

    expect(readByTheBackend().filter((name) => !documented.has(name))).toEqual([])
  })

  it('finds the variables it is checking', () => {
    // The control. A grep that matched nothing would report every variable
    // documented, which is the same answer a correct one gives.
    expect(readByTheBackend().length).toBeGreaterThanOrEqual(2)
  })
})
