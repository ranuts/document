import { readSlideShapeText } from './slide-text-read';

/** Read shared native text items without the SDK GetText Unicode/tab conversion. */
export function readWordBodyText(document: unknown): string | undefined {
  try {
    const logic = document as { GetAllParagraphs?(options: object): unknown[]; GetText?(): string };
    if (typeof logic.GetAllParagraphs !== 'function') return logic.GetText?.();
    const paragraphs = logic.GetAllParagraphs({ OnlyMainDocument: true, All: true });
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
