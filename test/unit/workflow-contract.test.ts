import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CI workflow contract. GitHub applies no default job timeout, and the apt-get
 * that `playwright install --with-deps` shells out to has stalled outright on
 * the hosted runners: four runs in a single day were killed at the six-hour
 * limit, each one blocking a pull request until it was re-run by hand the next
 * morning. Both guards -- a timeout on every job, and routing every browser
 * install through the bounded retrying script -- are one line each and exactly
 * the kind of thing a newly added workflow forgets, so pin them here.
 */
const ROOT = resolve(__dirname, '../..');
const WORKFLOW_DIR = resolve(ROOT, '.github/workflows');

const workflows = readdirSync(WORKFLOW_DIR)
  .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
  .map((file) => ({ file, src: readFileSync(resolve(WORKFLOW_DIR, file), 'utf8') }));

/**
 * Pull the top-level jobs out of a workflow. The repository has no YAML parser
 * in its dependencies (see hosting-contract.test.ts for the same trade-off),
 * and the shape needed here is narrow: job names sit at two spaces of indent
 * under `jobs:`, and their own keys at four.
 */
function parseJobs(src: string): Array<{ name: string; body: string }> {
  const lines = src.split('\n');
  const start = lines.indexOf('jobs:');
  if (start === -1) return [];

  const jobs: Array<{ name: string; body: string }> = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Za-z0-9_-]+:/.test(line)) break; // back out to the next top-level key
    const header = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (header) {
      jobs.push({ name: header[1], body: '' });
    } else if (jobs.length > 0) {
      jobs[jobs.length - 1].body += `${line}\n`;
    }
  }
  return jobs;
}

it('finds every workflow (a bad glob would make the checks below vacuous)', () => {
  expect(workflows.length).toBeGreaterThanOrEqual(8);
  expect(workflows.every(({ src }) => parseJobs(src).length > 0)).toBe(true);
});

describe.each(workflows)('$file', ({ src }) => {
  const jobs = parseJobs(src);

  it.each(jobs)('job $name is bounded by a timeout', ({ body }) => {
    const timeout = body.match(/^ {4}timeout-minutes: (\d+)$/m);
    expect(timeout).not.toBeNull();
    // A job that wants longer than an hour is either the nightly corpus run or
    // a hang; both should be a deliberate edit here rather than a default.
    expect(Number(timeout?.[1])).toBeLessThanOrEqual(300);
  });

  it('installs Playwright browsers only through the shared setup action', () => {
    expect(src).not.toMatch(/playwright install/);
    if (/playwright test|test:e2e|browsers:/.test(src)) {
      expect(src).toMatch(/uses: \.\/\.github\/actions\/setup/);
    }
  });
});

describe('the shared setup action', () => {
  const action = readFileSync(resolve(ROOT, '.github/actions/setup/action.yml'), 'utf8');

  it('routes the browser install through the retrying script', () => {
    expect(action).toMatch(/\.github\/scripts\/install-playwright\.sh/);
    expect(action).not.toMatch(/run: pnpm exec playwright install/);
  });

  it('caches the browsers against the Playwright version, not the lockfile', () => {
    // Keying on the lockfile would evict the cache on every dependency bump
    // and re-download the browsers for no reason.
    expect(action).toMatch(/key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ steps\.playwright\.outputs\.version \}\}/);
  });
});

describe('the Playwright install script', () => {
  const script = readFileSync(resolve(ROOT, '.github/scripts/install-playwright.sh'), 'utf8');

  it('bounds each attempt and retries', () => {
    expect(script).toMatch(/timeout --kill-after=\d+s "\$\{attempt_timeout\}s"/);
    expect(script).toMatch(/for attempt in \$\(seq 1 "\$attempts"\)/);
  });

  it('lets a stalled apt through once the browsers came from the cache', () => {
    // A cache hit means the binaries are already there and apt could only be
    // adding system libraries the runner image already ships. Treating its
    // stall as fatal turned a bad Ubuntu mirror into a red pull request --
    // twice on one run, and sharding tripled the number of jobs exposed.
    expect(script).toMatch(/deps_are_advisory=true/);
    expect(script).toMatch(/if \[ "\$deps_are_advisory" = "true" \]; then[\s\S]*?exit 0/);
  });

  it('still fails hard when there is no cached browser to fall back on', () => {
    // Without the cache this step is what puts the browsers on disk; letting
    // it fail would hand the test step an error about nothing being installed.
    expect(script).toMatch(/deps_are_advisory=false/);
    expect(script).toMatch(/::error::playwright[\s\S]*?\nexit 1/);
  });

  it('does not spend the patient budget on an attempt it is willing to lose', () => {
    // The advisory path gave up only after 3 x 300s: a quarter of an hour per
    // job, spent to reach a verdict that no longer changes anything.
    const advisory = script.match(/deps_are_advisory=true\n\s*default_attempts=(\d+)\n\s*default_timeout=(\d+)/);
    expect(advisory).not.toBeNull();
    expect(Number(advisory![1]) * Number(advisory![2])).toBeLessThanOrEqual(180);
  });

  it('clears the apt locks a killed attempt leaves behind', () => {
    // Without this the retry fails instantly on "Could not get lock", which
    // would make the retry loop pure decoration.
    expect(script).toMatch(/\/var\/lib\/dpkg\/lock-frontend/);
  });
});

