import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type WorkflowJob, jobsIn, readWorkflow, stepsIn } from './workflowFile'

// The pieces deciding whether what ships is what was checked — the compiled-in backend address, the only step reading types, and job order — all of which fail without failing anything.

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
    // `npx convex deploy` accepts this shape happily, so the deploy goes green while the bundle points at the project's name.
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

  // Assembled, not written out: a real payload matches the credential shape the hygiene suite reads history for, and it cannot tell a fixture apart.
  const publishableKey = `pk_test_${Buffer.from(`${CLERK_HOST}$`).toString('base64')}`

  function addressFor(key: string): Outcome {
    return run('bash', ['scripts/clerkFrontendApiUrl.sh'], { CLERK_PUBLISHABLE_KEY: key })
  }

  it('reads the host out of a publishable key', () => {
    // The control: two refusals on their own pass just as well against a script that refuses everything.
    const result = addressFor(publishableKey)

    expect(result.status).toBe(0)
    expect(result.output.trim()).toBe(`https://${CLERK_HOST}`)
  })

  it('refuses an empty key rather than calling the deployment https://', () => {
    // Inline in the workflow every step succeeded on an empty string, and `https://` was written to production as the issuer.
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
    // A canary, not a reading of the tsconfig files: this exact file once passed `yarn typecheck` while `tsc --project convex` rejected it.
    writeFileSync(canary, 'export const canary: number = "definitely not a number"\n')

    try {
      const result = run('yarn', ['typecheck'])

      expect(result.status).not.toBe(0)
      // Named specifically, so an unrelated failure cannot be mistaken for this check doing its job.
      expect(result.output).toContain('typecheckCanary')
      expect(result.output).toContain('TS2322')
    } finally {
      rmSync(canary, { force: true })
    }
  }, 180_000)
})

