#!/bin/sh
# Runs something heavy with the machine to itself.

# Two sessions work on this repository at once, in separate worktrees, and neither knows the other exists. When both gate together the machine saturates: measured at a load average of 42, with `userEvent` tests that take one second taking twenty-two, and a failure set that changes on every run while the code does not.

# The cost that matters is not the minutes. A machine wastes minutes; an unreadable failure set wastes a person, and twice in one evening somebody went hunting for a bug in unrelated code because of one. A gate that queues costs the few minutes the other one takes.

# THE NUMBER THIS EXISTS FOR, so nobody removes it as ceremony. `yarn test` is about **251.8 seconds of CPU**, over 68.4 seconds of wall clock -- roughly 3.7 processes flat out, and two gates at once is 7.4 of them on a ten-core machine already carrying other tenants.

# READ THE CPU FIGURE AND DISTRUST THE WALL ONE, because contention adds wall clock and does not add CPU. The seconds of CPU survive a busy machine; the wall time and anything divided by it do not, so 3.7 is a floor on how parallel this is and was measured with other tenants running. Anybody re-timing any of this must do it with nothing else running -- ours or anybody else's -- and take the minimum of several runs, because contention only ever adds.

# It is not that the machine is busy. **Our suite is a four-core job and we were running two.** `test:scenario` by contrast is 30.3s CPU over 18.8s wall: barely parallel, and nearly free.

# And 3.7 processes on ten cores is fine, which is why vitest's worker count is left alone -- capping it would trade wall clock for a problem this already solves.

# It wraps a command rather than guarding one script, because the thing to protect is the processor and not `yarn gate`: the commit hook, a bare `yarn test`, a gallery build and a Playwright run all saturate it. A lock around the one path we happened to be looking at is a guard narrower than its subject.

# sh scripts/oneAtATime.sh yarn gate

# WHAT IS DELIBERATELY NOT WRAPPED, and it is a decision rather than an omission. A single file -- `yarn vitest run <one>` -- takes seconds, and making seconds queue behind a nine-minute gate is how somebody stops using the lock. A gate nobody runs protects nothing, and the same reasoning is why the commit hook is kept cheap enough that nobody reaches for `--no-verify`. The heavy entry points in `package.json` are wrapped; `test:watch` and a bare `vitest` are not.

# WHAT THIS CANNOT DO. It serialises things that ask. A `pkill -f vitest`, a killed terminal, a machine put to sleep -- none of those queue, and a pattern kill in particular reaches runs in other worktrees and other projects, which are indistinguishable from this one from outside. The lock will notice the corpse afterwards and take the stale lock; it cannot prevent the kill.

# ON THE MACHINE-GLOBAL NAME. This repository has a standing rule that tests must not take machine-global names, because two sessions collide on them. **Colliding is the entire purpose here** -- a lock only one session can see locks nothing. The rule is about names taken by accident; this one is taken on purpose and says so.

WHERE=${ONE_AT_A_TIME_LOCK:-/tmp/construction-one-at-a-time.lock}

# Already held by something above this call: a hook that took it and then ran `yarn test`, which would take it again and wait for itself forever. Inherited through the environment, so nesting is free and needs no bookkeeping.
if [ -n "$ONE_AT_A_TIME_HELD" ]; then
  exec "$@"
fi

# A directory rather than a file, because `mkdir` either creates it or fails, in one step. Two sessions that both check-then-write can both pass the check; two that both `mkdir` cannot both succeed.
said=""

# How long a lock may sit with nobody in it before it is believed abandoned rather than half-made. This is not a guess about how long a gate takes -- the empty-lock branch below says why those are different questions.
LONG_ENOUGH_TO_BE_ABANDONED=10
emptyFor=0

while :; do
  if mkdir "$WHERE" 2>/dev/null; then
    break
  fi

  holder=$(cat "$WHERE/pid" 2>/dev/null)
  since=$(cat "$WHERE/since" 2>/dev/null)

