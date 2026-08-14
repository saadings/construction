import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Enough of a reader for the questions the scenario suites ask of a workflow
 * file: which jobs there are, what each one waits for, and what each step runs.
 *
 * Line-based rather than a YAML parse, because the repository has no YAML
 * dependency and adding one to answer "does this job wait for that job" is a
 * larger commitment than the question deserves. What it costs is that a parser
 * which stops matching reports an empty workflow, which reads exactly like a
 * clean one — so every suite using this carries a control asserting it found
 * something, the same discipline the rest of these files use.
 */

/** Every workflow file GitHub would read, in the order the directory lists them. */
export function workflowFiles(repoRoot: string): Array<{ name: string; text: string }> {
  const directory = join(repoRoot, '.github', 'workflows')

  return readdirSync(directory)
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(directory, name), 'utf8') }))
}

export function readWorkflow(repoRoot: string, name: string): string {
  return readFileSync(join(repoRoot, '.github', 'workflows', name), 'utf8')
}

export type WorkflowJob = {
  name: string
  /** Every line of the job, its header included. */
  body: string
  /** The job names in the job's own `needs:`. Empty when it has none. */
  needs: Array<string>
  /** The job's own `if:`, never a step's. */
  condition: string | undefined
  /** What each `run:` step runs, block scalars flattened into one string. */
  runs: Array<string>
}

/**
 * The jobs of a workflow, each sliced from its `  <name>:` header to the next
 * thing at that indentation — the next job, a comment between jobs, or a
 * top-level key.
 */
export function jobsIn(text: string): Array<WorkflowJob> {
  const lines = text.split('\n')
  const jobs: Array<{ name: string; lines: Array<string> }> = []

  let insideJobs = false
  let current: { name: string; lines: Array<string> } | undefined

  for (const line of lines) {
    if (/^jobs:/.test(line)) {
      insideJobs = true
      continue
    }
    if (!insideJobs) {
      continue
    }
    if (/^\S/.test(line)) {
      // A key back at the top level ends the jobs block entirely.
      insideJobs = false
      current = undefined
      continue
    }

    const header = /^ {2}([A-Za-z0-9_-]+):[ \t]*$/.exec(line)
    if (header) {
      current = { name: header[1], lines: [line] }
      jobs.push(current)
      continue
    }
    if (/^ {2}\S/.test(line)) {
      // A comment or another key at job depth — whatever it is, the job before
      // it has ended.
      current = undefined
      continue
    }

    current?.lines.push(line)
  }

  return jobs.map(({ name, lines: body }) => {
    const text = body.join('\n')
    return {
      name,
      body: text,
      needs: needsIn(text),
      condition: /^ {4}if:[ \t]*(.*)$/m.exec(text)?.[1].trim(),
      runs: runStepsIn(text),
    }
  })
}

/** The job names a job's own `needs:` lists, inline or block form. */
function needsIn(body: string): Array<string> {
  const lines = body.split('\n')
  const index = lines.findIndex((line) => /^ {4}needs:/.test(line))
  if (index === -1) {
    return []
  }

  const inline = /^ {4}needs:[ \t]*(.*)$/.exec(lines[index])?.[1].trim() ?? ''
  if (inline.startsWith('[')) {
    return splitNames(inline.replace(/^\[/, '').replace(/\]$/, ''))
  }
  if (inline.length > 0) {
    return splitNames(inline)
  }

  // The block form, which this file does not currently use. Reading it anyway
  // so that rewriting `needs:` into a list cannot make a check that asks what a
  // job waits for pass by finding nothing.
  const block: Array<string> = []
  for (const line of lines.slice(index + 1)) {
    const entry = /^ {4,}-[ \t]+(.*)$/.exec(line)
    if (!entry) {
      break
    }
    block.push(entry[1].trim())
  }
  return block
}

function splitNames(list: string): Array<string> {
  return list
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
}

/** What every `run:` step in the given text runs, block scalars flattened. */
export function runStepsIn(text: string): Array<string> {
  const lines = text.split('\n')
  const steps: Array<string> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const header = /^(\s*(?:-[ \t]+)?)run:[ \t]*(.*)$/.exec(line)
    if (!header) {
      continue
    }

    const keyIndent = header[1].length
    const value = header[2].trim()
    if (!/^[|>][+-]?$/.test(value)) {
      steps.push(value)
      continue
    }

    const block: Array<string> = []
    while (index + 1 < lines.length) {
      const next = lines[index + 1]
      const indent = next.length - next.replace(/^\s*/, '').length
      if (next.trim().length > 0 && indent <= keyIndent) {
        break
      }
      block.push(next)
      index += 1
    }
    steps.push(block.join('\n'))
  }

  return steps
}
