import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(__dirname, '../../.github/scripts/install-playwright.sh');

// Execute the real shell branches without touching apt or installing browsers.
// Only privileged/external effects are replaced; the script owns selection,
// retries, exit status and arguments.
function install(browsers: string[], options: { cached?: boolean; force?: boolean; fail?: boolean } = {}) {
  return spawnSync(
    'bash',
    [
      '-c',
      `
        sudo() { if [ "$1" = tee ]; then cat >/dev/null; fi; return 0; }
        timeout() { printf 'INSTALL %s\\n' "$*"; return "$INSTALL_RESULT"; }
        sleep() { return 0; }
        task_install_script=$1
        shift
        source "$task_install_script"
      `,
      'playwright-install-test',
      script,
      ...browsers,
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        BROWSERS_CACHED: options.cached === false ? 'false' : 'true',
        PLAYWRIGHT_INSTALL_DEPS: options.force ? 'true' : '',
        PLAYWRIGHT_INSTALL_ATTEMPTS: '2',
        PLAYWRIGHT_INSTALL_TIMEOUT: '7',
        INSTALL_RESULT: options.fail ? '1' : '0',
      },
    },
  );
}

describe('Playwright browser cache and runner system dependencies', () => {
  it.each([{ browsers: [] }, { browsers: ['chromium'] }])(
    'keeps the cached Chromium fast path for $browsers',
    ({ browsers }) => {
      const result = install(browsers);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).not.toContain('INSTALL ');
    },
  );

  it.each([['webkit'], ['firefox'], ['chromium', 'webkit'], ['webkit', 'firefox']])(
    'installs required system dependencies for cached %j',
    (...browsers) => {
      const result = install(browsers);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        `INSTALL --kill-after=30s 7s pnpm exec playwright install-deps ${browsers.join(' ')}`,
      );
      expect(result.stdout).not.toContain('install --with-deps');
    },
  );

  it.each([['webkit'], ['firefox'], ['chromium', 'webkit']])(
    'fails after bounded retries when cached %j dependencies cannot be installed',
    (...browsers) => {
      const result = install(browsers, { fail: true });
      expect(result.status, result.stderr).toBe(1);
      expect(result.stdout.match(/INSTALL /g)).toHaveLength(2);
      expect(result.stdout).toContain('::error::playwright install-deps');
      expect(result.stdout).not.toContain('continuing on the cached browsers');
    },
  );

  it('preserves the explicit advisory Chromium dependency refresh', () => {
    const result = install(['chromium'], { force: true, fail: true });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.match(/INSTALL /g)).toHaveLength(2);
    expect(result.stdout).toContain('install-deps chromium');
    expect(result.stdout).toContain('continuing on the cached browsers');
  });

  it('still requires the full installation on a cold cache', () => {
    const result = install(['webkit'], { cached: false, fail: true });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout.match(/INSTALL /g)).toHaveLength(2);
    expect(result.stdout).toContain('install --with-deps webkit');
  });
});
