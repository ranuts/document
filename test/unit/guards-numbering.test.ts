import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every runtime guard has a number, and no two share one.
 *
 * The number is the guard's name in prose: CLAUDE.md, the exploration records
 * and a good many commit messages say "guard 8" or "守卫 10" and expect that to
 * identify one file. Two of them had drifted into sharing a number by
 * 2026-09-12 -- comment-selection and font-loading both called themselves 8,
 * hint-fallback and unload-prompt both 11 -- which quietly made four of those
 * references ambiguous, and two guards had no number at all.
 *
 * Numbers are also the one thing here that must never be recycled: "guard 5"
 * has to keep meaning what the record that mentions it meant. So this checks
 * uniqueness and coverage, not that the set is tidy.
 */
const GUARDS = resolve(__dirname, '../../lib/onlyoffice/guards');

/** The leading `N.` or `Guard N` of a file's own doc comment. */
function numberOf(source: string): number | null {
  const match = /^ \* (?:Guard )?(\d+)[.:]?\s/m.exec(source.slice(0, 400));
  return match ? Number(match[1]) : null;
}

describe('runtime guard numbering', () => {
  const files = readdirSync(GUARDS).filter((name) => name.endsWith('.ts'));

  it('finds the guards (a bad path would make the checks below vacuous)', () => {
    expect(files.length).toBeGreaterThanOrEqual(16);
  });

  it('gives every guard a number', () => {
    const unnumbered = files.filter((name) => numberOf(readFileSync(resolve(GUARDS, name), 'utf8')) === null);
    expect(unnumbered, 'guards without a number in their doc comment').toEqual([]);
  });

  it('gives no two guards the same number', () => {
    const byNumber = new Map<number, string[]>();
    for (const name of files) {
      const n = numberOf(readFileSync(resolve(GUARDS, name), 'utf8'))!;
      byNumber.set(n, [...(byNumber.get(n) ?? []), name]);
    }
    const shared = [...byNumber.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([n, names]) => `${n}: ${names.join(', ')}`);
    expect(shared, 'guards sharing a number').toEqual([]);
  });

  it('numbers them 1..N with no gaps', () => {
    const numbers = files.map((name) => numberOf(readFileSync(resolve(GUARDS, name), 'utf8'))!).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: files.length }, (_, i) => i + 1));
  });
});