describe('the port the dev server takes back', () => {
  // A port is machine-wide, so a fixed one makes two concurrent runs of this suite fight: each sees the other's victim and reads it as its own.
  let port = 0
  // Named after the run that made it, for the same reason.
  const marker = join(tmpdir(), `construction-reclaim-port-${process.pid}.marker`)

  /** A port the kernel says is free, taken and released so the victim can bind it a moment later. */
  async function unusedPort(): Promise<number> {
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('the kernel did not hand back a numbered port')
    }
    const chosen = address.port
    await new Promise<void>((resolve) => server.close(() => resolve()))
    return chosen
  }

  beforeEach(async () => {
    port = await unusedPort()
  })

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

  // A listener that marks its own TERM handler, which `kill -9` makes impossible; `stubborn` swallows TERM, the case escalation exists for.
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

  afterEach(async () => {
    const holder = holderOf()
    if (holder.length > 0) {
      run('bash', ['-c', `kill -9 ${holder.split('\n').join(' ')} 2>/dev/null || true`])
      // `kill` returns before the kernel releases the socket, and every test here opens by asserting the port is free.
      expect(await until(() => holderOf() === '')).toBe(true)
    }
    rmSync(marker, { force: true })
  })

  it('names what it is about to stop, and lets it stop cleanly', async () => {
    expect(holderOf()).toBe('')
    const pid = startVictim()
    expect(await until(() => holderOf().length > 0)).toBe(true)

    const result = run('bash', ['scripts/reclaimPort.sh', String(port)])

    expect(result.status).toBe(0)
    // Destroying a process without saying which one is the whole complaint: the banner printed as though it were a clean start.
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

  it('is a different port for every test, so a second run of this suite is not fighting the first', async () => {
    // The control. Sharing one port made a concurrent run's victim visible here as this run's own, which reads exactly like the script misbehaving.
    const seen = new Set<number>([port, await unusedPort(), await unusedPort()])

    expect(port).toBeGreaterThan(0)
    expect(seen.size).toBe(3)
  })

  it('is what the dev server uses', () => {
    // Otherwise the script above is correct and unreached, and port 3000 is still cleared with a SIGKILL nobody is told about.
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
      // Named rather than left to propagate as `undefined`, so a renamed job fails here saying which name went missing.
      throw new Error(`deploy.yml has no job named ${name}`)
    }
    return found
  }

  it('gives the scenario suite the history it asks about', () => {
    const checks = job('checks')

    // The control: this really is the job running the suite that reads git history.
    expect(checks.runs.join('\n')).toContain('yarn test:scenario')

    // Without it the clone is one grafted commit, and every history check answers with the working tree.
    expect(checks.body).toContain('fetch-depth: 0')
  })

  it('only deploys a frontend it has the artifact for', () => {
    const frontend = job('deploy-frontend')
    const checks = job('checks')

    expect(frontend.body).toContain('wrangler-action')

    // deploy-frontend publishes what the build step uploaded, and without the edge the download races the upload.
    expect(frontend.needs).toContain('checks')
    expect(checks.body).toContain('name: frontend-build')
    expect(frontend.body).toContain('name: frontend-build')

    // The upload only happens on a push, so both sides of that pairing are asserted rather than assumed.
    const uploading = stepsIn(checks.body).find((step) => step.body.includes('name: frontend-build'))
    expect(uploading?.condition).toBe("github.event_name == 'push'")
    expect(frontend.condition).toContain("github.event_name == 'push'")
  })

  it('queues runs against the same branch rather than overlapping them', () => {
    // The needs edge orders one run; nothing stops the next run's `convex env set` landing mid-deploy.
    expect(workflow).toMatch(/^concurrency:$/m)
    expect(workflow).toMatch(/^ {2}group:/m)
  })

  it('rebuilds the frontend when the script that addresses the backend changes', () => {
    const lines = job('detect-changes').runs.join('\n').split('\n')
    const frontendMatcher = lines.filter((line) => line.includes("changed_matches '^frontend/'"))
    const backendMatcher = lines.filter((line) => line.includes("changed_matches '^convex/'"))

    // The controls: both matchers were found, so neither assertion below is made about an empty list.
    expect(frontendMatcher).toHaveLength(1)
    expect(backendMatcher).toHaveLength(1)

    // convexUrl.sh produces the address compiled into the bundle, and a commit fixing it once reported frontend=false with every job green.
    expect(frontendMatcher[0]).toContain("changed_matches '^scripts/'")
    // `convex deploy` reads nothing from scripts/, so matching it there deploys a backend that cannot have changed.
    expect(backendMatcher[0]).not.toContain('^scripts/')
  })

  it('generates the Convex types once, before every step that reads them', () => {
    // The seven jobs this replaced expressed the same graph as `needs:`; in one job it is step order, which is a fact about a list and has to be asserted as one.
    const steps = stepsIn(job('checks').body)
    const at = (needle: string): number => steps.findIndex((step) => step.body.includes(needle))

    const codegen = at('npx convex codegen')
    const readers = ['yarn lint:check', 'yarn typecheck', 'yarn build', 'yarn test'].map((step) => ({
      step,
      index: at(step),
    }))

    // Absence asserted before order, because `findIndex` answers -1 for a step that is gone and -1 comes before everything.
    expect(codegen).toBeGreaterThan(-1)
    for (const reader of readers) {
      expect(reader.index, `${reader.step} is not in the checks job at all`).toBeGreaterThan(-1)
      expect(codegen, `${reader.step} runs before codegen`).toBeLessThan(reader.index)
    }

    // Codegen is not local: it validates auth.config.ts against the deployment, on a variable only the secrets step writes.
    expect(at('| npx convex env set')).toBeLessThan(codegen)

    // convex/_generated/ is gitignored and codegen writing nothing used to fail three steps later on a missing module.
    expect(at('codegen wrote nothing')).toBeGreaterThan(codegen)
  })

  it('runs every job on one Node, and on a version that still gets fixes', () => {
    const declared = /^ {2}NODE_VERSION: '(\d+)\.\d+\.\d+'$/m.exec(workflow)

    // The control: everything below reads this capture, so a renamed variable fails here rather than silently skipping.
    expect(declared).not.toBeNull()

    // Node ships long-term support on even majors only; an odd one stops getting fixes when the next major opens.
    expect(Number(declared![1]) % 2).toBe(0)

    // One declaration read everywhere: a job pinning its own version is how a pipeline runs two runtimes unnoticed.
    const pins = workflow.match(/^ +node-version: .*$/gm) ?? []
    expect(pins.length).toBeGreaterThanOrEqual(2)
    expect(pins.every((pin) => pin.includes('${{ env.NODE_VERSION }}'))).toBe(true)

    // setup-node v4 runs its own code on Node 20, which the runners deprecated and now force onto 24 with a warning.
    const setupNode = workflow.match(/actions\/setup-node@v\d+/g) ?? []
    expect(setupNode.length).toBe(pins.length)
    expect([...new Set(setupNode)]).toEqual(['actions/setup-node@v5'])

    // The one behaviour v5 changed: its cache probe runs `yarn cache dir` on the Yarn 1 shim before corepack, and every job died six seconds in.
    const cacheOff = workflow.match(/^ +package-manager-cache: false/gm) ?? []
    expect(cacheOff.length).toBe(setupNode.length)
  })

  it('runs on a pull request, because codegen cannot pass until the deployment has its variables', () => {
    // Gating the whole job on `push` meant a pull request first went green after merging: `auth.config.ts` reads CLERK_FRONTEND_API_URL off the deployment, and codegen validates it there.
    expect(job('checks').condition ?? '').not.toContain("github.event_name == 'push'")

    // The control: conditions are read at all, and the jobs that really are push-only still say so.
    expect(job('detect-changes').condition).toContain("github.event_name == 'push'")
  })

  it('writes to the deployment only on a push, and reads on everything else', () => {
    // `npx convex env set` writes to whatever CONVEX_DEPLOY_KEY names, which is production. Running that on a pull request is a deploy nobody reads as one, from a branch nobody has reviewed.
    const steps = stepsIn(job('checks').body)
    // Matched on the invocation, never the phrase: a comment naming a command is attributed to the step above it, and `convex env set` appears in one.
    const writing = steps.filter((step) => step.body.includes('| npx convex env set'))
    const reading = steps.filter((step) => step.body.includes('$(npx convex env get'))

    // The control: both halves are found at all, so a renamed step fails here rather than leaving an empty list to agree with everything.
    expect(writing).toHaveLength(1)
    expect(reading).toHaveLength(1)

    expect(writing[0].condition).toBe("github.event_name == 'push'")
    expect(reading[0].condition).toBe("github.event_name != 'push'")
  })

  it('never prints a variable it is checking, because three of the four are secrets', () => {
    // A job that echoes a secret to prove it is set has published it to anyone who can read a log, and a log outlives the run.
    const reading = stepsIn(job('checks').body).find((step) => step.body.includes('convex env get'))

    expect(reading).toBeDefined()
    // Captured into a shell variable and tested for emptiness; nothing is echoed but the names of what is missing.
    expect(reading?.body).toContain('if [ -z "$(npx convex env get')
    expect(reading?.body).not.toMatch(/echo .*\$\(npx convex env get/)
  })

  it('still fails fast on formatting', () => {
    // Formatting needs no generated types, so putting it after codegen would delay the cheapest failure there is until after a write to production.
    const steps = stepsIn(job('checks').body)
    const at = (needle: string): number => steps.findIndex((step) => step.body.includes(needle))

    const format = at('yarn format:check')
    const touchesTheDeployment = at('npx convex env')

    expect(format).toBeGreaterThan(-1)
    expect(touchesTheDeployment).toBeGreaterThan(-1)
    expect(format).toBeLessThan(touchesTheDeployment)
  })

  it('runs for a pull request whatever branch it targets', () => {
    const pullRequest = triggerBody(workflow, 'pull_request')
    const push = triggerBody(workflow, 'push')

    // Load-bearing controls: a null reading as "no branches filter" is how this test first passed with the filter still in place.
    expect(pullRequest).not.toBeNull()
    expect(push).not.toBeNull()

    // `branches:` here filters the base, so a pull request stacked on another branch got no run at all and read as green.
    expect(pullRequest!.some((line) => line.includes('branches:'))).toBe(false)

    // The second control: push really is still restricted, so the false above means removed rather than never read.
    expect(push!.some((line) => line.includes('branches:'))).toBe(true)
  })

  it('builds the frontend only after the types it imports exist', () => {
    // This skipped codegen on the reading that the bundle imported nothing generated: true when written, held by nothing, red the first time a screen called a query.
    const steps = stepsIn(job('checks').body)
    const at = (needle: string): number => steps.findIndex((step) => step.body.includes(needle))

    const build = at('yarn build')
    const codegen = at('npx convex codegen')

    expect(build).toBeGreaterThan(-1)
    expect(codegen).toBeGreaterThan(-1)
    expect(codegen).toBeLessThan(build)
  })
})

/** The indented lines under a top-level trigger key, or null when the key is absent. */
function triggerBody(text: string, key: string): Array<string> | null {
  const lines = text.split('\n')
  const start = lines.findIndex((line) => line === `  ${key}:`)
  if (start === -1) return null

  const body: Array<string> = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue
    // Anything at this key's own depth or shallower has ended it, which is what stops a sibling trigger being read as its child.
    if (!/^ {4}/.test(line)) break
    body.push(line)
  }

  return body
}
