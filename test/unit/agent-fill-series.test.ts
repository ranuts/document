import { expect, it, vi } from 'vitest';
const write = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../lib/agent-plugin/excel-cell-write', () => ({ writeExcelRangeValues: write }));
import { buildSeries, fillSeriesTool, seriesTargetEmpty } from '../../lib/agent-plugin/fill-series';
it('builds a bounded numeric A1:A100 operation, not a tutorial or 100 separate writes', async () => {
  const input = { cell: 'A1', first: 1, last: 100 };
  const plan = buildSeries(input);
  expect(plan.range).toBe('A1:A100');
  expect(plan.values).toEqual(Array.from({ length: 100 }, (_, i) => [i + 1]));
  expect(await fillSeriesTool.execute(input)).toMatchObject({ range: 'A1:A100', verified: true });
  expect(write).toHaveBeenCalledExactlyOnceWith('A1:A100', plan.values, undefined);
});
it('allows automatic filling only when every target cell has neither a value nor a formula', () => {
  const input = { cell: 'A1', first: 1, last: 100 };
  expect(seriesTargetEmpty(input, () => ({ getValue: () => '', getFormula: () => '' }))).toBe(true);
  expect(seriesTargetEmpty(input, (row) => ({ getValue: () => (row === 90 ? '0' : ''), getFormula: () => '' }))).toBe(
    false,
  );
  expect(seriesTargetEmpty(input, () => ({ getValue: () => '', getFormula: () => 'IF(A2,"","")' }))).toBe(false);
});
it.each([
  { cell: 'A1', first: 1, last: 10001 },
  { cell: 'A1048576', first: 1, last: 2 },
  { cell: 'A1:A2', first: 1, last: 2 },
  { cell: 'A1', first: 1, last: 100, step: 0 },
])('rejects unbounded or invalid series before an editor mutation', (input) => {
  expect(() => buildSeries(input)).toThrow();
});
