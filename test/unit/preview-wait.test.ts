import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/preview-smoke.yml'), 'utf8');
const wait = workflow.split('id: preview')[1].split('run: |\n')[1].split('\n      - name:')[0];
const script = wait.replace(/^ {10}/gm, '').replaceAll('${{ github.repository }}', 'ranuts/document');

function runPreview(responses: string[], apiFails = false) {
  const dir = mkdtempSync(join(tmpdir(), 'preview-wait-'));
  try {
    responses.forEach((response, i) => writeFileSync(join(dir, `response-${i + 1}`), response));
    writeFileSync(
      join(dir, 'gh'),
      `#!/bin/bash\nn=$(cat "$FIXTURE/count" 2>/dev/null || echo 0)\nn=$((n + 1))\necho "$n" > "$FIXTURE/count"\n${apiFails ? 'echo "API unavailable" >&2; exit 1' : 'cat "$FIXTURE/response-$n" 2>/dev/null || true'}\n`,
      { mode: 0o755 },
    );
    writeFileSync(join(dir, 'sleep'), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
    const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        FIXTURE: dir,
        WAIT_MINUTES: '2',
        CHECK_WAIT_MINUTES: '1',
        SHA: 'abc',
        GITHUB_REPOSITORY: 'ranuts/document',
        GITHUB_OUTPUT: join(dir, 'output'),
      },
    });
    return { ...result, polls: Number(readFileSync(join(dir, 'count'), 'utf8')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

it('fails early with instructions when no deployment was triggered', () => {
  const result = runPreview(['', '', '', '', '', '']);
  expect(result.status).toBe(1);
  expect(result.stdout).toContain('never appeared');
  expect(result.stdout).toContain('fork');
  expect(result.polls).toBeLessThan(6);
});

it('keeps waiting for a deployment that has appeared, even if a later poll is empty', () => {
  const result = runPreview([
    '',
    '{"status":"queued"}',
    '',
    '{"status":"in_progress"}',
    '{"status":"completed","conclusion":"success","summary":"https://123.document-7hm.pages.dev"}',
  ]);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('https://123.document-7hm.pages.dev');
});

it('reports an API failure instead of treating it as an absent deployment', () => {
  const result = runPreview([], true);
  expect(result.status).toBe(1);
  expect(result.polls).toBe(1);
  expect(result.stderr).toContain('API unavailable');
});
