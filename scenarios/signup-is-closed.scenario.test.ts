import { describe, expect, it } from 'vitest'

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

describe('the deployment this checkout is pointed at', () => {
  const key = process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY

  it('is named by its own key, so this cannot be asked of the wrong one', () => {
    // Vite needs the prefix to put it in the bundle; a script does not. Either name is the same key, and reading only one of them is how this ends up asking nothing.
    expect(keyKind(key)).not.toBe('none')
    expect(hostFrom(key ?? '')).toMatch(/^https:\/\/[\w.-]+$/)
  })

  it('answers for itself when it is the production one', async () => {
    if (keyKind(key) !== 'live') {
      // Development, and open on purpose. The rule above is what will run when a production key is in front of it.
      expect(keyKind(key)).toBe('test')
      return
    }

    const answered = await askClerk(hostFrom(key ?? ''))

    // A deployment that could not be reached has not said sign-up is closed, and unreachable must not read as closed.
    expect(answered, 'the production instance could not be asked').not.toBeNull()
    expect(whatIsWrongWith('live', answered ?? {})).toBeNull()
  }, 30_000)
})
