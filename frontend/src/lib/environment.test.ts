import { describe, expect, it } from 'vitest'

/**
 * Deliberately carries no `@vitest-environment` docblock.
 *
 * Every other frontend test names its own environment, so the config could
 * stop choosing one without anything failing. A test written without the
 * docblock — which is the ordinary way to write one — would then run in Node
 * and fall over on `document`, and the author would reach for the docblock
 * rather than notice the config had stopped working.
 *
 * The mirror of this file lives at convex/utils/environment.test.ts, where the
 * same drift is quieter still: a Convex test that lands in Node passes.
 */
describe('a frontend test that does not ask for an environment', () => {
  it('gets a browser anyway', () => {
    expect(typeof document).not.toBe('undefined')
    expect(typeof window).not.toBe('undefined')
  })
})
