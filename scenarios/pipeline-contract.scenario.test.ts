import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { type WorkflowJob, jobsIn, readWorkflow } from './workflowFile'

/**
 * Pieces of the pipeline that decide whether what ships is the thing that was
 * checked. All of them fail without failing anything.
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
 *
 *   - The order the jobs of the deploy workflow run in. Every one of them can
 *     go green while shipping the wrong thing: a frontend put live ahead of the
 *     backend it calls, a fix to the address the bundle is built with that
 *     never reaches production, two runs writing to the same deployment at
 *     once.
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

describe('the Clerk address the deployment is given', () => {
  const CLERK_HOST = 'clerk.example.com'

  /**
   * Assembled rather than written out. A publishable key with a real payload is
   * long enough to match the credential shape the hygiene suite reads git
   * history for, and that check would be right to flag it — it cannot tell a
   * fixture from the real thing, and a version that tried to would be worth
   * much less.
   */
  const publishableKey = `pk_test_${Buffer.from(`${CLERK_HOST}$`).toString('base64')}`

  function addressFor(key: string): Outcome {
    return run('bash', ['scripts/clerkFrontendApiUrl.sh'], { CLERK_PUBLISHABLE_KEY: key })
  }

  it('reads the host out of a publishable key', () => {
    // The control, and the case that has to keep working: two refusals on their
    // own would pass just as well against a script that refused everything.
    const result = addressFor(publishableKey)

    expect(result.status).toBe(0)
    expect(result.output.trim()).toBe(`https://${CLERK_HOST}`)
  })

  it('refuses an empty key rather than calling the deployment https://', () => {
    // Inline in the workflow every step of this derivation succeeded on an
    // empty string — the prefix strip, the padding loop, the decode, and the
    // round-trip check comparing "" against "". The caller then put the scheme
    // in front of nothing and wrote those eight characters to the production
    // deployment as the issuer every Clerk token is checked against.
    const result = addressFor('')

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('CLERK_PUBLISHABLE_KEY')
    expect(result.output).not.toContain('https://')
  })

  it('refuses a key whose payload is not a hostname', () => {
    const result = addressFor('pk_test_bm9uc2Vuc2U')

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('not a hostname')
  })

  it.each([
    ['a key with no recognisable prefix', 'not_a_clerk_key'],
    ['a payload that does not survive a decode', 'pk_test_bm9uc2Vuc2U='],
  ])('refuses %s', (_shape, key) => {
    const result = addressFor(key)

    expect(result.status).not.toBe(0)
    expect(result.output).not.toContain('https://')
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

describe('the port the dev server takes back', () => {
  // High enough to be nobody's default, and asserted free before it is used.
  const port = 45871
  const marker = join(tmpdir(), 'construction-reclaim-port.marker')

  function holderOf(): string {
    return run('bash', ['-c', `lsof -ti:${port} || true`]).output.trim()
  }

  async function until(condition: () => boolean): Promise<boolean> {
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
      if (condition()) {
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    return false
  }

  /**
   * A listener on the port. By default it writes a marker from its TERM
   * handler, which is impossible under `kill -9`; `stubborn` makes it swallow
   * TERM instead, which is the case the escalation exists for.
   */
  function startVictim(stubborn = false): number {
    const onTerm = stubborn
      ? '() => {}'
      : `() => { require('fs').writeFileSync(${JSON.stringify(marker)}, 'terminated'); process.exit(0) }`

    const child = spawn(
      process.execPath,
      ['-e', `require('net').createServer().listen(${port}, '127.0.0.1'); process.on('SIGTERM', ${onTerm})`],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()

    if (child.pid === undefined) {
      throw new Error('the victim process did not start')
    }
    return child.pid
  }

  afterEach(() => {
    const holder = holderOf()
    if (holder.length > 0) {
      run('bash', ['-c', `kill -9 ${holder.split('\n').join(' ')} 2>/dev/null || true`])
    }
    rmSync(marker, { force: true })
  })

  it('names what it is about to stop, and lets it stop cleanly', async () => {
    expect(holderOf()).toBe('')
    const pid = startVictim()
    expect(await until(() => holderOf().length > 0)).toBe(true)

    const result = run('bash', ['scripts/reclaimPort.sh', String(port)])

    expect(result.status).toBe(0)
    // Destroying a process without saying which one is the whole complaint:
    // `2>/dev/null || true` meant the banner printed as though it were a clean
    // start, whatever had just been killed.
    expect(result.output).toContain(String(pid))
    // The marker exists only if TERM was delivered and the handler got to run.
    expect(await until(() => existsSync(marker))).toBe(true)
    expect(await until(() => holderOf() === '')).toBe(true)
  })

  it('kills what will not stop, and names that too', async () => {
    expect(holderOf()).toBe('')
    const pid = startVictim(true)
    expect(await until(() => holderOf().length > 0)).toBe(true)

    const result = run('bash', ['scripts/reclaimPort.sh', String(port)])

    expect(result.status).toBe(0)
    expect(result.output).toContain('KILL')
    expect(result.output).toContain(String(pid))
    expect(await until(() => holderOf() === '')).toBe(true)
    // TERM was ignored, so the handler never wrote anything.
    expect(existsSync(marker)).toBe(false)
  })

  it('says nothing when nobody is on the port', async () => {
    expect(holderOf()).toBe('')

    const result = run('bash', ['scripts/reclaimPort.sh', String(port)])

    expect(result.status).toBe(0)
    expect(result.output.trim()).toBe('')
    await Promise.resolve()
  })

  it('is what the dev server uses', () => {
    // Otherwise the script above is correct and unreached, and port 3000 is
    // still being cleared with a SIGKILL nobody is told about.
    const dev = readFileSync(join(repoRoot, 'scripts', 'dev.sh'), 'utf8')

    expect(dev).toContain('reclaimPort.sh')
    expect(dev).not.toContain('kill -9')
  })
})

describe('the shape of the deploy workflow', () => {
  const workflow = readWorkflow(repoRoot, 'deploy.yml')
  const jobs = jobsIn(workflow)

  function job(name: string): WorkflowJob {
    const found = jobs.find((candidate) => candidate.name === name)
    if (!found) {
      // Named rather than left to propagate as `undefined`: a renamed job has
      // to fail here, saying which name went missing, rather than three
      // assertions later on a property of nothing.
      throw new Error(`deploy.yml has no job named ${name}`)
    }
    return found
  }

  it('gives the scenario suite the history it asks about', () => {
    const test = job('test')

    // The control. This really is the job running the suite that reads git
    // history, so the assertion below is about the checkout that suite gets.
    expect(test.runs.join('\n')).toContain('yarn test:scenario')

    // Without it the clone is one grafted commit, and every check asking what
    // this repository has ever committed answers with the working tree.
    expect(test.body).toContain('fetch-depth: 0')
  })

  it('only deploys a frontend it has the artifact for', () => {
    const frontend = job('deploy-frontend')
    const build = job('build')

    expect(frontend.body).toContain('wrangler-action')

    // deploy-frontend publishes what build uploaded, and nothing else produces
    // that artifact. Without the edge the download races the upload and the
    // deploy fails on an artifact that does not exist yet.
    expect(frontend.needs).toContain('build')
    expect(build.body).toContain('name: frontend-build')
    expect(frontend.body).toContain('name: frontend-build')

    // build only uploads on a push, so a deploy that could run on anything else
    // would be downloading nothing. Both sides of that pairing are asserted
    // rather than assumed.
    expect(build.body).toContain("if: github.event_name == 'push'")
    expect(frontend.condition).toContain("github.event_name == 'push'")
  })

  it('queues runs against the same branch rather than overlapping them', () => {
    // The needs edge orders sync-secrets before deploy-backend within one run.
    // Nothing stops the next run's `convex env set` landing on the deployment
    // while this run's `convex deploy` is still in flight.
    expect(workflow).toMatch(/^concurrency:$/m)
    expect(workflow).toMatch(/^ {2}group:/m)
  })

  it('rebuilds the frontend when the script that addresses the backend changes', () => {
    const lines = job('detect-changes').runs.join('\n').split('\n')
    const frontendMatcher = lines.filter((line) => line.includes("changed_matches '^frontend/'"))
    const backendMatcher = lines.filter((line) => line.includes("changed_matches '^convex/'"))

    // The controls. Both matchers were found, so neither assertion below is
    // being made about an empty list.
    expect(frontendMatcher).toHaveLength(1)
    expect(backendMatcher).toHaveLength(1)

    // scripts/convexUrl.sh is the sole producer of the address compiled into
    // the bundle. A commit fixing it reported frontend=false, skipped the
    // deploy, and left production on the old address with every job green.
    expect(frontendMatcher[0]).toContain("changed_matches '^scripts/'")
    // `convex deploy` reads nothing from scripts/, so matching it there would
    // only ever deploy a backend that cannot have changed.
    expect(backendMatcher[0]).not.toContain('^scripts/')
  })

  it('generates the Convex types once and hands them to the jobs that read them', () => {
    const codegen = jobs.filter((candidate) => candidate.runs.some((step) => step.includes('npx convex codegen')))

    // Both the control and the point of the job. Codegen used to be a step
    // inside lint, build and test, uploading the function definitions to the
    // deployment three times a run. A reader that stopped seeing run steps
    // fails here on an empty list rather than passing with nothing to check.
    expect(codegen.map(({ name }) => name)).toEqual(['convex-codegen'])

    // `npx convex codegen` is not a local operation. With a deploy key in scope
    // it uploads the function definitions and validates convex/auth.config.ts
    // against the deployment's own environment. The variable that file reads is
    // written by sync-secrets, so running codegen first dies on state nothing
    // in this file makes visible.
    expect(codegen[0].needs).toContain('sync-secrets')
    expect(codegen[0].body).toContain('name: convex-generated')

    // convex/_generated/ is gitignored, so a job that reads it without waiting
    // for the artifact fails on a missing module — the same class of invisible
    // dependency, one step further down.
    for (const name of ['lint', 'typecheck', 'test']) {
      expect(job(name).needs).toContain('convex-codegen')
      expect(job(name).body).toContain('name: convex-generated')
    }
  })

  it('runs every job on one Node, and on a version that still gets fixes', () => {
    const declared = /^ {2}NODE_VERSION: '(\d+)\.\d+\.\d+'$/m.exec(workflow)

    // The control. Everything below reads this capture, so a renamed or
    // reformatted variable has to fail here rather than silently skip.
    expect(declared).not.toBeNull()

    // Node ships long-term support on even majors only. An odd one is a Current
    // release: it stops getting fixes when the next major opens, which is not
    // something to find out from a runner.
    expect(Number(declared![1]) % 2).toBe(0)

    // One declaration, read everywhere. A job pinning its own version is how a
    // pipeline ends up running two runtimes and nobody notices.
    const pins = workflow.match(/^ +node-version: .*$/gm) ?? []
    expect(pins.length).toBeGreaterThanOrEqual(6)
    expect(pins.every((pin) => pin.includes('${{ env.NODE_VERSION }}'))).toBe(true)

    // setup-node v4 runs its own code on Node 20, which the runners have
    // deprecated and now force onto 24 with a warning on every job.
    const setupNode = workflow.match(/actions\/setup-node@v\d+/g) ?? []
    expect(setupNode.length).toBe(pins.length)
    expect([...new Set(setupNode)]).toEqual(['actions/setup-node@v5'])

    // The one behaviour v5 changed: it caches the package manager by default,
    // where v4 did not. The probe runs `yarn cache dir` with the Yarn 1.22.22
    // shim inside Node, before `corepack enable`, and Yarn 1 refuses a project
    // declaring `packageManager: yarn@4.13.0`. Every job died six seconds in,
    // reading as a Yarn version problem rather than an action default.
    const cacheOff = workflow.match(/^ +package-manager-cache: false/gm) ?? []
    expect(cacheOff.length).toBe(setupNode.length)
  })

  it('writes the deployment variables on a pull request too, not only on a push', () => {
    // The three jobs above cannot pass until this one has run, so gating it on
    // `push` meant a pull request could first go green after it had merged.
    expect(job('sync-secrets').condition ?? '').not.toContain("github.event_name == 'push'")

    // The control: conditions are being read at all, and the jobs that really
    // are push-only still say so.
    expect(job('detect-changes').condition).toContain("github.event_name == 'push'")
  })

  it('still fails fast on formatting', () => {
    // format runs no codegen, so making it wait would only put the cheapest
    // check in the pipeline behind a write to the deployment.
    expect(job('format').needs).toEqual([])
  })
})
