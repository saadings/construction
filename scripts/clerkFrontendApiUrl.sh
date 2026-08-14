#!/usr/bin/env bash
#
# Prints the address of the Clerk instance that CLERK_PUBLISHABLE_KEY names.
#
# This is the issuer Convex checks every token against. A wrong one is not a
# broken build: sign-in works, tokens are issued, and the backend refuses every
# one of them — which reads as a permissions bug and is not one.
#
# Extracted from the workflow so the derivation can be tested. Inline it had no
# way to refuse an empty key: the prefix strip, the padding loop, the decode and
# the round-trip check all succeed on an empty string, and the caller then put
# the scheme in front of nothing and wrote the eight characters `https://` to
# the production deployment.
#
# The key is read from the environment rather than taken as an argument, so it
# never reaches argv.
set -euo pipefail

key=${CLERK_PUBLISHABLE_KEY:-}

# The publishable key carries the Clerk host as base64 with a trailing '$', and
# Clerk ships it unpadded. Every decoder drops an incomplete final group, so
# without restoring the padding the host loses its last character —
# "…accounts.de" rather than "…accounts.dev". Convex accepts that happily and
# then rejects every token signed by the real instance.
raw=${key#pk_*_}

# An empty key trips this too: the strip is a no-op, so nothing was removed.
if [ "$raw" = "$key" ]; then
  echo "CLERK_PUBLISHABLE_KEY is empty or is not a pk_test_/pk_live_ key" >&2
  exit 1
fi

padded=$raw
while [ $((${#padded} % 4)) -ne 0 ]; do
  padded="${padded}="
done
decoded=$(printf '%s' "$padded" | base64 -d)

# Re-encoding has to land back on what we started with. A decoder that dropped
# the last group produces something shorter, and this is the only place that
# difference is ever visible.
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
