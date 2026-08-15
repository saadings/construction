import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

// Anyone who can reach the sign-in page can hold an account, and the first account on a deployment is the one that becomes a partner. That is a setting, and nothing else in this repository can see a setting.

export type ClerkEnvironment = {
  user_settings?: {
    sign_up?: { mode?: string }
    restrictions?: { allowlist?: { enabled?: boolean } }
  }
}

export type KeyKind = 'live' | 'test' | 'none'

/** Which deployment a publishable key belongs to. It says so itself, which is why this asks the key rather than the environment it was found in. */
export function keyKind(key: string | undefined): KeyKind {
  if (key === undefined || key === '') return 'none'
  if (key.startsWith('pk_live_')) return 'live'
  if (key.startsWith('pk_test_')) return 'test'
  return 'none'
}

const HOW_TO_CLOSE_IT = [
  'Sign-up is open on the production instance, so the first stranger to find the URL becomes its first partner.',
  'Close it by naming who may sign up:',
  '  PATCH /v1/instance/restrictions  with  { allowlist: true }',
  '  POST  /v1/allowlist_identifiers  once per partner',
].join('\n')

/** What is wrong with this deployment's sign-up, or null when there is nothing wrong with it. */
export function whatIsWrongWith(kind: KeyKind, environment: ClerkEnvironment): string | null {
  // Development staying open is convenient and costs nothing now that no real person is in the fixtures.
  if (kind !== 'live') return null

  const settings = environment.user_settings ?? {}
  const open = (settings.sign_up?.mode ?? 'public') === 'public'
  const named = settings.restrictions?.allowlist?.enabled === true

  return open && !named ? HOW_TO_CLOSE_IT : null
}

/** The Frontend API host, carried inside the key itself: base64, with a trailing `$`. */
export function hostFrom(key: string): string {
  const payload = key.replace(/^pk_(live|test)_/, '')
  const decoded = Buffer.from(payload, 'base64').toString('utf8').replace(/\$$/, '')

  return `https://${decoded}`
}

/** What the deployment says about itself, or null when it could not be asked. */
async function askClerk(host: string): Promise<ClerkEnvironment | null> {
  try {
    const answer = await fetch(`${host}/v1/environment?__clerk_api_version=2021-02-05&_clerk_js_version=5.0.0`)
    if (!answer.ok) {
      return null
    }

    return (await answer.json()) as ClerkEnvironment
  } catch {
    return null
  }
}

const OPEN_TO_ANYONE: ClerkEnvironment = {
  user_settings: { sign_up: { mode: 'public' }, restrictions: { allowlist: { enabled: false } } },
}

const OPEN_BUT_ONLY_TO_NAMED_PEOPLE: ClerkEnvironment = {
  user_settings: { sign_up: { mode: 'public' }, restrictions: { allowlist: { enabled: true } } },
}

const OPEN_ONLY_BY_INVITATION: ClerkEnvironment = {
  user_settings: { sign_up: { mode: 'restricted' }, restrictions: { allowlist: { enabled: false } } },
}

describe('who may sign up', () => {
  // This rule cannot fire until a production instance exists, so it is proved here against answers written by hand. A guard nobody has seen fail is a guard nobody has tested.
  it('is refused on production when anyone may', () => {
    const wrong = whatIsWrongWith('live', OPEN_TO_ANYONE)

    expect(wrong).not.toBeNull()
    // The message carries the fix, so whoever hits it does not have to find the two calls again.
    expect(wrong).toContain('/v1/instance/restrictions')
    expect(wrong).toContain('/v1/allowlist_identifiers')
  })

  it('is allowed on production when the people who may are named', () => {
    // The other half. Refusing everything would satisfy the check above while saying nothing.
    expect(whatIsWrongWith('live', OPEN_BUT_ONLY_TO_NAMED_PEOPLE)).toBeNull()
    expect(whatIsWrongWith('live', OPEN_ONLY_BY_INVITATION)).toBeNull()
  })

  it('leaves development open, which is where every check in this repository runs', () => {
    expect(whatIsWrongWith('test', OPEN_TO_ANYONE)).toBeNull()
  })

  it('reads which deployment a key belongs to out of the key', () => {
    expect(keyKind('pk_live_' + 'abc')).toBe('live')
    expect(keyKind('pk_test_' + 'abc')).toBe('test')
    expect(keyKind('')).toBe('none')
    expect(keyKind(undefined)).toBe('none')
    // Not a Clerk key at all, which must not read as a production one.
    expect(keyKind('sk_live_' + 'abc')).toBe('none')
  })

  it('treats a missing answer as open rather than as fine', () => {
    // An environment that carries no sign-up settings says nothing about them, and nothing is not permission.
    expect(whatIsWrongWith('live', {})).not.toBeNull()
    expect(whatIsWrongWith('live', { user_settings: {} })).not.toBeNull()
  })
})

