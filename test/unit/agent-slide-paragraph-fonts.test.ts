import { expect, it } from 'vitest';
import { preserveSlideParagraphEndFonts } from '../../lib/agent-plugin/slide-paragraph-fonts';

function paragraph(text: string, family: string) {
  const fonts = { EastAsia: { Name: family }, Copy: () => ({ EastAsia: { Name: family } }) };
  const value = { fonts: {} as unknown };
  return {
    Content: [
      { Type: 39, Content: [...text].map((c) => ({ Type: 1, GetCodePoint: () => c.codePointAt(0)! })) },
      { Type: 39, Content: [{ Type: 4 }], Get_CompiledPr: () => ({ RFonts: fonts }) },
    ],
    TextPr: {
      Set_RFonts: (fonts: unknown) => {
        value.fonts = fonts;
      },
    },
    Recalc_CompiledPr: () => {},
    value,
  };
}
function shape(paragraphs: unknown[]) {
  return { getDocContent: () => ({ Content: paragraphs, GetText: () => 'unused' }) };
}

it('preserves fonts through the paragraph-end owner only for newly inserted separators', () => {
  const first = paragraph('A😀', 'Arial'),
    second = paragraph('B', 'Keep');
  preserveSlideParagraphEndFonts(shape([first, second]), 3, 4);
  expect(first.value.fonts).toEqual({ EastAsia: { Name: 'Arial' } });
  expect(second.value.fonts).toEqual({});
  expect(first.Content[1].Get_CompiledPr!().RFonts.EastAsia.Name).toBe('Arial');
});

it('validates every selected paragraph end before making any font change', () => {
  const first = paragraph('A', 'Arial'),
    second = paragraph('B', 'Keep');
  const invalid = { ...second, TextPr: undefined };
  expect(() => preserveSlideParagraphEndFonts(shape([first, invalid]), 0, 4)).toThrow();
  expect(first.value.fonts).toEqual({});
});

it('leaves an original paragraph end untouched when replacement has no new separator', () => {
  const first = paragraph('Alpha', 'Keep');
  preserveSlideParagraphEndFonts(shape([first]), 0, 5);
  expect(first.value.fonts).toEqual({});
});

it('declines malformed ranges and unknown native text before changing fonts', () => {
  const first = paragraph('A', 'Arial');
  expect(() => preserveSlideParagraphEndFonts(shape([first]), -1, 2)).toThrow();
  expect(() => preserveSlideParagraphEndFonts(shape([first]), 0, 20)).toThrow();
  expect(() => preserveSlideParagraphEndFonts(shape([first, { Content: [{ Type: 999 }] }]), 0, 2)).toThrow();
  expect(first.value.fonts).toEqual({});
});