# A run that was killed leaves its lock behind, and a session waiting on a dead holder is worse than the contention it was avoiding. Asked of the process rather than of a timestamp: an age is a guess about how long something ought to take, and this is not.

# ASKED OF `ps` AND NOT OF `kill -0`, because a process that has exited and has not been collected by whatever started it is a zombie that still owns its pid, and `kill -0` reports it as alive. A holder dying while its parent is busy elsewhere would leave a lock that never looks stale, and every run on this machine afterwards would wait on a corpse for ever -- a worse failure than the contention this exists to prevent. Measured on one this suite made by accident: `kill -0` succeeded, `ps -o stat=` said `Z`, and the run sat for eight minutes using no processor time at all.

# Empty is a pid that is gone, `Z` is one that has exited and not been collected, and anything else is really running.
  if [ -n "$holder" ]; then
    state=$(ps -o stat= -p "$holder" 2>/dev/null | tr -d '[:space:]')

    case "$state" in
      '' | Z*)
        case "$state" in
          Z*) went="has exited and was never collected by whatever started it" ;;
          *) went="is no longer a process on this machine" ;;
        esac

        echo "one-at-a-time: pid $holder $went, and left its lock behind. Taking it." >&2
        rm -rf "$WHERE"
        emptyFor=0
        continue
        ;;
    esac
  fi

# AN EMPTY LOCK IS NOT AN ABANDONED LOCK. It is almost always a lock two milliseconds old: `mkdir` claims it and the pid is written on the next line, so for that moment every lock alive is empty. This branch used to take it on sight, and that was a race -- the maker carries on, the taker removes the directory and makes its own, the maker's pid write lands inside it, and afterwards the lock looks perfectly normal while two gates run. Nothing is left to find, only a failure set nobody can read, which is the thing this whole file exists to abolish.

# So an empty lock is waited out and looked at again, and taken only if it is still empty long after any shell could have finished a redirect it had already started.

# THIS IS AN AGE AND THE REST OF THIS FILE REFUSES AGES, so the difference matters or somebody will remove it as inconsistent. Asking `ps` above replaces "how long ought a gate to take", a question with no answer. This asks how long a shell takes to finish a write it has already begun, which has a very short answer -- and ten seconds is that answer against a `date` fork on a machine we have watched turn a one-second keystroke into twenty.
  if [ -z "$holder" ]; then
    if [ "$emptyFor" -lt "$LONG_ENOUGH_TO_BE_ABANDONED" ]; then
      emptyFor=$((emptyFor + 2))
      sleep 2
      continue
    fi

# Said out loud, like the stale takeover above. Reaching here means something really did die between making the lock and claiming it, and a recovery nobody is told about is one nobody ever learns happened.
    echo "one-at-a-time: a lock still empty after ${LONG_ENOUGH_TO_BE_ABANDONED}s. Whatever made it never claimed it. Taking it." >&2
    rm -rf "$WHERE"
    emptyFor=0
    continue
  fi

# There is a pid in it now, so any emptiness seen a moment ago was the claim being written rather than an abandonment, and the count starts again.
  emptyFor=0

# Said once rather than every two seconds. A wait that prints forever is a wait somebody interrupts, and interrupting is how this becomes the thing nobody uses.
  if [ -z "$said" ]; then
    echo "one-at-a-time: waiting for pid $holder, gating since ${since:-an unknown time}." >&2
    said=yes
  fi

  sleep 2
done

echo "$$" > "$WHERE/pid"
date '+%H:%M:%S' > "$WHERE/since"

# Released however this ends, including on an interrupt. Only when it is still ours: a stale-takeover above may have handed it to somebody else while this was waiting, and removing a lock we no longer hold would let two runs proceed at once -- which is the whole thing this exists to prevent, arriving through the cleanup.
release() {
  if [ "$(cat "$WHERE/pid" 2>/dev/null)" = "$$" ]; then
    rm -rf "$WHERE"
  fi
}
trap release EXIT INT TERM

ONE_AT_A_TIME_HELD=1
export ONE_AT_A_TIME_HELD

"$@"
