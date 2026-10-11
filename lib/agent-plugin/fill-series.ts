import type { AgentTool } from '@ranuts/agent-core/types';
import { parseOfficeRange } from './office-tools';
import { writeExcelRangeValues } from './excel-cell-write';
export interface SeriesInput {
  cell: string;
  first: number;
  last: number;
  step?: number;
}
/** Fixed arithmetic, independently validated before native editor access. */
export function buildSeries({ cell, first, last, step = first <= last ? 1 : -1 }: SeriesInput): {
  range: string;
  values: number[][];
} {
  const bounds = parseOfficeRange(cell);
  if (
    bounds.r1 !== bounds.r2 ||
    bounds.c1 !== bounds.c2 ||
    ![first, last, step].every(Number.isSafeInteger) ||
    Math.abs(first) > 1000000 ||
    Math.abs(last) > 1000000 ||
    step === 0 ||
    (last - first) / step < 0
  )
    throw new Error('Invalid series parameters');
  const count = Math.floor((last - first) / step) + 1;
  if (count > 1000 || bounds.r1 + count > 1048576) throw new Error('Series range is too large');
  const column = cell.replace(/\d+$/, '').toUpperCase();
  return {
    range: `${column}${bounds.r1 + 1}:${column}${bounds.r1 + count}`,
    values: Array.from({ length: count }, (_, i) => [first + i * step]),
  };
}

/** Blank displayed values are insufficient: formulas returning empty text still count as occupied. */
export function seriesTargetEmpty(
  input: SeriesInput,
  readCell: (row: number, column: number) => { getValue(): string; getFormula(): string },
): boolean {
  try {
    const series = buildSeries(input),
      bounds = parseOfficeRange(series.range);
    for (let row = bounds.r1; row <= bounds.r2; row++) {
      const cell = readCell(row, bounds.c1);
      if (cell.getValue() !== '' || cell.getFormula() !== '') return false;
    }
    return true;
  } catch {
    return false;
  }
}
export const fillSeriesTool: AgentTool<SeriesInput, { range: string; count: number; verified: true }> = {
  name: 'fill_series',
  description:
    'Excel only. Fill a numeric series down one column from cell (default step 1 or -1). For example cell A1, first 1, last 100 writes numeric A1:A100. At most 1000 cells. Uses one native Undo transaction and verifies every cell. Overwrites the target range; the application reviews scope before execution.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['cell', 'first', 'last'],
    properties: {
      cell: {
        type: 'string',
        description: 'Starting cell; use the active cell when the user specifies current location.',
      },
      first: { type: 'integer', minimum: -1000000, maximum: 1000000 },
      last: { type: 'integer', minimum: -1000000, maximum: 1000000 },
      step: { type: 'integer', minimum: -1000000, maximum: 1000000 },
    },
  },
  readOnlyHint: false,
  execute: async (input, signal) => {
    signal?.throwIfAborted();
    const series = buildSeries(input);
    await writeExcelRangeValues(series.range, series.values, signal);
    return { range: series.range, count: series.values.length, verified: true };
  },
};
