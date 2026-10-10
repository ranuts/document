import { expect, it, vi } from 'vitest';
import { positionSlideText } from '../../lib/agent-plugin/slide-text-position';

function fixture() {
  const original = { bounds: { l: 0, t: 0, r: 340, b: 145 } };
  const added = { bounds: { l: 100, t: 80, r: 180, b: 105 } };
  const controller = { selectedObjects: [added] };
  const apply = vi.fn((properties: { Width?: number; Position?: { X: number; Y: number } }) => {
    if (properties.Width !== undefined) added.bounds.r = added.bounds.l + properties.Width + 0.01;
    if (properties.Position) {
      const width = added.bounds.r - added.bounds.l,
        height = added.bounds.b - added.bounds.t;
      added.bounds = {
        l: properties.Position.X,
        t: properties.Position.Y,
        r: properties.Position.X + width,
        b: properties.Position.Y + height,
      };
    }
  });
  return { original, added, controller, apply, recalculate: vi.fn(), size: { width: 340, height: 190 } };
}
it('places the measured native box below existing content and keeps original geometry', () => {
  const f = fixture(),
    before = structuredClone(f.original);
  positionSlideText(f.size, [f.original], f.added, f.controller, f.apply, f.recalculate);
  expect(f.added.bounds.l).toBeCloseTo(10.2);
  expect(f.added.bounds.t).toBeCloseTo(148.8);
  expect(f.added.bounds.r - f.added.bounds.l).toBeCloseTo(221.01);
  expect(f.original).toEqual(before);
});
it('rejects a full slide after native width measurement', () => {
  const f = fixture();
  f.original.bounds.b = 190;
  expect(() => positionSlideText(f.size, [f.original], f.added, f.controller, f.apply, f.recalculate)).toThrow(
    'No free text area',
  );
  expect(f.apply).toHaveBeenCalledOnce();
});
it('requires the new shape to be the only selected object before resizing', () => {
  const f = fixture();
  f.controller.selectedObjects.push(f.original);
  expect(() => positionSlideText(f.size, [f.original], f.added, f.controller, f.apply, f.recalculate)).toThrow(
    'could not be verified',
  );
  expect(f.apply).not.toHaveBeenCalled();
});
it('rejects native geometry that does not follow the requested position', () => {
  const f = fixture();
  const apply = vi.fn();
  expect(() => positionSlideText(f.size, [f.original], f.added, f.controller, apply, f.recalculate)).toThrow(
    'could not be verified',
  );
});
it('does not resize when original bounds are unknown', () => {
  const f = fixture();
  expect(() => positionSlideText(f.size, [{}], f.added, f.controller, f.apply, f.recalculate)).toThrow(
    'could not be verified',
  );
  expect(f.apply).not.toHaveBeenCalled();
});
it('detects an unintended original-shape geometry change', () => {
  const f = fixture();
  const apply = (properties: Parameters<typeof f.apply>[0]) => {
    f.apply(properties);
    f.original.bounds.l = 10;
  };
  expect(() => positionSlideText(f.size, [f.original], f.added, f.controller, apply, f.recalculate)).toThrow(
    'could not be verified',
  );
});
