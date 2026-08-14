import { describe, expect, it } from 'vitest'

import { convexUrl } from './convexUrl'

const accepts = (value: string) => convexUrl.safeParse(value).success

describe('the address the app is told to talk to', () => {
  describe('addresses a mis-derived deployment key actually produces', () => {
    // Each of these is what VITE_CONVEX_URL becomes when a deploy key of an
    // unexpected shape is parsed for its deployment name. They all parse as
    // URLs, which is why a plain url() check let them through, and none of
    // them resolves to anything.
    it.each([
      ['a key whose name half was empty', 'https://.convex.cloud'],
      ['a project key, which has no deployment name', 'https://construction'],
      ['nothing derived at all', 'https://.convex.cloud/'],
    ])('refuses %s', (_case, value) => {
      expect(accepts(value)).toBe(false)
    })
  })

  it('refuses an address pointing somewhere that is not Convex', () => {
    // A copy-paste of the wrong URL should stop the app, not send every
    // query for the family's accounts to a third party.
    expect(accepts('https://evil.example.com')).toBe(false)
  })

  it('refuses an empty value, which is what an unset variable looks like', () => {
    expect(accepts('')).toBe(false)
  })

  it('accepts the deployments this project actually uses', () => {
    expect(accepts('https://handsome-ferret-39.convex.cloud')).toBe(true)
    expect(accepts('https://dapper-crab-709.convex.cloud')).toBe(true)
  })

  it('accepts a backend running on this machine', () => {
    expect(accepts('http://localhost:3210')).toBe(true)
    expect(accepts('http://127.0.0.1:3210')).toBe(true)
  })

  it('says what to do rather than naming a type', () => {
    const result = convexUrl.safeParse('https://.convex.cloud')
    expect(result.success).toBe(false)
    if (result.success) return

    const message = result.error.issues[0]?.message ?? ''
    expect(message).toContain('VITE_CONVEX_URL')
    // The person reading this is not a developer. "Invalid url" tells them
    // nothing they can act on.
    expect(message).not.toMatch(/invalid|expected|received|string/i)
  })
})
