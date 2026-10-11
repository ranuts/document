import { expect, it } from 'vitest';
import { reviewCells, textDifference } from '../../lib/agent-plugin/ui/change-review';

it('preserves literal Unicode text on both sides of a change', () => {
  expect(textDifference('秋天😀很好', '秋天😀真好')).toEqual({
    prefix: '秋天😀',
    removed: '很',
    added: '真',
    suffix: '好',
  });
});
it('distinguishes formulas, empty cells and new numeric values', () => {
  const review = reviewCells('B2:B3', [[1], [2]], (_row, _col) => ({ value: '', formula: '=A1+1' }));
  expect(review).toEqual({
    kind: 'cells',
    total: 2,
    sampled: false,
    rows: [
      { address: 'B2', before: '', formula: '=A1+1', after: '1' },
      { address: 'B3', before: '', formula: '=A1+1', after: '2' },
    ],
  });
});
it('bounds snapshot reads and explicitly identifies an incomplete sample', () => {
  let reads = 0;
  const review = reviewCells(
    'A1:A100',
    Array.from({ length: 100 }, (_, i) => [i + 1]),
    () => {
      reads++;
      return { value: 'old' };
    },
  );
  expect(reads).toBe(50);
  expect(review.total).toBe(100);
  expect(review.sampled).toBe(true);
  expect(review.rows.at(-1)).toEqual({ address: 'A50', before: 'old', after: '50' });
});

it('bounds individual large cell snapshots without treating them as complete', () => {
  const review = reviewCells('A1', [['new'.repeat(1000)]], () => ({
    value: 'x'.repeat(5000),
    formula: '=' + 'y'.repeat(5000),
  }));
  expect(review.rows[0].before.length).toBeLessThanOrEqual(1000);
  expect(review.rows[0].formula!.length).toBeLessThanOrEqual(1000);
  expect(review.rows[0].after.length).toBeLessThanOrEqual(1000);
  expect(review.sampled).toBe(true);
});