describe('bin/serve-pages-dev.sh', () => {
  const script = readFileSync(resolve(ROOT, 'bin/serve-pages-dev.sh'), 'utf8');
  const config = readFileSync(resolve(ROOT, 'playwright.pages.config.ts'), 'utf8');

  it('pins the compatibility date instead of letting wrangler default to today', () => {
    // wrangler defaults to the current date, and its workerd only supports
    // dates up to its own release: on 2026-08-19 that default broke the
    // e2e-pages job on every branch at once, main included. A date that
    // arrives on a calendar rather than in a commit is a time bomb.
    expect(script).toMatch(/--compatibility-date/);
    expect(script).toMatch(/^COMPATIBILITY_DATE=\d{4}-\d{2}-\d{2}$/m);
  });

  it('gives up on a server that never starts', () => {
    // The restart loop is there for a mid-run workerd crash, but retrying a
    // startup error forever is what buried the real message under Playwright's
    // "Timed out waiting 300000ms from config.webServer".
    expect(script).toMatch(/MAX_STARTUP_FAILURES=\d+/);
    expect(script).toMatch(/failed to start/);
  });

  it('is the only way the suite starts wrangler', () => {
    expect(config).toMatch(/bin\/serve-pages-dev\.sh/);
    expect(config).not.toMatch(/wrangler@latest pages dev/);
  });
});

describe('.github/workflows/ci.yml', () => {
  const ci = workflows.find(({ file }) => file === 'ci.yml')!.src;
  const ciJobs = parseJobs(ci);

  it('drops the run for a superseded pull request commit, but never for main', () => {
    expect(ci).toMatch(/^concurrency:$/m);
    expect(ci).toMatch(/cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  });

  const sharded = ciJobs.filter(({ body }) => body.includes('--shard='));

  it('shards every E2E suite (the three of them are the whole cost of the run)', () => {
    expect(sharded.map(({ name }) => name)).toEqual(['e2e-shard', 'e2e-pages-shard', 'e2e-docker-shard']);
  });

  it.each(sharded)('job $name splits into exactly as many shards as it declares', ({ body }) => {
    // A matrix of three against `--shard=N/4` silently drops a quarter of the
    // suite and still reports green -- the failure mode is invisible, so the
    // two numbers are pinned to each other here.
    const matrix = body.match(/shard: \[([^\]]+)\]/);
    const denominator = body.match(/--shard=\$\{\{ matrix\.shard \}\}\/(\d+)/);
    expect(matrix).not.toBeNull();
    expect(denominator).not.toBeNull();
    expect(matrix![1].split(',').length).toBe(Number(denominator![1]));
  });

  it.each([
    ['e2e', 'E2E', 'e2e-shard'],
    ['e2e-pages', 'E2E (Cloudflare Pages semantics)', 'e2e-pages-shard'],
    ['e2e-docker', 'E2E (Docker image)', 'e2e-docker-shard'],
  ])('%s reports the shard verdict under the name branch protection requires', (id, checkName, shardJob) => {
    // main requires these three checks by name. Renaming a summary job, or
    // letting one pass while its shards failed, leaves every pull request
    // either permanently pending or merged on a green that means nothing.
    const job = ciJobs.find(({ name }) => name === id);
    expect(job).toBeDefined();
    expect(job!.body).toMatch(new RegExp(`^ {4}name: ${checkName.replace(/[()]/g, '\\$&')}$`, 'm'));
    expect(job!.body).toMatch(new RegExp(`^ {4}needs: ${shardJob}$`, 'm'));
    expect(job!.body).toMatch(/^ {4}if: always\(\)$/m);
    expect(job!.body).toMatch(new RegExp(`RESULT: \\$\\{\\{ needs\\.${shardJob}\\.result \\}\\}`));
    expect(job!.body).toMatch(/\[ "\$RESULT" = "success" \] \|\| exit 1/);
  });

  it('passes the shard to the Docker suite without going through pnpm', () => {
    // `pnpm run test:e2e:docker -- --shard=1/3` drops the arguments on the
    // floor: every shard then runs the whole suite, three times over, and the
    // run stays green while the sharding does nothing at all. Measured, not
    // assumed -- see docs/explorations/2026-08-19-ci-e2e-sharding.md.
    expect(ci).toMatch(/run: sh \.\/bin\/test-e2e-docker\.sh --shard=/);
    expect(ci).not.toMatch(/pnpm run test:e2e:docker.*--shard/);
  });
});

describe('bin/test-e2e-docker.sh', () => {
  const script = readFileSync(resolve(ROOT, 'bin/test-e2e-docker.sh'), 'utf8');

  it('forwards its arguments to Playwright', () => {
    expect(script).toMatch(/playwright test --config playwright\.docker\.config\.ts "\$@"/);
  });
});
