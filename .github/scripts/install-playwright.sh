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

# Stop apt from trickling along on a half-dead mirror indefinitely. This alone
# would not have saved the six-hour runs (the stall happens with no bytes
# moving at all), but it turns a slow mirror into a fast failure too.
sudo tee /etc/apt/apt.conf.d/99-ci-timeouts >/dev/null <<'CONF'
Acquire::Retries "3";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
CONF

# A cache hit restores the browser binaries but never the system libraries, so
# the apt half still has to run -- but it is allowed to lose, and it is not
# allowed to take long about it (see the note on the exit below). A healthy
# install-deps finishes well inside a minute; a stalled one costs two and the
# suite carries on. A cold cache has no browsers to run without, so it keeps
# the patient settings.
if [ "${BROWSERS_CACHED:-}" = "true" ]; then
  command=(install-deps "${browsers[@]}")
  deps_are_advisory=true
  default_attempts=1
  default_timeout=120
else
  command=(install --with-deps "${browsers[@]}")
  deps_are_advisory=false
  default_attempts=3
  default_timeout=300
fi

attempts=${PLAYWRIGHT_INSTALL_ATTEMPTS:-$default_attempts}
attempt_timeout=${PLAYWRIGHT_INSTALL_TIMEOUT:-$default_timeout}

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

# With the binaries already restored from the cache, the only thing apt could
# still be adding is system libraries -- and the hosted runner image ships
# chromium's. Failing the job here means a stalled Ubuntu mirror is a red pull
# request, which is what actually happened: `noble-security InRelease` followed
# by four and a half minutes of total silence, three attempts in a row, twice on
# the same run. Sharding multiplied the number of jobs exposed to it.
#
# So on a cache hit the suite runs anyway. If a library really is missing,
# Playwright says so in as many words when it launches the browser, and the
# test step fails with that message instead of this one -- the information is
# not lost, it just no longer costs a run. A cold cache still has to succeed:
# there are no browsers to run without it.
if [ "$deps_are_advisory" = "true" ]; then
  echo "::warning::playwright ${command[*]} failed after ${attempts} attempts; continuing on the cached browsers"
  exit 0
fi

echo "::error::playwright ${command[*]} failed after ${attempts} attempts"
exit 1
