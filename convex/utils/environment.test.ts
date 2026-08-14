import { describe, expect, it } from 'vitest'

// No `@vitest-environment` docblock on purpose, and this is the half that fails quietly: a Convex test landing in Node still passes.
describe('a Convex test that does not ask for an environment', () => {
  it('gets the edge runtime anyway', () => {
    expect('EdgeRuntime' in globalThis).toBe(true)
  })
})
