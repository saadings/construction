---
trigger: always_on
---

# Comments

A comment is one line. Never two.

## The rule

No run of adjacent comment-only lines may be longer than one line. This holds in
every language in this repository — TypeScript, JavaScript, CSS, YAML, shell —
and in every position: above a statement, above a job, inside a function, at the
top of a file.

A block comment (`/** … */`, `/* … */`) spans multiple lines by construction, so
it is never allowed. Write `//` instead, or write nothing.

```ts
// Good
// Refuses a project key: the host it would build does not exist.
const host = hostFrom(key)
```

```ts
// Bad
// Refuses a project key. A project key names the project, not the deployment,
// so the host built from it does not exist and every request 404s.
const host = hostFrom(key)
```

## What this costs, and what to do about it

The second example carries information the first does not. That is the trade
this rule makes, deliberately, and the way to keep the information is to put it
somewhere a line limit does not apply:

- **A test.** A failure mode worth three lines of comment is worth a test that
  reproduces it. The test name says what breaks; the assertion says how.
- **The commit message.** Unbounded, versioned, and attached to the change that
  needed explaining. `git log -p` and `git blame` both reach it.
- **The pull request body.** For anything spanning several files.
- **`docs/`.** For anything a reader needs before touching the code at all.

Deleting a multi-line comment without moving what it said into one of those is
losing the information, not applying this rule.

## Not comments

These are instructions to tooling, not commentary, and do not count toward the
run length:

- `eslint-disable`, `eslint-disable-next-line`, `eslint-enable`
- `@ts-expect-error`, `@ts-ignore` — both banned by [type-safety](type-safety.md)
  anyway
- `prettier-ignore`, `shellcheck disable`
- `/// <reference …>`
- `@vitest-environment`
- A `#!` shebang on the first line of a file

## Where it does not reach

Generated files, because nobody writes them: `frontend/src/routeTree.gen.ts`,
`convex/_generated/`. Markdown and JSON, because neither has comment syntax —
prose in a `.md` file is the file, not a comment on it.

## The check

`scenarios/comment-length.scenario.test.ts` scans every committed source file
and fails on any run longer than one line, naming the file and the first line of
the run. `eslint` reports the same thing in TypeScript as you type. A rule that
only exists in this file is a rule that decays.
