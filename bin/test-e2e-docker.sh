#!/bin/bash
# Build the production Docker image and run the full e2e suite against it.
# The container is force-removed before and after the run: Playwright kills
# the foreground `docker run` CLI on shutdown, but the signal does not always
# reach the container, and a leftover container would be silently reused on
# the next run (serving a stale image -- the exact class of debugging trap
# documented in CLAUDE.md for preview servers).
set -e

docker build -t document:e2e .
docker rm -f document-e2e-docker >/dev/null 2>&1 || true

set +e
E2E_DOCKER=1 ./node_modules/.bin/playwright test --config playwright.docker.config.ts
status=$?
set -e

docker rm -f document-e2e-docker >/dev/null 2>&1 || true
exit $status
