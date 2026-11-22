import { describe, expect, it } from 'vitest';
import {
  NEED_STYLE_ALL,
  NEED_STYLE_B,
  NEED_STYLE_BI,
  NEED_STYLE_I,
  NEED_STYLE_R,
  clampNeedStylesForFamily,
  needStylesByFamilyFromFontMap,
  styleFlagToNeedStyles,
} from '../../lib/onlyoffice/guards/font-loading';
import { fontSources } from '../../lib/onlyoffice/guards/x2t-worker';

describe('styleFlagToNeedStyles', () => {
  it.each([
    [0, NEED_STYLE_R],
    [1, NEED_STYLE_B],
    [2, NEED_STYLE_I],
    [3, NEED_STYLE_BI],
    [4, NEED_STYLE_R], // & 3 → 0
  ])('maps CreateFontMap Style %s to NeedStyles %s', (style, need) => {
    expect(styleFlagToNeedStyles(style)).toBe(need);
  });
});

describe('needStylesByFamilyFromFontMap', () => {
  it('ORs run styles per family and always keeps Regular', () => {
    const needs = needStylesByFamilyFromFontMap({
      Arial_0_11: { Name: 'Arial', Style: 0, Size: 11 },
      Arial_1_11: { Name: 'Arial', Style: 1, Size: 11 },
      'Times New Roman_2_12': { Name: 'Times New Roman', Style: 2, Size: 12 },
    });
    expect(needs.Arial).toBe(NEED_STYLE_R | NEED_STYLE_B);
    expect(needs['Times New Roman']).toBe(NEED_STYLE_R | NEED_STYLE_I);
  });

  it('treats theme-resolved name keys (value 1) as Regular-only', () => {
    const needs = needStylesByFamilyFromFontMap({
      Calibri: 1,
      '+mj-lt': 1,
    });
    expect(needs.Calibri).toBe(NEED_STYLE_R);
    expect(needs['+mj-lt']).toBeUndefined();
  });
});

describe('clampNeedStylesForFamily', () => {
  it('uses the known map entry when present and keeps Regular + Italic', () => {
    expect(clampNeedStylesForFamily(NEED_STYLE_ALL, NEED_STYLE_R | NEED_STYLE_B)).toBe(
      NEED_STYLE_R | NEED_STYLE_I | NEED_STYLE_B,
    );
  });

  it('keeps the vendor request for open-list extras not in CreateFontMap', () => {
    expect(clampNeedStylesForFamily(NEED_STYLE_ALL, undefined)).toBe(NEED_STYLE_ALL);
    expect(clampNeedStylesForFamily(undefined, undefined)).toBe(NEED_STYLE_ALL);
    expect(clampNeedStylesForFamily(0, undefined)).toBe(NEED_STYLE_ALL);
  });
});

describe('fontSources honors NeedStyles face bits', () => {
  function scope(needStyles: number) {
    return {
      location: { href: 'https://editor.test/web-apps/apps/documenteditor/main/index.html' },
      AscCommon: {
        g_font_loader: {
          fontFilesPath: '../../../../fonts/',
          fontFiles: [{ Id: '010' }, { Id: '011' }, { Id: '012' }, { Id: '013' }],
        },
      },
      AscFonts: {
        g_font_infos: [
          {
            Name: 'Arial',
            NeedStyles: needStyles,
            indexR: 0,
            indexI: 1,
            indexB: 2,
            indexBI: 3,
          },
        ],
      },
    } as unknown as Parameters<typeof fontSources>[0];
  }

  it('emits every face when NeedStyles is 15', () => {
    expect(fontSources(scope(NEED_STYLE_ALL)).map((s) => s.fileName)).toEqual([
      'Arial.ttf',
      'Arial_Bold.ttf',
      'Arial_Bold_Italic.ttf',
      'Arial_Italic.ttf',
    ]);
  });

  it('emits only Regular when NeedStyles is 1', () => {
    expect(fontSources(scope(NEED_STYLE_R)).map((s) => s.fileName)).toEqual(['Arial.ttf']);
  });

  it('emits Regular + Bold when NeedStyles is R|B', () => {
    expect(fontSources(scope(NEED_STYLE_R | NEED_STYLE_B)).map((s) => s.fileName)).toEqual([
      'Arial.ttf',
      'Arial_Bold.ttf',
    ]);
  });
});
