import { expect, it } from 'vitest';
import { findSlideTextPlacement } from '../../lib/agent-plugin/slide-text-layout';

it('uses proportional margins on different slide sizes', () => {
  expect(findSlideTextPlacement({ width: 340, height: 190 }, [], { width: 220, height: 30 })).toEqual({
    x: 10.2,
    y: 5.7,
    width: 220,
    height: 30,
  });
  expect(findSlideTextPlacement({ width: 190, height: 340 }, [], { width: 100, height: 30 })).toEqual({
    x: 5.7,
    y: 10.2,
    width: 100,
    height: 30,
  });
});
it('places text below title and subtitle bounds without overlap', () => {
  const placed = findSlideTextPlacement(
    { width: 340, height: 190 },
    [
      { x: 0, y: 0, width: 340, height: 95 },
      { x: 0, y: 100, width: 340, height: 45 },
    ],
    { width: 220, height: 25 },
  );
  expect(placed).toEqual({ x: 10.2, y: 148.8, width: 220, height: 25 });
});
it('uses a side gap when vertical space is unavailable', () => {
  expect(
    findSlideTextPlacement({ width: 340, height: 190 }, [{ x: 0, y: 0, width: 170, height: 190 }], {
      width: 140,
      height: 100,
    }),
  ).toEqual({ x: 173.8, y: 5.7, width: 140, height: 100 });
});
it('does not shrink text or place it outside a full slide', () => {
  expect(
    findSlideTextPlacement({ width: 340, height: 190 }, [{ x: 0, y: 0, width: 340, height: 190 }], {
      width: 100,
      height: 30,
    }),
  ).toBeUndefined();
  expect(findSlideTextPlacement({ width: 340, height: 190 }, [], { width: 350, height: 30 })).toBeUndefined();
});
it('rejects uncertain geometry rather than treating it as empty space', () => {
  for (const value of [NaN, Infinity, -1, 0]) {
    expect(findSlideTextPlacement({ width: value, height: 190 }, [], { width: 100, height: 30 })).toBeUndefined();
  }
  expect(
    findSlideTextPlacement({ width: 340, height: 190 }, [{ x: NaN, y: 0, width: 20, height: 20 }], {
      width: 100,
      height: 30,
    }),
  ).toBeUndefined();
  expect(
    findSlideTextPlacement({ width: 340, height: 190 }, [{ x: 0, y: 0, width: 0, height: 0 }], {
      width: 100,
      height: 30,
    }),
  ).toBeUndefined();
});
it('handles obstacles extending outside the slide', () => {
  expect(
    findSlideTextPlacement({ width: 340, height: 190 }, [{ x: -50, y: -20, width: 390, height: 100 }], {
      width: 220,
      height: 30,
    }),
  ).toEqual({ x: 10.2, y: 83.8, width: 220, height: 30 });
});

it('uses native recalculated bounds instead of unrotated dimensions', async () => {
  const { readSlideShapeBounds } = await import('../../lib/agent-plugin/slide-text-layout');
  const bounds = readSlideShapeBounds({ bounds: { l: 142.76, t: 68.68, r: 195.91, b: 121.83 } });
  expect(bounds).toMatchObject({ x: 142.76, y: 68.68 });
  expect(bounds?.width).toBeCloseTo(53.15);
  expect(bounds?.height).toBeCloseTo(53.15);
});
it('reads group bounds without flattening child coordinates', async () => {
  const { readSlideShapeBounds } = await import('../../lib/agent-plugin/slide-text-layout');
  expect(readSlideShapeBounds({ bounds: { l: 10, t: 20, r: 200, b: 160 } })).toEqual({
    x: 10,
    y: 20,
    width: 190,
    height: 140,
  });
});
it('rejects missing, zero and malformed native bounds', async () => {
  const { readSlideShapeBounds } = await import('../../lib/agent-plugin/slide-text-layout');
  for (const bounds of [
    undefined,
    { l: 0, t: 0, r: 0, b: 0 },
    { l: 10, t: 0, r: 5, b: 20 },
    { l: 0, t: 0, r: Infinity, b: 20 },
  ]) {
    expect(readSlideShapeBounds({ bounds })).toBeUndefined();
  }
});

it('uses a smaller vertical edge margin when measured text fits below native layout placeholders', () => {
  const placement = findSlideTextPlacement(
    { width: 338.6666666666667, height: 190.5 },
    [
      { x: 23.28333333333333, y: 10.14236111111111, width: 292.1, height: 36.821194444444444 },
      { x: 23.28333333333333, y: 50.711805555555564, width: 292.1, height: 120.87049999999999 },
    ],
    { width: 220.14333333333337, height: 10.17 },
  );
  expect(placement).toBeDefined();
  expect(placement!.y).toBeCloseTo(175.39230556);
  expect(placement!.y + placement!.height).toBeLessThanOrEqual(190.5 * 0.98);
});
