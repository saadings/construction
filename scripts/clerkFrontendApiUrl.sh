#!/usr/bin/env bash
# Prints the Clerk issuer named by the Clerk publishable key — a wrong one reads as a permissions bug rather than a broken build.
set -euo pipefail

# Two names for one public value, both correct: Vite needs the VITE_ prefix to put it in the bundle, CI and scripts do not. Unset falls back rather than empty, so a key deliberately blanked still refuses instead of quietly reading the other one.
key=${CLERK_PUBLISHABLE_KEY-${VITE_CLERK_PUBLISHABLE_KEY:-}}

# Clerk ships the host as unpadded base64, and every decoder drops an incomplete final group — "…accounts.de", not "…accounts.dev".
raw=${key#pk_*_}

# An empty key trips this too: the strip is a no-op, so nothing was removed.
if [ "$raw" = "$key" ]; then
  echo "Neither CLERK_PUBLISHABLE_KEY nor VITE_CLERK_PUBLISHABLE_KEY holds a pk_test_/pk_live_ key" >&2
  exit 1
fi

padded=$raw
while [ $((${#padded} % 4)) -ne 0 ]; do
  padded="${padded}="
done
decoded=$(printf '%s' "$padded" | base64 -d)

# Re-encoding has to land back on what we started with; a dropped final group is visible nowhere else.
if [ "$(printf '%s' "$decoded" | base64 | tr -d '=\n')" != "$raw" ]; then
  echo "The Clerk host could not be read back out of the publishable key." >&2
  exit 1
fi

CLERK_FAPI=${decoded%\$}

case "$CLERK_FAPI" in
  *.*) ;;
  *)
    echo 'The Clerk host read out of CLERK_PUBLISHABLE_KEY is not a hostname' >&2
    exit 1
    ;;
esac

printf 'https://%s\n' "$CLERK_FAPI"
