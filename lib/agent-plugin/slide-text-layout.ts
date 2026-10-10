export interface SlideTextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Find room for measured text without changing its size or moving existing content.
 * Callers must supply recalculated, axis-aligned bounds (including rotation/groups).
 * Unknown or unmeasured geometry cannot prove that a location is free.
 */
export function findSlideTextPlacement(
  slide: { width: number; height: number },
  occupied: readonly SlideTextBounds[],
  text: { width: number; height: number },
): SlideTextBounds | undefined {
  const positive = (value: number) => Number.isFinite(value) && value > 0;
  if (![slide.width, slide.height, text.width, text.height].every(positive)) return;
  if (
    occupied.some(
      (box) => !Number.isFinite(box.x) || !Number.isFinite(box.y) || !positive(box.width) || !positive(box.height),
    )
  )
    return;
  const round = (value: number) => Math.round(value * 1e8) / 1e8;
  const marginX = round(slide.width * 0.03);
  const gap = round(Math.min(slide.width, slide.height) * 0.02);
  const xs = [...new Set([marginX, ...occupied.map((box) => round(box.x + box.width + gap))])].sort((a, b) => a - b);
  // Prefer the regular inset; allow a modest vertical fallback before rejecting.
  for (const ratio of [0.03, 0.02]) {
    const marginY = round(slide.height * ratio);
    const ys = [...new Set([marginY, ...occupied.map((box) => round(box.y + box.height + gap))])].sort((a, b) => a - b);
    const epsilon = 1e-7;
    for (const y of ys) {
      for (const x of xs) {
        if (
          x < marginX - epsilon ||
          y < marginY - epsilon ||
          x + text.width > slide.width - marginX + epsilon ||
          y + text.height > slide.height - marginY + epsilon
        )
          continue;
        const collides = occupied.some(
          (box) =>
            x < box.x + box.width + gap - epsilon &&
            x + text.width > box.x - gap + epsilon &&
            y < box.y + box.height + gap - epsilon &&
            y + text.height > box.y - gap + epsilon,
        );
        if (!collides) return { x, y, width: text.width, height: text.height };
      }
    }
  }
}

/** Read the SDK's recalculated drawing bounds, which include rotation and groups.
 * Do not fall back to x/y/extX/extY: those can miss visible rotated content.
 */
export function readSlideShapeBounds(shape: {
  bounds?: { l: number; t: number; r: number; b: number };
}): SlideTextBounds | undefined {
  const bounds = shape.bounds;
  if (!bounds || ![bounds.l, bounds.t, bounds.r, bounds.b].every(Number.isFinite)) return;
  const width = bounds.r - bounds.l;
  const height = bounds.b - bounds.t;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  return { x: bounds.l, y: bounds.t, width, height };
}