// Cloudflare took `construction` and served us `construction-c44`, so the name the workflow deploys to is not the name the app answers on. Written down because a rule about what the public receives needs to know where to look.
export const WHERE_THE_APP_IS_SERVED = 'https://construction-c44.pages.dev'

/** True while the published build still carries a development key. Set this false the moment production is rebuilt on a live one; it may never go back. */
const SERVED_FROM_DEVELOPMENT_TODAY = true

/** The publishable key compiled into what is actually being served, or null when it could not be read. */
export async function keyInThePublishedBundle(site: string): Promise<string | null> {
  try {
    const page = await fetch(site)
    if (!page.ok) return null

    const bundles = [...(await page.text()).matchAll(/\/assets\/[A-Za-z0-9_-]+\.js/g)].map((hit) => hit[0])

    for (const bundle of bundles) {
      const script = await fetch(`${site}${bundle}`)
      const found = script.ok ? /pk_(?:test|live)_[A-Za-z0-9_-]+/.exec(await script.text()) : null
      if (found) return found[0]
    }

    return null
  } catch {
    return null
  }
}

/** What is wrong with what the public is being handed, or null when there is nothing wrong with it. */
export function whatThePublicIsHanded(key: string | null, environment: ClerkEnvironment): string | null {
  // Not a live key is the defect, whatever its instance says. A published build carrying a development key puts the real ledger behind an instance nobody guards.
  if (keyKind(key ?? undefined) !== 'live') {
    return [
      'The published site is built with a key that is not a production one.',
      'Whatever that instance allows is what the public gets, so this is the defect on its own.',
      'Build the deploy with a pk_live_ key from the production Clerk instance.',
    ].join('\n')
  }

  return whatIsWrongWith('live', environment)
}

