import { expect, it, vi } from 'vitest';
import { inheritedSlideShapes } from '../../lib/agent-plugin/slide-text-obstacles';
const shape = (placeholder = false, hidden = false) => ({
  isPlaceholder: () => placeholder,
  hidden,
  bounds: { l: 0, t: 0, r: 100, b: 20 },
});
it('includes visible master and layout drawings but excludes their placeholders and hidden shapes', () => {
  const logo = shape(),
    header = shape(),
    placeholder = shape(true),
    hidden = shape(false, true);
  const master = { cSld: { spTree: [logo, placeholder] }, recalculate: vi.fn() };
  const layout = { cSld: { spTree: [header, hidden] }, Master: master, recalculate: vi.fn() };
  expect(
    inheritedSlideShapes(
      { Layout: layout, needMasterSpDraw: () => true, needLayoutSpDraw: () => true },
      (object) => (object as typeof hidden).hidden,
    ),
  ).toEqual([logo, header]);
  expect(master.recalculate).toHaveBeenCalledOnce();
  expect(layout.recalculate).toHaveBeenCalledOnce();
});
it('respects slide flags that suppress inherited drawings', () => {
  const layout = {
    cSld: { spTree: [shape()] },
    Master: { cSld: { spTree: [shape()] }, recalculate: vi.fn() },
    recalculate: vi.fn(),
  };
  expect(
    inheritedSlideShapes({ Layout: layout, needMasterSpDraw: () => false, needLayoutSpDraw: () => false }, () => false),
  ).toEqual([]);
  expect(layout.recalculate).not.toHaveBeenCalled();
  expect(layout.Master.recalculate).not.toHaveBeenCalled();
});
it('rejects unknown inherited visibility rather than assuming a template is empty', () => {
  expect(() =>
    inheritedSlideShapes({ Layout: { cSld: { spTree: [shape()] }, recalculate: vi.fn() } }, () => false),
  ).toThrow('could not be verified');
});
it('supports a slide with no inherited layout', () => {
  expect(inheritedSlideShapes({}, undefined)).toEqual([]);
});
