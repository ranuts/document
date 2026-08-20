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

# On a cache hit, skip apt entirely.
#
# What `install-deps` actually does on a hosted runner, read off a healthy run:
# every library Chromium needs -- libnss3, libgbm1, libasound2t64, libcairo2,
# the lot -- reports "is already the newest version". The runner image ships
# them. The only thing apt installs is 21.1 MB of fonts (fonts-wqy-zenhei,
# fonts-ipafont-gothic, fonts-unifont, fonts-freefont-ttf, fonts-tlwg-loma-otf,
# xfonts-encodings), for rendering scripts a screenshot might contain.
#
# This suite does not render through them. The editor draws with its own
# vendored XOR font catalog (public/fonts/), PDF export injects
# PDF_FONT_MANIFEST, and the landing pages load vendored Geist woff2 -- system
# fonts reach nothing but DOM fallback text. The visual specs compare two
# renders from the same browser (original against saved-and-reopened), so a
# missing glyph would be missing identically on both sides.
#
# So each job was making a network call to Ubuntu's mirrors, on a fresh VM,
# for fonts nothing reads. Eleven jobs, eleven rolls of the dice per run -- and
# the dice are loaded: the runner's preferred azure.archive.ubuntu.com comes
# back `Ign:`, apt falls through to the public archive, and that stalls dead
# with no bytes moving. Four jobs were killed at GitHub's six-hour limit this
# week before the attempts were bounded; two more burned 17 minutes each on a
# single pull request after that.
#
# A cold cache still installs, deps and all: there are no browsers to run
# without it, and that path downloads from Playwright's CDN anyway.
if [ "${BROWSERS_CACHED:-}" = "true" ]; then
  if [ "${PLAYWRIGHT_INSTALL_DEPS:-}" != "true" ]; then
    echo "Browsers restored from the cache; skipping the apt font install."
    exit 0
  fi
  # Escape hatch: PLAYWRIGHT_INSTALL_DEPS=true puts apt back, bounded and
  # advisory, for the day a runner image stops shipping one of the libraries.
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

# Stop apt from trickling along on a half-dead mirror indefinitely. This alone
# would not have saved the six-hour runs (the stall happens with no bytes
# moving at all), but it turns a slow mirror into a fast failure too.
sudo tee /etc/apt/apt.conf.d/99-ci-timeouts >/dev/null <<'CONF'
Acquire::Retries "3";
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
CONF

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
