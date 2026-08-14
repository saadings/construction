import { describe, expect, it } from 'vitest'

/**
 * Deliberately carries no `@vitest-environment` docblock, and this is the half
 * that fails quietly.
 *
 * A frontend test that lands in Node dies on `document`. A Convex test that
 * lands in Node passes — Convex functions run on the edge runtime, and a test
 * exercising them under Node's globals is testing something the deployment
 * never does. It goes green either way, which is why the config choosing the
 * environment has to be checked directly rather than left to the next test to
 * notice.
 */
describe('a Convex test that does not ask for an environment', () => {
  it('gets the edge runtime anyway', () => {
    expect('EdgeRuntime' in globalThis).toBe(true)
  })
})
