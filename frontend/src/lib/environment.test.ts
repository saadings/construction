import { describe, expect, it } from 'vitest'

// No `@vitest-environment` docblock on purpose: every other frontend test names its own, so the config could stop choosing one unnoticed.
describe('a frontend test that does not ask for an environment', () => {
  it('gets a browser anyway', () => {
    expect(typeof document).not.toBe('undefined')
    expect(typeof window).not.toBe('undefined')
  })
})