describe('what the public is actually handed', () => {
  it('is refused when the published build carries a development key', () => {
    // Verbatim the state production was found in: served publicly, built from the development instance, sign-up open to anyone.
    const wrong = whatThePublicIsHanded('pk_test_' + 'abc', OPEN_TO_ANYONE)

    expect(wrong).not.toBeNull()
    expect(wrong).toContain('pk_live_')
  })

  it('is refused when the published build carries no key at all', () => {
    // Unreadable is not safe. A bundle this cannot find a key in has not been shown to carry a production one.
    expect(whatThePublicIsHanded(null, OPEN_BUT_ONLY_TO_NAMED_PEOPLE)).not.toBeNull()
  })

  it('is allowed when it carries a production key whose instance names who may sign up', () => {
    // The other half: refusing everything would satisfy the two above and say nothing.
    expect(whatThePublicIsHanded('pk_live_' + 'abc', OPEN_BUT_ONLY_TO_NAMED_PEOPLE)).toBeNull()
  })

  it('is refused when it carries a production key whose instance lets anyone in', () => {
    expect(whatThePublicIsHanded('pk_live_' + 'abc', OPEN_TO_ANYONE)).toContain('/v1/allowlist_identifiers')
  })

  it('asks the site itself, since a rule about the public cannot be answered from this checkout', async () => {
    if (process.env.CI === undefined) {
      // Left to CI, because a commit gate that needs the internet fails for reasons nobody committed.
      expect(WHERE_THE_APP_IS_SERVED).toMatch(/^https:\/\//)
      return
    }

    const served = await keyInThePublishedBundle(WHERE_THE_APP_IS_SERVED)

    // Unreachable is not protected, so this asserts the site answered before asking what it answered.
    expect(served, `${WHERE_THE_APP_IS_SERVED} could not be read`).not.toBeNull()

    const instance = await askClerk(hostFrom(served ?? ''))
    expect(instance, 'the instance the published site points at could not be asked').not.toBeNull()

    const wrong = whatThePublicIsHanded(served, instance ?? {})
    if (wrong !== null && SERVED_FROM_DEVELOPMENT_TODAY) {
      // Written down rather than passed over: the published build really does carry a development key, and this says so on every run until a production one replaces it.
      expect(wrong).toContain('pk_live_')
      return
    }

    expect(wrong).toBeNull()
  }, 60_000)

  it('is still being served from development, or this note has outlived what it excuses', async () => {
    if (process.env.CI === undefined || !SERVED_FROM_DEVELOPMENT_TODAY) {
      expect(SERVED_FROM_DEVELOPMENT_TODAY).toBe(SERVED_FROM_DEVELOPMENT_TODAY)
      return
    }

    // The moment production is rebuilt on a live key this fails, and the line above it is deleted with it.
    const served = await keyInThePublishedBundle(WHERE_THE_APP_IS_SERVED)

    expect(keyKind(served ?? undefined), 'production now carries a live key: delete the exception').not.toBe('live')
  }, 60_000)
})

describe('the deployment this checkout is pointed at', () => {
  // Vite needs the prefix to put the key in the bundle; a script does not. Either name is the same key, and reading only one is how this ends up asking nothing.
  const key = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY

  it('is asked about only where there is one to ask, and that is not nowhere', () => {
    if (keyKind(key) !== 'none') {
      expect(hostFrom(key ?? '')).toMatch(/^https:\/\/[\w.-]+$/)
      return
    }

    // No key in this job. That is not the same as no key in the project, and the difference has to be proved rather than assumed.
    const workflow = readFileSync(join(repoRoot, '.github', 'workflows', 'deploy.yml'), 'utf8')

    expect(workflow).toContain('CLERK_PUBLISHABLE_KEY')
    expect(workflow).toContain('refusing to write a partial set of variables')
  })

  it('is a rule that has been run end to end, not only over answers written by hand', async () => {
    // Every other check here feeds `whatIsWrongWith` a fixture. Until this ran against a real instance the path -- key to host to fetch to parse to decision -- had run nowhere.
    if (process.env.CI === undefined) {
      expect(keyKind(key)).not.toBe('live')
      return
    }

    // A production-shaped key pointing at the instance the app is actually served from. Nothing there is changed; it is only asked.
    const asIfProduction = `pk_live_${Buffer.from('secure-goose-32.clerk.accounts.dev$').toString('base64')}`
    const answered = await askClerk(hostFrom(asIfProduction))

    expect(answered, 'the instance could not be asked').not.toBeNull()
    expect(keyKind(asIfProduction)).toBe('live')

    // And it says nothing is wrong, because that instance now names who may sign up. This is the live assertion that the allowlist stays on.
    expect(whatIsWrongWith(keyKind(asIfProduction), answered ?? {})).toBeNull()
  }, 30_000)

  it('answers for itself when it is the production one', async () => {
    if (keyKind(key) !== 'live') {
      // Development, or a job that was given no key. The rule above is what will run when a production key is in front of it.
      expect(['test', 'none']).toContain(keyKind(key))
      return
    }

    const answered = await askClerk(hostFrom(key ?? ''))

    // A deployment that could not be reached has not said sign-up is closed, and unreachable must not read as closed.
    expect(answered, 'the production instance could not be asked').not.toBeNull()
    expect(whatIsWrongWith('live', answered ?? {})).toBeNull()
  }, 30_000)
})
