#!/usr/bin/env bash
#
# Prints the address of the Convex backend that CONVEX_DEPLOY_KEY names.
#
# The frontend is built with this address compiled into the bundle, and nothing
# downstream ever checks it: a wrong one builds, deploys, and passes every
# check in the pipeline while the app in front of a person reaches nothing.
#
# So the key has to be the one shape that carries a deployment name.
# `npx convex deploy` also accepts a project-scoped key —
# `project:owner:name|...` — which deploys the backend perfectly well while
# yielding the project's name here, and a host of that name does not exist.
# The URL check in frontend/src/lib/env.ts accepts it, because it is a
# perfectly well-formed URL. Refuse it here or it is never caught at all.
#
# The key is read from the environment rather than taken as an argument, so it
# never reaches argv.
set -euo pipefail

key=${CONVEX_DEPLOY_KEY:-}

case "$key" in
  # prod:<name>|<secret>, with at least one character of name.
  prod:?*\|*) ;;
  *)
    echo "CONVEX_DEPLOY_KEY does not name a production deployment, so the address of the backend cannot be read out of it." >&2
    exit 1
    ;;
esac

name=${key%%|*}
name=${name#prod:}

printf 'https://%s.convex.cloud\n' "$name"
