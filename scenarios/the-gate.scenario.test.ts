import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { jobsIn, workflowFiles } from './workflowFile'

// What has to pass before a change is pushed, kept as one command rather than as a habit.

// The failure it is written for: `#114` went red on `Take a picture of every screen` after a local run of six checks was reported as green. Nothing was skipped on purpose -- the list somebody had memorised was written when the pipeline had six steps, and the pipeline had nine. A gate is only ever the set somebody wrote down, and this repository grows one every few merges.

// Both ends, because either alone is satisfied by a gate that has drifted: a command in CI and not in the gate is a check nobody runs locally, and a command in the gate and not in CI is a check nothing enforces.

const ROOT = process.cwd()

const GATE: string = (() => {
  const scripts: unknown = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

  if (typeof scripts !== 'object' || scripts === null || !('scripts' in scripts)) {
    throw new Error('package.json has no scripts in it, so this suite is reading nothing.')
  }

  const named = scripts.scripts
  if (typeof named !== 'object' || named === null || !('gate' in named) || typeof named.gate !== 'string') {
    throw new Error('There is no `gate` script. It is what a person runs before pushing.')
  }

  return named.gate
})()

/** Every `yarn <script>` a line runs, which is how both the workflow and the gate say what they do. */
function yarnScriptsIn(text: string): Array<string> {
  return [...text.matchAll(/yarn ([\w:]+)/g)].map((found) => found[1])
}

// `install` is how the runner gets its dependencies rather than a check of anything, and a person running the gate already has them.
const NOT_A_CHECK = new Set(['install'])

// Found by the job's name across every workflow rather than by a filename. The first draft of this read `ci.yml`, which this repository does not have -- the workflow is called `deploy.yml` and the checks live in it. That threw, which is the right way for a wrong assumption to fail, but a name that has to be kept in step with a file is a second thing to keep in step.
function everyJob() {
  return workflowFiles(ROOT).flatMap((file) => jobsIn(file.text))
}

function whatCiRuns(): Array<string> {
  const checks = everyJob().find((job) => job.name === 'checks')

  if (checks === undefined) {
    throw new Error('No workflow has a `checks` job, so there is nothing here to compare the gate against.')
  }

  return [...new Set(yarnScriptsIn(checks.runs.join('\n')))].filter((script) => !NOT_A_CHECK.has(script))
}

describe('the gate', () => {
  it('runs everything the pipeline runs', () => {
    // The end that was actually missed. `yarn shots` was the seventh of nine and the one that mattered.
    const inTheGate = new Set(yarnScriptsIn(GATE))

    expect(whatCiRuns().filter((script) => !inTheGate.has(script))).toEqual([])
  })

  it('runs nothing the pipeline does not', () => {
    // The other end. A gate that grew a step CI never runs is a check that passes locally and enforces nothing, and every green push says it is fine.
    const inCi = new Set(whatCiRuns())

    expect(yarnScriptsIn(GATE).filter((script) => !inCi.has(script))).toEqual([])
  })

  it('is reading a pipeline that really has steps in it', () => {
    // The floor. A regex that stopped matching reports a gate covering every one of nothing.
    const running = whatCiRuns()

    expect(running.length).toBeGreaterThan(6)
    expect(running).toContain('shots')
    expect(running).toContain('test:scenario')
  })

  it('is reading a gate that really has commands in it', () => {
    // The same floor from the other side: an empty gate passes the first check above only if CI is empty too, and passes the second one perfectly.
    expect(yarnScriptsIn(GATE).length).toBeGreaterThan(6)
  })

  it('names nothing as not-a-check that the pipeline has stopped running', () => {
    // An exemption outlives what it was written for, and a stale one silently excuses whatever takes that name next. This is the shape that hid the nav for the whole of this project: an exemption written for one true reason, quietly covering everything beside it.
    const everything = new Set(
      yarnScriptsIn(
        everyJob()
          .map((job) => job.runs.join('\n'))
          .join('\n')
      )
    )

    for (const excused of NOT_A_CHECK) {
      expect(everything, `${excused} is excused from the gate and the pipeline does not run it`).toContain(excused)
    }
  })
})
