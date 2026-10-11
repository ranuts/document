import type { AgentTool } from '@ranuts/agent-core/types';
import { requireEditorContext, getEditorContext, type EditorApi } from './editor-bridge';
import { withBlockingEditorAction } from './editor-action';
import { preserveNativeRedo } from './native-redo';
import { readSlideShapeText, type SlideTextShape } from './slide-text-read';
import { getReadonlyMode } from '../onlyoffice/readonly';

interface Paragraph {
  AddText(text: string): void;
  /** The bundled Office API uses half-points. */
  SetFontSize(size: number): void;
  SetBold(value: boolean): void;
  SetColor(color: unknown): void;
}
interface Shape {
  Drawing: Omit<SlideTextShape, 'getDocContent'> & {
    recalculate(): void;
    getTextRect(): { l: number; t: number; r: number; b: number };
    getDocContent(): { GetText(options: Record<string, never>): string; GetSummaryHeight(): number };
  };
  SetPosition(x: number, y: number): void;
  SetVerticalTextAlign(value: 'top'): void;
  SetPaddings(left: number, top: number, right: number, bottom: number): void;
  GetDocContent(): {
    RemoveAllElements(): void;
    GetElement(index: number): Paragraph | null;
    Push(paragraph: Paragraph): boolean;
  };
}
interface Slide {
  cSld: { spTree: SlideTextShape[] };
}
interface BuilderSlide {
  Slide: Slide;
  RemoveAllObjects(): void;
  AddObject(shape: Shape): boolean;
}
/** Narrow surface of the bundled ONLYOFFICE presentation Office API.
 * Keep construction here; model tools cannot supply native objects or geometry.
 */
export interface PresentationBuilder {
  CreateSlide(): BuilderSlide;
  CreateNoFill(): unknown;
  ThemeColor(name: 'tx1'): unknown;
  CreateStroke(width: number, fill: unknown): unknown;
  CreateShape(type: 'rect', width: number, height: number, fill: unknown, stroke: unknown): Shape;
  CreateParagraph(): Paragraph;
  GetPresentation(): { AddSlide(slide: BuilderSlide): void };
}
interface PresentationApi extends EditorApi {
  canEdit?(): boolean;
  isSlideShow?(): boolean;
  isLongAction?(): boolean;
  sync_StartAction?(type: number, action: number): void;
  sync_EndAction?(type: number, action: number): void;
  WordControl?: {
    m_oLogicDocument?: {
      Slides: Slide[];
      IsMasterMode(): boolean;
      CanEdit?(): boolean;
      GetWidthMM(): number;
      GetHeightMM(): number;
      Recalculate(data?: { Drawings: { All: boolean; Map: Record<string, never> } }): void;
      Document_UpdateInterfaceState?(): void;
    };
  };
}
const unverified = () => new Error('Document change could not be verified');

export const createSlideTool: AgentTool<
  { title: string; body: string },
  { count: number; page: number; added: number; verified: true }
