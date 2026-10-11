import { parseOfficeRange } from '../office-tools';

export type ChangeReview =
  | { kind: 'text'; before: string; after: string; anchor?: string }
  | { kind: 'cells'; total: number; sampled: boolean; rows: CellChange[] };
export interface CellChange {
  address: string;
  before: string;
  formula?: string;
  after: string;
}

/** Bounded presentation snapshot; the execution plan always retains all values. */
export function reviewCells(
  range: string,
  values: readonly (readonly unknown[])[],
  read: (row: number, column: number) => { value: string; formula?: string },
): Extract<ChangeReview, { kind: 'cells' }> {
  const bounds = parseOfficeRange(range);
  const total = (bounds.r2 - bounds.r1 + 1) * (bounds.c2 - bounds.c1 + 1);
  const rows: CellChange[] = [];
  let truncated = false;
  const bound = (value: string): string => {
    if (value.length > 1000) truncated = true;
    return value.slice(0, 1000);
  };
  for (let row = bounds.r1; row <= bounds.r2 && rows.length < 50; row++) {
    for (let col = bounds.c1; col <= bounds.c2 && rows.length < 50; col++) {
      let number = col + 1;
      let letters = '';
      while (number > 0) {
        letters = String.fromCharCode(65 + ((number - 1) % 26)) + letters;
        number = Math.floor((number - 1) / 26);
      }
      const old = read(row, col);
      rows.push({
        address: `${letters}${row + 1}`,
        before: bound(old.value),
        ...(old.formula ? { formula: bound(old.formula) } : {}),
        after: bound(String(values[row - bounds.r1]?.[col - bounds.c1] ?? '')),
      });
    }
  }
  return { kind: 'cells', total, sampled: truncated || rows.length < total, rows };
}

/** One contiguous change, with code-point boundaries (including surrogate pairs). */
export function textDifference(before: string, after: string) {
  const old = Array.from(before),
    next = Array.from(after);
  let start = 0,
    end = 0;
  while (start < old.length && start < next.length && old[start] === next[start]) start++;
  while (
    end < old.length - start &&
    end < next.length - start &&
    old[old.length - 1 - end] === next[next.length - 1 - end]
  )
    end++;
  return {
    prefix: old.slice(0, start).join(''),
    removed: old.slice(start, old.length - end).join(''),
    added: next.slice(start, next.length - end).join(''),
    suffix: old.slice(old.length - end).join(''),
  };
}
