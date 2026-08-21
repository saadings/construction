import { execFileSync } from 'node:child_process'

// Every file in this repository that somebody wrote, including the one they wrote a minute ago.

// `git ls-files` lists the index alone, so a brand-new file is invisible to a sweep until it is staged -- and a brand-new file is exactly the one nobody is sure about. It bit twice in one evening: a no-real-people hand-run reported clean on an unstaged file, and the comment rule flagged a tracked hook while missing an untracked script with the identical defect. Written alone, that script would have shipped wrong with a green rule over it.

// `--others` adds what is untracked and `--exclude-standard` keeps the ignore rules, so nothing gitignored is reached. Both flags together or neither: `--others` on its own would sweep `node_modules`.

// NOT FOR EVERY SWEEP. `no-real-people` lists files with a bare `git ls-files` on purpose and asserts these flags are absent, because it prints what it finds and this repository is public -- a version able to reach the workbooks would put an excerpt of a real client's record into a CI log on the day it matched. That guard's blindness is a property rather than a limitation, and it is not a caller of this.
export function everyFileHere(repoRoot: string): Array<string> {
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
  })

  return listed
    .trim()
    .split('\n')
    .filter((path) => path !== '')
}
