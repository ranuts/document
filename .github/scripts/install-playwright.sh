#!/usr/bin/env bash
#
# Install the Playwright browsers, with every attempt bounded and retried.
#
# `playwright install --with-deps` shells out to apt-get, and apt on the hosted
# runners has repeatedly stalled forever immediately after fetching the release
# indexes. Four CI runs in a single day were killed at GitHub's six-hour job
# limit at exactly that point -- a different job each time, since all three e2e
# jobs run this same step -- and each one had to be re-run by hand the next
# morning. apt enforces no wall-clock limit of its own, so bound each attempt
# here: an unreachable mirror now costs minutes and self-heals on the retry
# instead of blocking a pull request overnight.
set -euo pipefail

browsers=("$@")
if [ ${#browsers[@]} -eq 0 ]; then
  browsers=(chromium)
fi

attempts=${PLAYWRIGHT_INSTALL_ATTEMPTS:-3}
attempt_timeout=${PLAYWRIGHT_INSTALL_TIMEOUT:-300}

# Stop apt from trickling along on a half-dead mirror indefinitely. This alone
# would not have saved the six-hour runs (the stall happens with no bytes
# moving at all), but it turns a slow mirror into a fast failure too.
sudo tee /etc/apt/apt.conf.d/99-ci-timeouts >/dev/null <<'CONF'
Acquire::Retries "3";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
CONF

# A cache hit restores the browser binaries but never the system libraries,
# so the apt half still has to run.
if [ "${BROWSERS_CACHED:-}" = "true" ]; then
  command=(install-deps "${browsers[@]}")
else
  command=(install --with-deps "${browsers[@]}")
fi

for attempt in $(seq 1 "$attempts"); do
  if timeout --kill-after=30s "${attempt_timeout}s" pnpm exec playwright "${command[@]}"; then
    exit 0
  fi

  echo "::warning::playwright ${command[*]} failed or exceeded ${attempt_timeout}s (attempt ${attempt}/${attempts})"

  # timeout only signals pnpm; a stalled apt-get is a grandchild and survives it.
  # Match on the process name rather than the full command line, or pkill would
  # match the sudo that is running it and take out this script instead.
  for process in apt-get apt dpkg unattended-upgr; do
    sudo pkill -9 -x "$process" || true
  done

  # A killed apt leaves its locks behind and the retry would fail instantly.
  sudo rm -f \
    /var/lib/apt/lists/lock \
    /var/cache/apt/archives/lock \
    /var/lib/dpkg/lock \
    /var/lib/dpkg/lock-frontend
  sudo dpkg --configure -a || true

  sleep 10
done

echo "::error::playwright ${command[*]} failed after ${attempts} attempts"
exit 1
