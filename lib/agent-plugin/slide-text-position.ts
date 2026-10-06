import { findSlideTextPlacement, readSlideShapeBounds, type SlideTextBounds } from './slide-text-layout';
interface Shape {
  bounds?: { l: number; t: number; r: number; b: number };
}

/** Runs inside the caller's owned native history group, which rolls back any failure. */
export function positionSlideText(
  size: { width: number; height: number },
  originals: readonly Shape[],
  added: Shape,
  controller: { selectedObjects?: Shape[] },
  apply: (properties: { Width?: number; Position?: { X: number; Y: number } }) => void,
  recalculate: () => void,
): SlideTextBounds {
  const unverified = () => {
    throw new Error('Document change could not be verified');
  };
  const selected = () => controller.selectedObjects?.length === 1 && controller.selectedObjects[0] === added;
  const occupied = originals.map(readSlideShapeBounds);
  if (
    !selected() ||
    occupied.some((box) => !box) ||
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  )
    return unverified();
  apply({ Width: size.width * 0.65 });
  recalculate();
  const measured = readSlideShapeBounds(added);
  if (!selected() || !measured) return unverified();
  const placement = findSlideTextPlacement(size, occupied as SlideTextBounds[], measured);
  if (!placement) throw new Error('No free text area');
  apply({ Position: { X: placement.x, Y: placement.y } });
  recalculate();
  const actual = readSlideShapeBounds(added);
  // Native drawing properties can round millimetres to hundredths.
  const tolerance = 0.02;
  if (
    !selected() ||
    !actual ||
    (['x', 'y', 'width', 'height'] as const).some((key) => Math.abs(actual[key] - placement[key]) > tolerance)
  )
    return unverified();
  const gap = Math.min(size.width, size.height) * 0.02;
  if (
    actual.x < size.width * 0.03 - tolerance ||
    actual.y < size.height * 0.02 - tolerance ||
    actual.x + actual.width > size.width * 0.97 + tolerance ||
    actual.y + actual.height > size.height * 0.98 + tolerance
  )
    return unverified();
  for (let index = 0; index < originals.length; index++) {
    const before = occupied[index]!,
      after = readSlideShapeBounds(originals[index]);
    if (!after || (['x', 'y', 'width', 'height'] as const).some((key) => Math.abs(after[key] - before[key]) > 1e-7))
      return unverified();
    if (
      actual.x < before.x + before.width + gap - tolerance &&
      actual.x + actual.width > before.x - gap + tolerance &&
      actual.y < before.y + before.height + gap - tolerance &&
      actual.y + actual.height > before.y - gap + tolerance
    )
      return unverified();
  }
  return actual;
}
