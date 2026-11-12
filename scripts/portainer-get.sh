#!/usr/bin/env bash
#
# An authenticated GET against Portainer that says what went wrong.
#
# Why this exists
# ---------------
# Every Portainer read in the deploy workflows used to be a bare
# `curl -s ... | jq`, with no status check. When the answer was not JSON the
# only thing in the log was:
#
#     jq: parse error: Invalid numeric literal at line 1, column 6
#
# which names neither the endpoint, nor the status, nor the body. Three staging
# deploys failed exactly that way on 2026-11-12 (8990cc6, 2f11fc5, d0355a3).
# The real answer was HTTP 530 with the sixteen-byte body `error code: 1033` —
# Cloudflare saying the tunnel to the Portainer host was down. Column 6 is
# where `error` ends, and that was the entire diagnosis available from CI.
#
# Nothing here changes what is deployed. It changes what a failure tells you.
#
# Usage
# -----
#     PORTAINER_URL=https://host PORTAINER_TOKEN=... scripts/portainer-get.sh /api/stacks
#
# Prints the response body on stdout, so callers keep piping it to jq.
# Exits 1 with the status and a short excerpt on stderr when the status is not
# 2xx or the body is not JSON.
#
# Secrets
# -------
# This repository is public. The token is read from the environment, never
# taken as an argument (argv is visible to other processes) and never printed.
# The body is echoed only when the status is not 2xx or the body is not valid
# JSON — that is an error page or a small `{"message":...}`, never a 200 from
# `/api/stacks/{id}`, whose `Env` carries a resort's own secrets. On success
# the body goes to stdout for the caller and is not logged.
set -euo pipefail

path="${1:?usage: portainer-get.sh <path>   (e.g. /api/stacks)}"
: "${PORTAINER_URL:?PORTAINER_URL is not set}"
: "${PORTAINER_TOKEN:?PORTAINER_TOKEN is not set}"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

# --max-time guards against a hung tunnel holding the job open; curl answering
# 000 is itself a status this script reports rather than swallowing.
# `-w '%{http_code}'` already prints 000 when the connection never happened,
# so curl's own exit status must not append a second one — `|| echo 000` here
# produced the status "000000", which is not a thing.
status="$(
  curl -s -S --max-time 60 \
    -o "$body_file" \
    -w '%{http_code}' \
    -H "X-API-Key: ${PORTAINER_TOKEN}" \
    "${PORTAINER_URL}${path}" || true
)"
status="${status:-000}"

excerpt() {
  # One line, 200 characters, so a stray HTML page cannot bury the log.
  head -c 200 "$body_file" | tr '\n\r' '  '
}

case "$status" in
  2??) ;;
  *)
    echo "::error::Portainer GET ${path} answered HTTP ${status}." >&2
    echo "  body: $(excerpt)" >&2
    if [ "$status" = "530" ]; then
      echo "  HTTP 530 with 'error code: 1033' is Cloudflare reporting that the tunnel" >&2
      echo "  to the Portainer host is down. The image built and pushed fine; nothing" >&2
      echo "  can reach Portainer to deploy it. Bring cloudflared back up on the host." >&2
    fi
    exit 1
    ;;
esac

if ! jq -e . "$body_file" >/dev/null 2>&1; then
  echo "::error::Portainer GET ${path} answered HTTP ${status} but the body is not JSON." >&2
  echo "  body: $(excerpt)" >&2
  exit 1
fi

cat "$body_file"