> = {
  name: 'create_slide',
  description:
    'Presentation only. Append slides with a separate title and body; long content is fitted or split across readable pages, preserving existing slides. Use for a requested new slide containing both title and body, instead of adding a blank slide and merging both into one text box. Native layout, verified contents, one Undo. Does not edit existing slides or masters.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 500 },
      body: { type: 'string', minLength: 1, maxLength: 4000 },
    },
    required: ['title', 'body'],
    additionalProperties: false,
  },
  readOnlyHint: false,
  execute: async ({ title, body }, signal) => {
    signal?.throwIfAborted();
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.length > 500 ||
      typeof body !== 'string' ||
      !body.trim() ||
      body.length > 4000
    )
      throw new Error('Invalid document tool parameters');
    const context = requireEditorContext();
    const api = context.api as PresentationApi,
      logic = api.WordControl?.m_oLogicDocument;
    if (getReadonlyMode() || api.isViewMode || api.canEdit?.() === false || logic?.CanEdit?.() === false)
      throw new Error('Document is read-only');
    if (!api.isDocumentLoadComplete || !api.isLoadFullApi) throw new Error('Editor is still loading');
    const builder = context.presentationBuilder,
      history = context.AscCommon?.History;
    if (!logic?.Slides || logic.IsMasterMode?.() !== false || api.isSlideShow?.() === true || !builder)
      throw new Error('officePresentationOnly');
    const width = logic.GetWidthMM?.(),
      height = logic.GetHeightMM?.();
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 50 ||
      height < 50 ||
      typeof logic.Recalculate !== 'function'
    )
      throw new Error('officePresentationOnly');
    if (
      !history ||
      !Array.isArray(history.Points) ||
      !Number.isInteger(history.Index) ||
      !history.startGroupPoints ||
      !history.endGroupPoints ||
      !history.cancelGroupPoints ||
      !history._getLongPointIndex
    )
      throw new Error('Editor history API is unavailable');
    if (history._getLongPointIndex!() !== -1) throw new Error('Editor is busy');
    const block = context.Asc.c_oAscAsyncActionType?.BlockInteraction;
    const apply = context.Asc.c_oAscAsyncAction?.ApplyChanges;
    if (block === undefined || apply === undefined) throw new Error('Editor action API is unavailable');
    const sameDocument = () =>
      getEditorContext()?.api === api &&
      getEditorContext()?.AscCommon?.History === history &&
      api.WordControl?.m_oLogicDocument === logic;
    return withBlockingEditorAction(api, { BlockInteraction: block, ApplyChanges: apply }, async () => {
      signal?.throwIfAborted();
      if (!sameDocument()) throw new Error('agentPlanExpired');
      const originals = [...logic.Slides],
        beforeIndex = history.Index,
        beforePoints = [...history.Points];
      const redo = preserveNativeRedo(history, sameDocument);
      let marker: (typeof history.Points)[number] | undefined;
      const ownsGroup = () =>
        sameDocument() &&
        history.Index === beforeIndex + 1 &&
        history.Points[beforeIndex + 1] === marker &&
        history._getLongPointIndex?.() === beforeIndex + 1;
      try {
        history.startGroupPoints!();
        marker = history.Points[beforeIndex + 1];
        if (!marker || !ownsGroup()) throw unverified();
        const normalize = (text: string) => text.replace(/\r\n?/g, '\n');
        const pages: Array<{ slide: BuilderSlide; title: Shape; body: Shape; text: string }> = [];
        const candidate = (text: string, size: number) => {
          const slide = builder.CreateSlide();
          slide.RemoveAllObjects();
          const addText = (value: string, top: number, boxHeight: number, font: number, bold: boolean) => {
            const shape = builder.CreateShape(
              'rect',
              width * 0.84 * 36000,
              boxHeight * 36000,
              builder.CreateNoFill(),
              builder.CreateStroke(0, builder.CreateNoFill()),
            );
            shape.SetPosition(width * 0.08 * 36000, top * 36000);
            shape.SetVerticalTextAlign('top');
            shape.SetPaddings(0, 0, 0, 0);
            const content = shape.GetDocContent();
            content.RemoveAllElements();
            const paragraphs: Paragraph[] = [];
            for (const [index, line] of normalize(value).split('\n').entries()) {
              const paragraph = index === 0 ? content.GetElement(0) : builder.CreateParagraph();
              if (!paragraph) throw unverified();
              paragraph.AddText(line);
              paragraph.SetFontSize(font * 2);
              paragraph.SetBold(bold);
              paragraph.SetColor(builder.ThemeColor('tx1'));
              if (index > 0 && !content.Push(paragraph)) throw unverified();
              paragraphs.push(paragraph);
            }
            if (!slide.AddObject(shape)) throw unverified();
            return { shape, paragraphs };
          };
          const heading = addText(title, height * 0.08, height * 0.2, 28, true);
          const contents = addText(text, height * 0.33, height * 0.59, size, false);
          const fits = (shape: Shape) => {
            shape.Drawing.recalculate();
            const rect = shape.Drawing.getTextRect(),
              actual = shape.Drawing.getDocContent().GetSummaryHeight();
            if (!Number.isFinite(actual) || actual <= 0 || !Number.isFinite(rect.b - rect.t)) throw unverified();
            return actual <= rect.b - rect.t + 0.01;
          };
          for (const font of [28, 24, 20, 18]) {
            heading.paragraphs.forEach((paragraph) => paragraph.SetFontSize(font * 2));
            if (fits(heading.shape)) break;
            if (font === 18) throw new Error('agentSlideTitleTooLong');
          }
          return { slide, title: heading.shape, body: contents.shape, text, fits: fits(contents.shape) };
        };
        let remaining = normalize(body);
        while (remaining.length) {
          signal?.throwIfAborted();
          if (!ownsGroup()) throw new Error('agentPlanExpired');
          if (pages.length >= 20) throw new Error('agentSlideContentTooLong');
          let page = candidate(remaining, 18);
          for (const size of pages.length ? [] : [16, 14]) {
            if (page.fits) break;
            page = candidate(remaining, size);
          }
          if (!page.fits) {
            // Fit by the native engine, not guessed character widths. Split only
            // at code-point boundaries; preserve separators and every character.
            const characters = Array.from(remaining);
            let low = 1,
              high = characters.length,
              best = 0;
            while (low <= high) {
              const mid = Math.floor((low + high) / 2);
              const probe = candidate(characters.slice(0, mid).join(''), 18);
              if (probe.fits) {
                best = mid;
                low = mid + 1;
              } else high = mid - 1;
            }
            if (!best) throw new Error('agentSlideContentTooLong');
            const paragraphEnd = characters.slice(0, best).lastIndexOf('\n');
            if (paragraphEnd >= Math.floor(best * 0.5)) best = paragraphEnd + 1;
            else
              for (let boundary = best - 1; boundary >= Math.floor(best * 0.7); boundary--) {
                if (/\s/u.test(characters[boundary])) {
                  best = boundary + 1;
                  break;
                }
              }
            page = candidate(characters.slice(0, best).join(''), 18);
            if (!page.fits) throw unverified();
          }
          pages.push(page);
          remaining = remaining.slice(page.text.length);
        }
        for (const page of pages) builder.GetPresentation().AddSlide(page.slide);
        logic.Recalculate({ Drawings: { All: true, Map: {} } });
        signal?.throwIfAborted();
        if (
          !ownsGroup() ||
          logic.Slides.length !== originals.length + pages.length ||
          originals.some((original, index) => logic.Slides[index] !== original) ||
          pages.some(
            (page, index) =>
              logic.Slides[originals.length + index] !== page.slide.Slide ||
              page.slide.Slide.cSld.spTree.length !== 2 ||
              [page.title, page.body].some(
                (shape) =>
                  shape.Drawing.getDocContent().GetSummaryHeight() >
                  shape.Drawing.getTextRect().b - shape.Drawing.getTextRect().t + 0.01,
              ) ||
              !page.slide.Slide.cSld.spTree.includes(page.title.Drawing) ||
              !page.slide.Slide.cSld.spTree.includes(page.body.Drawing) ||
              normalize(readSlideShapeText(page.title.Drawing) ?? '') !== `${normalize(title)}\n` ||
              normalize(readSlideShapeText(page.body.Drawing) ?? '') !== `${page.text}\n`,
          ) ||
          pages.map((page) => page.text).join('') !== normalize(body)
        )
          throw unverified();
        history.endGroupPoints!();
        if (
          !sameDocument() ||
          history.Index !== beforeIndex + 1 ||
          history.Points[beforeIndex + 1] !== marker ||
          history._getLongPointIndex!() !== -1
        )
          throw unverified();
        redo.discard();
        logic.Document_UpdateInterfaceState?.();
        return { count: logic.Slides.length, page: originals.length + 1, added: pages.length, verified: true };
      } catch (error) {
        // Never undo another action. A native group opening can fail after creating its marker.
        marker ??= history.Points[beforeIndex + 1];
        if (
          ownsGroup() &&
          beforePoints.slice(0, beforeIndex + 1).every((point, index) => history.Points[index] === point)
        ) {
          history.cancelGroupPoints!();
          logic.Recalculate({ Drawings: { All: true, Map: {} } });
        }
        redo.restore();
        if (sameDocument()) logic.Document_UpdateInterfaceState?.();
        throw error;
      }
    });
  },
};
