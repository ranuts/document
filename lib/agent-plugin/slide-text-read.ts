export interface SlideTextShape {
  getText?(): string | undefined;
  getDocContent?():
    | {
        Content?: unknown[];
        GetText(options: Record<string, never>): string;
        GetSelectedText?(clear: boolean, options: { TabSymbol: string; Numbering: boolean }): string | null;
      }
    | undefined;
}

interface TextNode {
  Type?: number;
  Content?: unknown[];
  Selection?: { Use?: boolean; StartPos?: number; EndPos?: number };
  GetCodePoint?(): number;
}

function readCharacter(node: TextNode): string | undefined {
  if (node.Type === 1 || node.Type === 2) {
    const codePoint = node.GetCodePoint?.();
    if (
      !Number.isInteger(codePoint) ||
      codePoint! < 0 ||
      codePoint! > 0x10ffff ||
      (codePoint! >= 0xd800 && codePoint! <= 0xdfff)
    )
      return undefined;
    return String.fromCodePoint(codePoint!);
  }
  if (node.Type === 4) return '\r\n';
  if (node.Type === 16) return '\r';
  if (node.Type === 21) return '\t';
  return undefined;
}

/** Native GetText truncates supplementary Unicode and replaces tabs with spaces.
 * Decode supported plain-text items directly; unknown structures remain unverifiable.
 */
export function readSlideShapeText(shape: SlideTextShape): string | undefined {
  try {
    const content = shape.getDocContent?.();
    if (!content?.Content) return content?.GetText({}) ?? shape.getText?.();
    let text = '';
    const read = (items: unknown[]): boolean => {
      for (const item of items) {
        if (!item || typeof item !== 'object') return false;
        const node = item as TextNode;
        if (node.Type === 71) continue; // zero-width native bookmark
        if (node.Type === 39 || node.Type === 48) {
          if (!Array.isArray(node.Content) || !read(node.Content)) return false;
        } else {
          const character = readCharacter(node);
          if (character === undefined) return false;
          text += character;
        }
      }
      return true;
    };
    for (const paragraph of content.Content) {
      if (!paragraph || typeof paragraph !== 'object') return undefined;
      const items = (paragraph as { Content?: unknown[] }).Content;
      if (!Array.isArray(items) || !read(items)) return undefined;
    }
    return text;
  } catch {
    return undefined;
  }
}

/** Capture offsets from native run selections, so repeated text is unambiguous.
 * Offsets use UTF-16 in the returned LF-normalized text, including supplementary characters.
 */
export function readSlideTextSelection(
  shape: SlideTextShape,
): { text: string; selectedText: string; start: number; end: number } | undefined {
  try {
    const content = shape.getDocContent?.();
    if (!Array.isArray(content?.Content) || !content.GetSelectedText) return undefined;
    let text = '',
      start: number | undefined,
      end: number | undefined;
    const read = (items: unknown[]): boolean => {
      for (const item of items) {
        if (!item || typeof item !== 'object') return false;
        const node = item as TextNode;
        if (node.Type === 71) continue;
        if (node.Type === 48) {
          if (!Array.isArray(node.Content) || !read(node.Content)) return false;
          continue;
        }
        if (node.Type !== 39 || !Array.isArray(node.Content)) return false;
        const selection = node.Selection;
        let first = 0,
          last = 0;
        if (selection?.Use) {
          if (!Number.isInteger(selection.StartPos) || !Number.isInteger(selection.EndPos)) return false;
          first = Math.min(selection.StartPos!, selection.EndPos!);
          last = Math.max(selection.StartPos!, selection.EndPos!);
          if (first < 0 || last > node.Content.length) return false;
        }
        for (let index = 0; index < node.Content.length; index++) {
          const character = node.Content[index];
          if (!character || typeof character !== 'object') return false;
          const raw = readCharacter(character as TextNode);
          if (raw === undefined) return false;
          const value = raw.replace(/\r\n?/g, '\n');
          if (index >= first && index < last) {
            if (end !== undefined && end !== text.length) return false;
            start ??= text.length;
            end = text.length + value.length;
          }
          text += value;
        }
      }
      return true;
    };
    for (const paragraph of content.Content) {
      if (!paragraph || typeof paragraph !== 'object') return undefined;
      const items = (paragraph as TextNode).Content;
      if (!Array.isArray(items) || !read(items)) return undefined;
    }
    if (start === undefined || end === undefined || start === end) return undefined;
    const selectedText = text.slice(start, end);
    const native = content.GetSelectedText(false, { TabSymbol: '\t', Numbering: false });
    if (typeof native !== 'string' || native.replace(/\r\n?/g, '\n') !== selectedText) return undefined;
    return { text, selectedText, start, end };
  } catch {
    return undefined;
  }
}
