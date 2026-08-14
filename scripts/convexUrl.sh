#!/usr/bin/env bash
# Prints the Convex backend address named by CONVEX_DEPLOY_KEY, refusing any key that does not carry a deployment name.
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
