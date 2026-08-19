#!/bin/sh
#
# Serve dist/ with Cloudflare Pages' own semantics for the e2e-pages suite.
#
# Two things this wrapper exists for:
#
# 1. A pinned compatibility date. Given none, wrangler defaults to *today*,
#    and the workerd binary it ships only supports dates up to its own release
#    -- so on 2026-08-19 every run, on every branch, died with "This Worker
#    requires compatibility date 2026-08-19, but the newest date supported by
#    this server binary is 2026-08-18". A date that arrives on a calendar and
#    not in a commit is a time bomb; pin it. Any date the installed workerd
#    knows about will do (old dates are supported forever, and this project
#    serves static assets with no Functions), so bump it deliberately or not
#    at all.
#
# 2. A restart loop that gives up. workerd has been seen to die mid-run on CI
#    when a browser aborts a large download (sdk-all.js) while tests hammer it
#    ("kj/async-io-unix.c++ ... Connection reset by peer"), after which every
#    test fails with ECONNREFUSED -- so a crash should cost one retried test,
#    not the job. But an unconditional loop also retries a startup error
#    forever, which is how the compatibility-date failure above surfaced: not
#    as its own clear message but as Playwright's "Timed out waiting 300000ms
#    from config.webServer", with the real cause fifteen repetitions upstream.
#    Restart a server that had been running; give up on one that never starts.
set -eu

PORT=${1:-8788}
COMPATIBILITY_DATE=2026-08-01

# A server that dies this soon never came up; it failed to start.
STARTUP_SECONDS=10
MAX_STARTUP_FAILURES=3

failures=0
while true; do
  started=$(date +%s)

  if pnpm dlx wrangler@latest pages dev dist \
    --port "$PORT" \
    --ip 127.0.0.1 \
    --compatibility-date "$COMPATIBILITY_DATE"; then
    exit 0
  fi

  elapsed=$(($(date +%s) - started))

  if [ "$elapsed" -lt "$STARTUP_SECONDS" ]; then
    failures=$((failures + 1))
    if [ "$failures" -ge "$MAX_STARTUP_FAILURES" ]; then
      echo "wrangler pages dev failed to start ${failures} times in a row; the error is above" >&2
      exit 1
    fi
  else
    failures=0
  fi

  echo "wrangler pages dev exited after ${elapsed}s, restarting"
  sleep 1
done
