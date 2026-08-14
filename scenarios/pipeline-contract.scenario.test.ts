import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Two pieces of the pipeline that decide whether what ships is the thing that
 * was checked. Both fail without failing anything.
 *
 *   - The address of the backend is read out of the production deploy key and
 *     compiled into the frontend bundle. Nothing downstream looks at it again.
 *     A wrong one builds, deploys and passes every check while the app in
 *     front of a person reaches nothing at all.
 *
 *   - `yarn typecheck` is the only step that reads the types. `vite build`
 *     strips them without checking, and the tests exercise a handful of paths
 *     rather than every signature. If it does not cover the backend then a
 *     type error there survives format, lint, typecheck, build, test and
 *     scenario, and first appears at `npx convex deploy` — on main, after the
 *     pull request has merged.
 */

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

type Outcome = { status: number; output: string }

function run(command: string, args: Array<string>, env: NodeJS.ProcessEnv = {}): Outcome {
  try {
    const output = execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, output }
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string }
    return {
      status: failure.status ?? -1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    }
  }
}

describe('the address the frontend is built to reach', () => {
  function addressFor(deployKey: string): Outcome {
    return run('bash', ['scripts/convexUrl.sh'], { CONVEX_DEPLOY_KEY: deployKey })
  }

  it('reads the deployment out of a production key', () => {
    const result = addressFor('prod:handsome-ferret-39|notarealsecret')

    expect(result.status).toBe(0)
    expect(result.output.trim()).toBe('https://handsome-ferret-39.convex.cloud')
  })

  it('refuses a project key rather than building a host that does not exist', () => {
    // `npx convex deploy` accepts this shape and deploys the backend with it
    // perfectly well, which is what makes it dangerous: the deploy goes green
    // and the bundle is built pointing at the project's name instead of the
    // deployment's. Rotating the key to a project-scoped one is an ordinary
    // thing to do and would have taken production down silently.
    const result = addressFor('project:saad-nauman:construction|notarealsecret')

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('production deployment')
  })

  it.each([
    ['a preview key', 'preview:saad-nauman:construction|notarealsecret'],
    ['nothing at all', ''],
    ['a key with no deployment in it', 'prod:|notarealsecret'],
    ['a key that carries no secret', 'prod:handsome-ferret-39'],
  ])('refuses %s', (_shape, deployKey) => {
    const result = addressFor(deployKey)

    expect(result.status).not.toBe(0)
    expect(result.output).not.toContain('convex.cloud')
  })
})

describe('the check that reads the types', () => {
  const canary = join(repoRoot, 'convex', 'typecheckCanary.ts')

  it('covers the backend, not only the frontend', () => {
    // A canary rather than a reading of the tsconfig files, because the
    // question is what the command actually does. The root project referenced
    // only the frontend and the build configs, so this exact file passed
    // `yarn typecheck` cleanly while `tsc --project convex` rejected it.
    //
    // The clean case needs no separate run here: `yarn typecheck` is a step of
    // its own in both the hook and CI, and this suite runs after it.
    writeFileSync(canary, 'export const canary: number = "definitely not a number"\n')

    try {
      const result = run('yarn', ['typecheck'])

      expect(result.status).not.toBe(0)
      // Named specifically, so a failure for some unrelated reason cannot be
      // mistaken for this check doing its job.
      expect(result.output).toContain('typecheckCanary')
      expect(result.output).toContain('TS2322')
    } finally {
      rmSync(canary, { force: true })
    }
  }, 180_000)
})
