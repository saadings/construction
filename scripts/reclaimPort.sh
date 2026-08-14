#!/usr/bin/env bash
# Frees a TCP port, naming each process before it stops it, and sending TERM before KILL so it can close cleanly.
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
