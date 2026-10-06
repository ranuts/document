export interface SlideDrawing {
  bounds?: { l: number; t: number; r: number; b: number };
  isPlaceholder?(): boolean;
}
interface DrawingLayer {
  cSld: { spTree: SlideDrawing[] };
  recalculate?(): void;
}
export interface InheritedSlide {
  Layout?: DrawingLayer & { Master?: DrawingLayer };
  needMasterSpDraw?(): boolean;
  needLayoutSpDraw?(): boolean;
}
/** Match the SDK's drawBgMasterAndLayout / drawNoPlaceholdersShapesOnly visibility. */
export function inheritedSlideShapes(slide: InheritedSlide, hidden?: (shape: SlideDrawing) => boolean): SlideDrawing[] {
  if (!slide.Layout) return [];
  const fail = (): never => {
    throw new Error('Document change could not be verified');
  };
  if (
    typeof slide.needMasterSpDraw !== 'function' ||
    typeof slide.needLayoutSpDraw !== 'function' ||
    typeof hidden !== 'function'
  )
    return fail();
  const layers = [
    ...(slide.needMasterSpDraw() ? [slide.Layout.Master] : []),
    ...(slide.needLayoutSpDraw() ? [slide.Layout] : []),
  ];
  const result: SlideDrawing[] = [];
  for (const layer of layers) {
    if (!layer || !Array.isArray(layer.cSld?.spTree) || typeof layer.recalculate !== 'function') return fail();
    layer.recalculate();
    for (const shape of layer.cSld.spTree) {
      if (hidden(shape)) continue;
      if (typeof shape.isPlaceholder !== 'function') return fail();
      if (!shape.isPlaceholder()) result.push(shape);
    }
  }
  return result;
}
