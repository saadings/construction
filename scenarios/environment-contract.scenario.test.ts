import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

// Two silent breakages — `.env.example` drifting from the loader, and auth.config.ts losing the Clerk issuer — with the environment stubbed, never read.

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

// One value satisfying every shape the loader asks for, so this never restates the schema it checks — restating it is the drift it catches.
const PLACEHOLDER = 'https://placeholder.convex.cloud'

function exampleKeys(): Array<string> {
  return readFileSync(join(repoRoot, '.env.example'), 'utf8')
    .split('\n')
    .map((line) => /^([A-Z_][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter((key) => key !== undefined)
}

// Wider than the loader's current list on purpose, so a variable it starts requiring tomorrow cannot be satisfied by this machine.
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

    // Reading the placeholder back proves the loader took the stubbed values rather than this machine's.
    expect(env.VITE_CONVEX_URL).toBe(PLACEHOLDER)
  })

  it('is what makes the difference — the app will not start without it', async () => {
    // The control: if clearing left the real values in place, the test above passes whatever `.env.example` says.
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
    // A fallback added for local convenience points production Convex at the development Clerk instance, and every token is then rejected.
    const config = await loadAuthConfig(undefined)

    expect(config.providers[0].domain).toBeUndefined()
  })

  it('answers to exactly the name the JWT template is given', async () => {
    // Checked against the token's `aud` claim character for character: anything but `convex` denies everything.
    const config = await loadAuthConfig(issuer)

    expect(config.providers[0].applicationID).toBe('convex')
  })
})

describe('what the deployment has to be told', () => {
  // Convex sets these itself, and a check that cries wolf on them is a check somebody deletes.
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
    // A variable only Convex reads is invisible to the frontend comparison above, and missing CLERK_WEBHOOK_SECRET empties the users table while sign-up looks complete.
    const documented = new Set(exampleKeys())

    expect(readByTheBackend().filter((name) => !documented.has(name))).toEqual([])
  })

  it('finds the variables it is checking', () => {
    // The control: a grep matching nothing reports every variable documented, the same answer a correct one gives.
    expect(readByTheBackend().length).toBeGreaterThanOrEqual(2)
  })
})
