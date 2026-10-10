import { readWordRunText } from './word-text-read';

/** Verify exactly one plain-text replacement without moving the SDK selection. */
export interface ReviewCharacter {
  text: string;
  reviewType: number;
  marker?: object;
  paragraphEnd?: boolean;
  selected?: boolean;
}

/** Read main-body text without changing selection or accepting/rejecting revisions. */
export function captureReviewCharacters(document: unknown): ReviewCharacter[] | undefined {
  try {
    const logic = document as {
      GetAllParagraphs(options: object): Array<{
        Selection?: { Use: boolean; StartPos: number; EndPos: number };
        Content: Array<{
          Type?: number;
          Content?: unknown[];
          Selection?: { Use: boolean; StartPos: number; EndPos: number };
          GetText(): string;
          GetReviewType(): number;
        }>;
      }>;
    };
    const result: ReviewCharacter[] = [];
    for (const paragraph of logic.GetAllParagraphs({ OnlyMainDocument: true, All: true })) {
      for (const [runIndex, run] of paragraph.Content.entries()) {
        // Native para_Bookmark (71) has no text. Preserve its position and identity.
        if (run.Type === 71) {
          const selection = paragraph.Selection;
          const selected =
            !!selection?.Use &&
            runIndex >= Math.min(selection.StartPos, selection.EndPos) &&
            runIndex <= Math.max(selection.StartPos, selection.EndPos);
          result.push({ text: '', reviewType: 0, marker: run, selected });
          continue;
        }
        if (typeof run.GetText !== 'function' || typeof run.GetReviewType !== 'function') return undefined;
        const reviewType = run.GetReviewType();
        if (![0, 1, 2].includes(reviewType)) return undefined;
        const raw = readWordRunText(run);
        if (raw === undefined) return undefined;
        const chars = [...raw.replace(/\r\n?/g, '\n')];
        const selection = run.Selection;
        if (
          selection?.Use &&
          (!run.Content ||
            run.Content.length !== chars.length ||
            !Number.isInteger(selection.StartPos) ||
            !Number.isInteger(selection.EndPos) ||
            Math.min(selection.StartPos, selection.EndPos) < 0 ||
            Math.max(selection.StartPos, selection.EndPos) > chars.length)
        )
          return undefined;
        for (const [index, text] of chars.entries())
          result.push({
            text,
            reviewType,
            selected:
              !!selection?.Use &&
              index >= Math.min(selection.StartPos, selection.EndPos) &&
              index < Math.max(selection.StartPos, selection.EndPos),
            ...(index === chars.length - 1 && text === '\n' && raw.endsWith('\r\n') ? { paragraphEnd: true } : {}),
          });
      }
    }
    return result;
  } catch {
    return undefined;
  }
}

export function assertReviewSelection(before: ReviewCharacter[] | undefined, selected: string): void {
  if (before) {
    const actual = before.filter((c) => c.selected);
    if (
      actual.map((c) => c.text).join('') === selected.replace(/\r\n?/g, '\n') &&
      actual.every((c) => !c.marker && !c.paragraphEnd && [0, 2].includes(c.reviewType))
    )
      return;
  }
  throw new Error('wordTrackedSelectionUnsupported');
}

export function matchesTextEdit(
  before: string,
  after: string,
  selected: string,
  inserted: string,
  review?: { before: ReviewCharacter[]; after: ReviewCharacter[] },
): boolean {
  const normalize = (text: string) => text.replace(/\r\n?/g, '\n');
  before = normalize(before);
  after = normalize(after);
  selected = normalize(selected);
  inserted = normalize(inserted);
  if (review) {
    const previous = review.before,
      current = review.after;
    if (previous.map((c) => c.text).join('') !== before || current.map((c) => c.text).join('') !== after) return false;
    const equal = (a: ReviewCharacter, b: ReviewCharacter) =>
      a.text === b.text && a.reviewType === b.reviewType && a.marker === b.marker && a.paragraphEnd === b.paragraphEnd;
    let offset = 0;
    while (offset < Math.min(previous.length, current.length) && equal(previous[offset], current[offset])) offset++;
    if (offset === previous.length && current.length === previous.length && selected !== inserted) return false;
    const removed = [...selected],
      added = [...inserted];
    // Paragraph-ending selections need paragraph revision rules; soft breaks in added text retain type 2.
    let suffix = 0;
    while (
      suffix < Math.min(previous.length, current.length) &&
      equal(previous[previous.length - suffix - 1], current[current.length - suffix - 1])
    )
      suffix++;
    const actualStart = previous.findIndex((c) => c.selected);
    const earliest = actualStart >= 0 ? actualStart : Math.max(0, previous.length - removed.length - suffix);
    const latest = actualStart >= 0 ? actualStart : Math.min(offset, previous.length - removed.length);
    for (let start = earliest; start <= latest; start++) {
      const selection = previous.slice(start, start + removed.length);
      if (
        selection.some((c, i) => c.text !== removed[i] || c.marker || c.paragraphEnd || ![0, 2].includes(c.reviewType))
      )
        continue;
      const retained = selection.filter((c) => c.reviewType === 0).map((c) => ({ text: c.text, reviewType: 1 }));
      if (current.length !== previous.length - selection.length + retained.length + added.length) continue;
      const expected = [
        ...previous.slice(0, start),
        ...retained,
        ...added.map((text) => ({ text, reviewType: 2 })),
        ...previous.slice(start + selection.length),
      ];
      if (expected.length === current.length && expected.every((c, i) => equal(c, current[i]))) return true;
    }
    return false;
  }
  // PasteHtml replaces text while retaining the selected paragraph terminator.
  if (selected.endsWith('\n') && after.length === before.length - selected.length + inserted.length + 1)
    inserted += '\n';
  if (after.length !== before.length - selected.length + inserted.length) return false;
  let prefix = 0;
  while (prefix < Math.min(before.length, after.length) && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < Math.min(before.length, after.length) &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  )
    suffix++;
  const start = Math.max(0, before.length - selected.length - suffix);
  const end = Math.min(prefix, before.length - selected.length);
  for (let offset = start; offset <= end; offset++) {
    if (
      before.slice(offset, offset + selected.length) === selected &&
      after.slice(offset, offset + inserted.length) === inserted
    )
      return true;
  }
  return false;
}
