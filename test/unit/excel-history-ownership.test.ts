import { expect, it } from 'vitest';
import { captureExcelHistoryOwnership } from '../../lib/agent-plugin/excel-history-ownership';

it('accepts unchanged native history and rejects an edit appended to the same point', () => {
  const history = { Index: 0, Points: [{ Items: [{}], Description: 7 }] };
  const owns = captureExcelHistoryOwnership(history);
  expect(owns()).toBe(true);
  history.Points[0].Items.push({});
  expect(owns()).toBe(false);
});
it('rejects replaced items, points, history arrays and moved indices', () => {
  const make = () => ({ Index: 0, Points: [{ Items: [{}], Description: 7 }] });
  for (const mutate of [
    (h: ReturnType<typeof make>) => {
      h.Points[0].Items[0] = {};
    },
    (h: ReturnType<typeof make>) => {
      h.Points[0] = { Items: [...h.Points[0].Items], Description: 7 };
    },
    (h: ReturnType<typeof make>) => {
      h.Points = [...h.Points];
    },
    (h: ReturnType<typeof make>) => {
      h.Index = -1;
    },
    (h: ReturnType<typeof make>) => {
      h.Points[0].Description = 8;
    },
  ]) {
    const h = make(),
      owns = captureExcelHistoryOwnership(h);
    mutate(h);
    expect(owns()).toBe(false);
  }
});
it('captures each pending stage independently and checks the original document', () => {
  const h = { Index: 0, Points: [{ Items: [{}] }] };
  let current = true;
  const first = captureExcelHistoryOwnership(h, () => current);
  h.Points[0].Items.push({});
  const second = captureExcelHistoryOwnership(h, () => current);
  expect(first()).toBe(false);
  expect(second()).toBe(true);
  current = false;
  expect(second()).toBe(false);
});
