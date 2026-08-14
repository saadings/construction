#!/usr/bin/env bash
#
# Frees a TCP port, saying what it is stopping before it stops it.
#
# This was `lsof -ti:PORT | xargs kill -9 2>/dev/null || true` inline in
# dev.sh. Port 3000 is the most contended port on a developer machine, and that
# line sent SIGKILL to whatever held it — another project's server, a database
# tunnel, a debugger — with no check that the process had anything to do with
# this repository, and with the error output discarded so nothing was ever said
# about it. The banner then printed as though it had been a clean start.
#
# SIGKILL cannot be caught, so nothing killed that way gets to flush, close a
# socket or remove a lock file. TERM first gives it the chance; KILL is kept
# for whatever ignores that.
set -euo pipefail

port=${1:-}

if [ -z "$port" ]; then
  echo "usage: reclaimPort.sh <port>" >&2
  exit 1
fi

holders=$(lsof -ti:"$port" || true)

if [ -z "$holders" ]; then
  exit 0
fi

echo "Port $port is in use. Stopping:"
# shellcheck disable=SC2086
ps -o pid=,command= -p $holders

# shellcheck disable=SC2086
kill -TERM $holders 2>/dev/null || true

waited=0
while [ "$waited" -lt 20 ]; do
  if [ -z "$(lsof -ti:"$port" || true)" ]; then
    exit 0
  fi
  sleep 0.1
  waited=$((waited + 1))
done

survivors=$(lsof -ti:"$port" || true)
if [ -n "$survivors" ]; then
  echo "Still holding port $port after 2s — sending KILL:"
  # shellcheck disable=SC2086
  ps -o pid=,command= -p $survivors
  # shellcheck disable=SC2086
  kill -KILL $survivors 2>/dev/null || true
fi
