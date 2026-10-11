import { readSlideShapeText } from './slide-text-read';

/** Read shared native text items without the SDK GetText Unicode/tab conversion. */
export function readWordBodyText(document: unknown): string | undefined {
  try {
    const logic = document as {
      Content?: Array<{ GetAllParagraphs?(options: object, target: unknown[]): void }>;
      GetAllParagraphs?(options: object): unknown[];
      GetText?(): string;
    };
    if (typeof logic.GetAllParagraphs !== 'function') return logic.GetText?.();
    // CDocument.GetAllParagraphs can return AllParagraphsList left over from a delete/Undo.
    // Walk the current main-body elements through their native reader without changing SDK caches.
    const paragraphs: unknown[] = [];
    if (Array.isArray(logic.Content)) {
      for (const element of logic.Content) {
        if (typeof element.GetAllParagraphs !== 'function') return undefined;
        element.GetAllParagraphs({ All: true }, paragraphs);
      }
    } else {
      const legacy = logic.GetAllParagraphs({ OnlyMainDocument: true, All: true });
      if (!Array.isArray(legacy)) return undefined;
      paragraphs.push(...legacy);
    }
    if (!Array.isArray(paragraphs)) return undefined;
    return readSlideShapeText({ getDocContent: () => ({ Content: paragraphs, GetText: () => '' }) });
  } catch {
    return undefined;
  }
}

export function readWordRunText(run: { Type?: number; Content?: unknown[]; GetText(): string }): string | undefined {
  if (run.Type === undefined) return run.GetText(); // legacy adapters without native items
  if (run.Type !== 39 || !Array.isArray(run.Content)) return undefined;
  return readSlideShapeText({ getDocContent: () => ({ Content: [{ Content: [run] }], GetText: () => '' }) });
}
