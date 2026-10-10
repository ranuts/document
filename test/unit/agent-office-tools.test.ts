import { beforeEach, expect, it, vi } from 'vitest';
import {
  getRangeTool,
  getRangesTool,
  sumRangeTool,
  sortRangeTool,
  slideActionTool,
  addSlideTextTool,
  replaceSlideText,
} from '../../lib/agent-plugin/office-tools';
const state = vi.hoisted(() => ({ api: {} as Record<string, unknown>, readonly: false, busy: false }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorApi: () => state.api,
  getEditorContext: () => ({
    api: state.api,
    Asc: { c_oAscAsyncActionType: { BlockInteraction: 1 }, c_oAscAsyncAction: { ApplyChanges: 9 } },
    AscDFH: { historydescription_GroupPoints: 200 },
    AscCommon: {
      c_oAscClipboardDataFormat: { Text: 1 },
      g_specialPasteHelper: state.api.pasteHelper,
      History: state.api.nativeHistory,
    },
  }),
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => state.readonly }));
beforeEach(() => {
  state.readonly = false;
  state.busy = false;
  state.api = {
    nativeHistory: (() => {
      let group = -1;
      const history = {
        Index: -1,
        Points: [] as Array<{ Items: unknown[]; Description?: number }>,
        StoredData: [] as Array<Array<{ Items: unknown[] }>>,
        SaveRedoPoints: vi.fn(() => {
          history.StoredData.push(history.Points.slice(history.Index + 1));
        }),
        PopRedoPoints: vi.fn(() => {
          const points = history.StoredData.pop()!;
          history.Points.length = history.Index + 1;
          history.Points.push(...points);
        }),
        _getLongPointIndex: () => (group >= 0 && history.Points[group]?.Description === 200 ? -1 : group),
        startGroupPoints: vi.fn(() => {
          group = ++history.Index;
          history.Points[group] = { Items: [] };
          history.Points.length = group + 1;
        }),
        endGroupPoints: vi.fn(() => {
          const marker = history.Points[group];
          if (marker) {
            marker.Description = 200;
            for (let index = group + 1; index < history.Points.length; index++)
              marker.Items.push(...history.Points[index].Items);
            history.Points.length = group + 1;
            history.Index = group;
          }
          group = -1;
        }),
        cancelGroupPoints: vi.fn(() => {
          history.Index = group - 1;
          history.Points.splice(group);
          group = -1;
          return [];
        }),
      };
      return history;
    })(),
    pasteHelper: {
      get Api() {
        return state.api;
      },
      Paste_Process_End: vi.fn(),
    },
    pre_Paste: (_fonts: unknown, _images: unknown, callback: () => void) => callback(),
    asc_PasteData: (
      _format: number,
      text: string,
      _a: undefined,
      _b: undefined,
      _c: undefined,
      done: (ok?: boolean) => void,
    ) => {
      (state.api.pre_Paste as (a: unknown, b: unknown, callback: () => void) => void)([], {}, () => {
        (state.api.pluginMethod_PasteText as (text: string) => void)(text);
        done(true);
      });
    },
    isDocumentLoadComplete: true,
    isLoadFullApi: true,
    isLongAction: () => state.busy,
    sync_StartAction: vi.fn(() => {
      state.busy = true;
    }),
    sync_EndAction: vi.fn(() => {
      state.busy = false;
    }),
  };
});
// The text/history tests share a native drawing fixture; geometry behavior has its own tests.
function installNativeSlideGeometry() {
  type Shape = { bounds?: { l: number; t: number; r: number; b: number } };
  const logic = (
    state.api.WordControl as
      | {
          m_oLogicDocument?: {
            Slides?: Array<{ cSld?: { spTree: Shape[] } }>;
            GetCurrentController?: () => { resetSelection(): void; selectedObjects?: Shape[] };
            GetWidthMM?: () => number;
            GetHeightMM?: () => number;
            Recalculate?: () => void;
          };
        }
      | undefined
  )?.m_oLogicDocument;
  const shapes = logic?.Slides?.[0]?.cSld?.spTree;
  if (!logic || !shapes || !logic.GetCurrentController) return;
  const controller = logic.GetCurrentController();
  Object.defineProperty(controller, 'selectedObjects', {
    configurable: true,
    get: () => (shapes.length ? [shapes.at(-1)] : []),
  });
  logic.GetCurrentController = () => controller;
  logic.GetWidthMM = () => 340;
  logic.GetHeightMM = () => 190;
  const recalculate = logic.Recalculate;
  logic.Recalculate = () => {
    recalculate?.();
    shapes.forEach((shape, index) => {
      shape.bounds ??= { l: 0, t: index * 35, r: 100, b: index * 35 + 25 };
    });
  };
  state.api.ImgApply = (properties: { Width?: number; Position?: { X: number; Y: number } }) => {
    logic.Recalculate!();
    const bounds = shapes.at(-1)!.bounds!;
    if (properties.Width !== undefined) bounds.r = bounds.l + properties.Width + 0.01;
    if (properties.Position) {
      const width = bounds.r - bounds.l,
        height = bounds.b - bounds.t;
      Object.assign(bounds, {
        l: properties.Position.X,
        t: properties.Position.Y,
        r: properties.Position.X + width,
        b: properties.Position.Y + height,
      });
    }
  };
}
function executeSlideTextInNativeFixture(input: { text: string }, signal?: AbortSignal) {
  installNativeSlideGeometry();
  return addSlideTextTool.execute(input, signal);
}

function selectedSlideFixture(selected = true) {
  const makeItems = (text: string) =>
    [...text].map((value) =>
      value === '\n'
        ? { Type: 4 }
        : value === '\t'
          ? { Type: 21 }
          : { Type: 1, GetCodePoint: () => value.codePointAt(0)! },
    );
  const makeParagraph = (text: string, selected = false) => {
    const fonts = { EastAsia: { Name: 'Arial' }, Copy: () => ({ EastAsia: { Name: 'Arial' } }) };
    const value = { RFonts: undefined as unknown };
    return {
      Content: [
        {
          Type: 39,
          Selection: { Use: selected, StartPos: 6, EndPos: 11 },
          Content: makeItems(text),
          Get_CompiledPr: () => ({ RFonts: fonts }),
        },
        {
          Type: 39,
          Selection: { Use: false, StartPos: 0, EndPos: 0 },
          Content: makeItems('\n'),
          Get_CompiledPr: () => ({ RFonts: fonts }),
        },
      ],
      TextPr: {
        Value: value,
        Set_RFonts: (fonts: unknown) => {
          value.RFonts = fonts;
        },
      },
      Recalc_CompiledPr: () => {},
    };
  };
  const content = {
    GetText: () => 'lossy',
    GetSelectedText: () => (selected ? 'Alpha' : ''),
    GetSelectionState: () => [{ start: 6, end: 11 }],
    Content: [makeParagraph('Alpha Alpha', selected)],
  };
  const shape = { getDocContent: () => content, bounds: { l: 0, t: 0, r: 100, b: 25 } };
  const neighbor = { getText: () => 'Keep', bounds: { l: 0, t: 35, r: 100, b: 60 } };
  const controller = { resetSelection: vi.fn(), getTargetDocContent: () => content };
  const logic = {
    Slides: [{ cSld: { spTree: [shape, neighbor] } }],
    IsMasterMode: () => false,
    GetCurrentController: () => controller,
  };
  state.api = {
    ...state.api,
    WordControl: { m_oLogicDocument: logic },
    getCurrentPage: () => 0,
    pluginMethod_PasteText: (text: string) => {
      content.Content = ('Alpha ' + text).split('\n').map((line) => makeParagraph(line));
    },
  };
  installNativeSlideGeometry();
  return { content, shape, neighbor, controller, logic };
}

it.each(['Alex 😀\tPayment', '第一行\n  第二行  '])(
  'replaces the captured second occurrence in a PPT text box with exact text: %s',
  async (text) => {
    const fixture = selectedSlideFixture();
    await expect(replaceSlideText(text)).resolves.toEqual({ page: 1, verified: true });
    expect(fixture.controller.resetSelection).not.toHaveBeenCalled();
    expect(fixture.logic.Slides[0].cSld.spTree).toEqual([fixture.shape, fixture.neighbor]);
  },
);

it('materializes inserted paragraph-end fonts within a PPT replacement without changing the original final end', async () => {
  const fixture = selectedSlideFixture();
  await replaceSlideText('First\nSecond');
  expect(fixture.content.Content[0].TextPr.Value.RFonts).toEqual({ EastAsia: { Name: 'Arial' } });
  expect(fixture.content.Content[1].TextPr.Value.RFonts).toBeUndefined();
});

it('rejects PPT replacement without an exact text selection before starting a native action', async () => {
  selectedSlideFixture(false);
  const paste = vi.fn();
  state.api.asc_PasteData = paste;
  await expect(replaceSlideText('Alex')).rejects.toThrow('No text selection');
  expect(paste).not.toHaveBeenCalled();
  expect(state.api.sync_StartAction).not.toHaveBeenCalled();
});

it('preserves a foreign edit made while PPT replacement waits for native preparation', async () => {
  const fixture = selectedSlideFixture();
  let insert: (() => void) | undefined;
  state.api.pre_Paste = (_fonts: unknown, _images: unknown, callback: () => void) => {
    insert = callback;
  };
  const history = state.api.nativeHistory as {
    Index: number;
    Points: Array<{ Items: unknown[] }>;
    cancelGroupPoints: ReturnType<typeof vi.fn>;
  };
  const outcome = replaceSlideText('Alex').catch((error) => error);
  const foreign = { Items: ['Foreign edit'] };
  history.Points.push(foreign);
  history.Index++;
  insert!();
  expect(await outcome).toBeInstanceOf(Error);
  expect(history.Points.at(-1)).toBe(foreign);
  expect((state.api.nativeHistory as { _getLongPointIndex(): number })._getLongPointIndex()).toBe(-1);
  expect(history.cancelGroupPoints).not.toHaveBeenCalled();
  expect(fixture.content.Content[0].Content[0].Content).toHaveLength(11);
  expect(state.busy).toBe(false);
});
it('verifies PPT inserted Unicode and tabs through native items rather than lossy GetText', async () => {
  const text = 'Alex 😀\tPayment';
  const shapes: unknown[] = [];
  const logic = {
    Slides: [{ cSld: { spTree: shapes } }],
    IsMasterMode: () => false,
    GetCurrentController: () => ({ resetSelection: vi.fn() }),
  };
  state.api = {
    ...state.api,
    WordControl: { m_oLogicDocument: logic },
    getCurrentPage: () => 0,
    pluginMethod_PasteText: () =>
      shapes.push({
        getDocContent: () => ({
          GetText: () => 'Alex \uf600 Payment\r\n',
          Content: [
            {
              Content: [
                {
                  Type: 39,
                  Content: [
                    ...[...text].map((c) =>
                      c === '\t' ? { Type: 21 } : { Type: 1, GetCodePoint: () => c.codePointAt(0)! },
                    ),
                    { Type: 4 },
                  ],
                },
              ],
            },
          ],
        }),
      }),
  };
  await expect(executeSlideTextInNativeFixture({ text })).resolves.toEqual({ page: 1, verified: true });
});
it('declines before paste when existing native text cannot be decoded for preservation checks', async () => {
  const existing = {
    getDocContent: () => ({
      GetText: () => 'Existing text',
      Content: [{ Content: [{ Type: 39, Content: [{ Type: 22 }] }] }],
    }),
  };
  const shapes = [existing];
  const logic = {
    Slides: [{ cSld: { spTree: shapes } }],
    IsMasterMode: () => false,
    GetCurrentController: () => ({ resetSelection: vi.fn() }),
  };
  const paste = vi.fn(() => {
    shapes.push({
      getDocContent: () => ({
        GetText: () => 'New\r\n',
        Content: [
          {
            Content: [
              {
                Type: 39,
                Content: [...[...'New'].map((c) => ({ Type: 1, GetCodePoint: () => c.codePointAt(0)! })), { Type: 4 }],
              },
            ],
          },
        ],
      }),
    });
  });
  state.api = {
    ...state.api,
    WordControl: { m_oLogicDocument: logic },
    getCurrentPage: () => 0,
    pluginMethod_PasteText: paste,
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New' })).rejects.toThrow('could not be verified');
  expect(paste).not.toHaveBeenCalled();
  expect(shapes).toEqual([existing]);
});
it.each([22, -1, 0xd800, 0x110000])(
  'rejects unsupported native text data despite a matching SDK string (%s)',
  async (value) => {
    vi.useFakeTimers();
    try {
      const shapes: unknown[] = [];
      const logic = {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      };
      state.api = {
        ...state.api,
        WordControl: { m_oLogicDocument: logic },
        getCurrentPage: () => 0,
        pluginMethod_PasteText: () =>
          shapes.push({
            getDocContent: () => ({
              GetText: () => 'Alex\r\n',
              Content: [
                {
                  Content: [
                    { Type: 39, Content: [{ Type: value === 22 ? 22 : 1, GetCodePoint: () => value }, { Type: 4 }] },
                  ],
                },
              ],
            }),
          }),
      };
      const rejected = expect(executeSlideTextInNativeFixture({ text: 'Alex' })).rejects.toThrow(
        'could not be verified',
      );
      await vi.runAllTimersAsync();
      await rejected;
    } finally {
      vi.useRealTimers();
    }
  },
);
it('sums numeric cells without writing or moving the selection', async () => {
  const find = vi.fn();
  const cells = [2, 3, null];
  state.api = {
    ...state.api,
    asc_findCell: find,
    wb: {
      getWorksheet: () => ({
        model: {
          getRange3: (r: number) => ({
            getNumberValue: () => cells[r],
            getValueData: () => ({ value: { type: 0 } }),
            getValue: () => String(cells[r] ?? ''),
            getFormula: () => '',
          }),
        },
      }),
    },
  };
  expect(await sumRangeTool.execute({ range: 'A1:A3' })).toEqual({ sum: 5, range: 'A1:A3', verified: true });
  expect(find).not.toHaveBeenCalled();
});
it('rejects invalid ranges and circular sum targets before writing', async () => {
  const paste = vi.fn();
  state.api.pluginMethod_PasteText = paste;
  await expect(sumRangeTool.execute({ range: 'A1:A3', target: 'A2' })).rejects.toThrow();
  await expect(sumRangeTool.execute({ range: 'A1:XFD1048576' })).rejects.toThrow();
  expect(paste).not.toHaveBeenCalled();
});
it('ignores Boolean and text cells as Excel SUM does', async () => {
  const cells = [
    { type: 2, number: 1 },
    { type: 0, number: 7 },
    { type: 1, number: null },
  ];
  state.api.wb = {
    getWorksheet: () => ({
      model: {
        getRange3: (r: number) => ({
          getValueData: () => ({ value: { type: cells[r].type } }),
          getNumberValue: () => cells[r].number,
          getFormula: () => '',
          getValue: () => '',
        }),
      },
    }),
  };
  expect(await sumRangeTool.execute({ range: 'A1:A3' })).toMatchObject({ sum: 7 });
});
it('rejects source formulas before writing SUM to avoid indirect circular references', async () => {
  const paste = vi.fn();
  state.api.pluginMethod_PasteText = paste;
  state.api.wb = { getWorksheet: () => ({ model: { getRange3: () => ({ getFormula: () => 'C1' }) } }) };
  await expect(sumRangeTool.execute({ range: 'A1:A2', target: 'C1' })).rejects.toThrow('officeSumFormulaSource');
  expect(paste).not.toHaveBeenCalled();
});
it('rejects sort key columns outside the explicit range', async () => {
  await expect(
    sortRangeTool.execute({ range: 'A1:B3', column: 'B2', descending: false, header: true }),
  ).rejects.toThrow('officeInvalidRange');
  await expect(
    sortRangeTool.execute({ range: 'A1:B3', column: 'C', descending: false, header: true }),
  ).rejects.toThrow();
});
it('rejects protected sheets before moving the selection or sorting', async () => {
  const sort = vi.fn(),
    select = vi.fn();
  state.api.asc_sortCells = sort;
  state.api.wb = {
    getWorksheet: () => ({ setSelection: select, model: { getRange3: () => ({}), getSheetProtection: () => true } }),
  };
  await expect(sortRangeTool.execute({ range: 'A1:B3', column: 'B', descending: false, header: true })).rejects.toThrow(
    'officeProtectedRange',
  );
  expect(select).not.toHaveBeenCalled();
  expect(sort).not.toHaveBeenCalled();
});
it('refuses sorting formula rows before any mutation', async () => {
  const sort = vi.fn();
  state.api.asc_sortCells = sort;
  state.api.wb = {
    getWorksheet: () => ({
      model: {
        getRange3: () => ({
          getValueData: () => ({ value: { type: 0 } }),
          getNumberValue: () => 1,
          getFormula: () => 'C1',
        }),
      },
    }),
  };
  await expect(sortRangeTool.execute({ range: 'A1:B3', column: 'B', descending: false, header: true })).rejects.toThrow(
    'officeSortUnsupported',
  );
  expect(sort).not.toHaveBeenCalled();
});
it('does not mutate slides in readonly mode or silently duplicate multiple selected slides', async () => {
  const duplicate = vi.fn();
  state.api = {
    ...state.api,
    DublicateSlide: duplicate,
    WordControl: { m_oLogicDocument: { Slides: [{}, {}], IsMasterMode: () => false, GetSelectedSlides: () => [0, 1] } },
  };
  await expect(slideActionTool.execute({ action: 'duplicate' })).rejects.toThrow();
  state.readonly = true;
  await expect(slideActionTool.execute({ action: 'add' })).rejects.toThrow();
  expect(duplicate).not.toHaveBeenCalled();
});
it('verifies added slide count and rejects invalid navigation', async () => {
  const slides = [{}];
  state.api = {
    ...state.api,
    AddSlide: () => slides.push({}),
    getCurrentPage: () => 0,
    WordControl: { m_oLogicDocument: { Slides: slides, IsMasterMode: () => false, GetSelectedSlides: () => [0] } },
  };
  expect(await slideActionTool.execute({ action: 'add' })).toMatchObject({ count: 2, verified: true });
  await expect(slideActionTool.execute({ action: 'navigate', page: 3 })).rejects.toThrow();
});

it.each(['New content', 'New content  '])(
  'adds exact slide text without replacing existing shapes: %s',
  async (text) => {
    const shapes = [{ getText: () => 'Existing title' }];
    const resetSelection = vi.fn();
    const logic = {
      Slides: [{ cSld: { spTree: shapes } }],
      IsMasterMode: () => false,
      CanEdit: () => true,
      GetCurrentController: () => ({ resetSelection }),
    };
    state.api = {
      ...state.api,
      WordControl: { m_oLogicDocument: logic },
      getCurrentPage: () => 0,
      pluginMethod_PasteText: (text: string) => shapes.push({ getText: () => text + '\r\n' }),
    };
    await expect(executeSlideTextInNativeFixture({ text })).resolves.toEqual({ page: 1, verified: true });
    expect(resetSelection).toHaveBeenCalledOnce();
    expect(shapes[0].getText()).toBe('Existing title');
  },
);
it('rejects slide text writes in readonly documents', async () => {
  state.readonly = true;
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('read-only');
});

it('rejects text insertion outside normal slides before calling paste', async () => {
  const paste = vi.fn();
  state.api = {
    ...state.api,
    pluginMethod_PasteText: paste,
    getCurrentPage: () => 0,
    WordControl: { m_oLogicDocument: { Slides: [], IsMasterMode: () => true } },
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('officePresentationOnly');
  expect(paste).not.toHaveBeenCalled();
});

it('does not report verified success if the current slide changes during text insertion', async () => {
  let page = 0;
  const logic = {
    Slides: [{ cSld: { spTree: [] } }],
    IsMasterMode: () => false,
    GetCurrentController: () => ({ resetSelection: vi.fn() }),
  };
  state.api = {
    ...state.api,
    WordControl: { m_oLogicDocument: logic },
    getCurrentPage: () => page,
    pluginMethod_PasteText: () => {
      page = 1;
    },
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('expired');
});

it('does not verify slide text when requested trailing whitespace was lost', async () => {
  vi.useFakeTimers();
  try {
    const shapes: Array<{ getText(): string }> = [];
    const logic = {
      Slides: [{ cSld: { spTree: shapes } }],
      IsMasterMode: () => false,
      GetCurrentController: () => ({ resetSelection: vi.fn() }),
    };
    state.api = {
      ...state.api,
      WordControl: { m_oLogicDocument: logic },
      getCurrentPage: () => 0,
      pluginMethod_PasteText: () => shapes.push({ getText: () => 'New content\r\n' }),
    };
    const result = expect(executeSlideTextInNativeFixture({ text: 'New content  ' })).rejects.toThrow(
      'could not be verified',
    );
    await vi.runAllTimersAsync();
    await result;
  } finally {
    vi.useRealTimers();
  }
});

it('waits for a newly pasted shape to expose its text', async () => {
  vi.useFakeTimers();
  try {
    let populated = false;
    const shapes: Array<{ getText(): string | undefined }> = [];
    const logic = {
      Slides: [{ cSld: { spTree: shapes } }],
      IsMasterMode: () => false,
      GetCurrentController: () => ({ resetSelection: vi.fn() }),
    };
    state.api = {
      ...state.api,
      WordControl: { m_oLogicDocument: logic },
      getCurrentPage: () => 0,
      pluginMethod_PasteText: () => {
        shapes.push({ getText: () => (populated ? '文字\r\n' : undefined) });
        setTimeout(() => {
          populated = true;
        }, 100);
      },
    };
    const result = expect(executeSlideTextInNativeFixture({ text: '文字' })).resolves.toEqual({
      page: 1,
      verified: true,
    });
    await vi.runAllTimersAsync();
    await result;
  } finally {
    vi.useRealTimers();
  }
});

it('verifies multiline shape content when the SDK selection-text getter returns undefined', async () => {
  const shapes: unknown[] = [];
  const logic = {
    Slides: [{ cSld: { spTree: shapes } }],
    IsMasterMode: () => false,
    GetCurrentController: () => ({ resetSelection: vi.fn() }),
  };
  state.api = {
    ...state.api,
    WordControl: { m_oLogicDocument: logic },
    getCurrentPage: () => 0,
    pluginMethod_PasteText: () =>
      shapes.push({ getText: () => undefined, getDocContent: () => ({ GetText: () => '第一行\r\nSecond line\r\n' }) }),
  };
  await expect(executeSlideTextInNativeFixture({ text: '第一行\nSecond line' })).resolves.toEqual({
    page: 1,
    verified: true,
  });
});

it('blocks native interaction during PPT paste and releases it on verification', async () => {
  const shapes: unknown[] = [];
  const paste = vi.fn((text: string) => {
    expect(state.busy).toBe(true);
    shapes.push({ getText: () => text + '\r\n' });
  });
  state.api = {
    ...state.api,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: paste,
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).resolves.toEqual({ page: 1, verified: true });
  expect(state.busy).toBe(false);
  expect(state.api.sync_EndAction).toHaveBeenCalledExactlyOnceWith(1, 9);
});
it('releases native blocking when PPT paste throws', async () => {
  state.api = {
    ...state.api,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: () => {
      throw new Error('Paste failed');
    },
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: [] } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('Paste failed');
  expect(state.api.sync_EndAction).toHaveBeenCalledExactlyOnceWith(1, 9);
  expect(state.busy).toBe(false);
});

it.each([{ canEdit: () => false }, { isViewMode: true }])(
  'rejects native readonly PPT state before starting a paste action (%j)',
  async (flags) => {
    const paste = vi.fn();
    state.api = {
      ...state.api,
      ...flags,
      getCurrentPage: () => 0,
      pluginMethod_PasteText: paste,
      WordControl: {
        m_oLogicDocument: {
          Slides: [{ cSld: { spTree: [] } }],
          IsMasterMode: () => false,
          GetCurrentController: () => ({ resetSelection: vi.fn() }),
        },
      },
    };
    await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('read-only');
    expect(paste).not.toHaveBeenCalled();
    expect(state.api.sync_StartAction).not.toHaveBeenCalled();
  },
);
it('rejects PPT slideshow before native paste or blocking actions', async () => {
  const paste = vi.fn();
  state.api = {
    ...state.api,
    isSlideShow: () => true,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: paste,
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: [] } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('officePresentationOnly');
  expect(paste).not.toHaveBeenCalled();
  expect(state.api.sync_StartAction).not.toHaveBeenCalled();
});

it('uses native completion without requiring the plugin paste wrapper', async () => {
  const shapes: unknown[] = [];
  const plugin = vi.fn(() => {
    throw new Error('Plugin wrapper must not run');
  });
  state.api = {
    ...state.api,
    pluginMethod_PasteText: plugin,
    getCurrentPage: () => 0,
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  state.api.asc_PasteData = (
    _format: number,
    text: string,
    _a: unknown,
    _b: unknown,
    _c: unknown,
    done: () => void,
  ) => {
    (state.api.pre_Paste as (a: unknown, b: unknown, cb: () => void) => void)([], {}, () => {
      shapes.push({ getText: () => text + '\r\n' });
      done();
    });
  };
  await expect(executeSlideTextInNativeFixture({ text: 'Native content' })).resolves.toEqual({
    page: 1,
    verified: true,
  });
  expect(plugin).not.toHaveBeenCalled();
});
it('rejects a replaced native paste helper before deferred insertion', async () => {
  const paste = vi.fn();
  state.api = {
    ...state.api,
    pluginMethod_PasteText: paste,
    getCurrentPage: () => 0,
    pre_Paste: (_fonts: unknown, _images: unknown, insert: () => void) => {
      state.api.pasteHelper = { Api: state.api, Paste_Process_End: vi.fn() };
      insert();
    },
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: [] } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('expired');
  expect(paste).not.toHaveBeenCalled();
});

it('groups a successful PPT text write and cancels a failed owned paste', async () => {
  const shapes: unknown[] = [],
    recalc = vi.fn();
  state.api = {
    ...state.api,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: (text: string) => shapes.push({ getText: () => text + '\r\n' }),
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        Recalculate: recalc,
        Document_UpdateInterfaceState: vi.fn(),
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  const history = state.api.nativeHistory as {
    startGroupPoints: unknown;
    endGroupPoints: unknown;
    cancelGroupPoints: unknown;
  };
  await executeSlideTextInNativeFixture({ text: 'First' });
  expect(history.startGroupPoints).toHaveBeenCalledOnce();
  expect(history.endGroupPoints).toHaveBeenCalledOnce();
  state.api.pluginMethod_PasteText = () => {
    throw new Error('Paste failed');
  };
  await expect(executeSlideTextInNativeFixture({ text: 'Second' })).rejects.toThrow('Paste failed');
  expect(history.cancelGroupPoints).toHaveBeenCalledOnce();
  expect(recalc).toHaveBeenCalled();
});
it('does not paste or cancel a replaced native history group marker', async () => {
  const paste = vi.fn();
  const history = state.api.nativeHistory as { Points: Array<{ Items: unknown[] }>; cancelGroupPoints: unknown };
  state.api = {
    ...state.api,
    pluginMethod_PasteText: paste,
    getCurrentPage: () => 0,
    pre_Paste: (_fonts: unknown, _images: unknown, insert: () => void) => {
      history.Points[0] = { Items: [] };
      insert();
    },
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: [] } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  await expect(executeSlideTextInNativeFixture({ text: 'New content' })).rejects.toThrow('expired');
  expect(paste).not.toHaveBeenCalled();
  expect(history.cancelGroupPoints).not.toHaveBeenCalled();
});

it('integrates measured layout with the owned paste history group', async () => {
  const shapes = [{ getText: () => 'Title', bounds: { l: 0, t: 0, r: 340, b: 145 } }];
  state.api = {
    ...state.api,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: (text: string) =>
      shapes.push({ getText: () => text + '\r\n', bounds: { l: 100, t: 80, r: 180, b: 105 } }),
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  await executeSlideTextInNativeFixture({ text: 'Exact text' });
  expect(shapes[1].bounds.t).toBeCloseTo(148.8);
  expect(shapes[1].bounds.l).toBeCloseTo(10.2);
  expect(shapes[0].bounds).toEqual({ l: 0, t: 0, r: 340, b: 145 });
});
it('rolls back a paste when the slide has no free text area', async () => {
  const shapes = [{ getText: () => 'Full slide', bounds: { l: 0, t: 0, r: 340, b: 190 } }];
  state.api = {
    ...state.api,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: (text: string) =>
      shapes.push({ getText: () => text + '\r\n', bounds: { l: 100, t: 80, r: 180, b: 105 } }),
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  const history = state.api.nativeHistory as { cancelGroupPoints: () => unknown[] };
  const cancel = history.cancelGroupPoints;
  history.cancelGroupPoints = vi.fn(() => {
    shapes.splice(1);
    return cancel();
  });
  await expect(executeSlideTextInNativeFixture({ text: 'Exact text' })).rejects.toThrow('No free text area');
  expect(shapes).toHaveLength(1);
  expect(history.cancelGroupPoints).toHaveBeenCalledOnce();
  expect(state.busy).toBe(false);
});

it('preserves prior redo points when a new PPT write is cancelled for lack of space', async () => {
  const shapes = [{ getText: () => 'Existing full slide', bounds: { l: 0, t: 0, r: 340, b: 190 } }];
  state.api = {
    ...state.api,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: (text: string) =>
      shapes.push({ getText: () => text + '\r\n', bounds: { l: 100, t: 80, r: 180, b: 105 } }),
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  const history = state.api.nativeHistory as {
    Index: number;
    Points: Array<{ Items: unknown[] }>;
    StoredData: unknown[];
    cancelGroupPoints: () => unknown[];
    SaveRedoPoints: unknown;
    PopRedoPoints: unknown;
  };
  const redo = { Items: ['Earlier undone edit'] };
  history.Points.push(redo);
  const cancel = history.cancelGroupPoints;
  history.cancelGroupPoints = vi.fn(() => {
    shapes.splice(1);
    return cancel();
  });
  await expect(executeSlideTextInNativeFixture({ text: 'Exact text' })).rejects.toThrow('No free text area');
  expect(history.Index).toBe(-1);
  expect(history.Points).toEqual([redo]);
  expect(history.Points[0]).toBe(redo);
  expect(history.StoredData).toEqual([]);
  expect(history.SaveRedoPoints).toHaveBeenCalledOnce();
  expect(history.PopRedoPoints).toHaveBeenCalledOnce();
});
it('keeps native redo invalidation after a successful new PPT write', async () => {
  const shapes: Array<{ getText(): string }> = [];
  state.api = {
    ...state.api,
    getCurrentPage: () => 0,
    pluginMethod_PasteText: (text: string) => shapes.push({ getText: () => text + '\r\n' }),
    WordControl: {
      m_oLogicDocument: {
        Slides: [{ cSld: { spTree: shapes } }],
        IsMasterMode: () => false,
        GetCurrentController: () => ({ resetSelection: vi.fn() }),
      },
    },
  };
  const history = state.api.nativeHistory as {
    Index: number;
    Points: Array<{ Items: unknown[] }>;
    StoredData: unknown[];
    SaveRedoPoints: unknown;
    PopRedoPoints: unknown;
  };
  const redo = { Items: ['Earlier undone edit'] };
  history.Points.push(redo);
  await executeSlideTextInNativeFixture({ text: 'New valid text' });
  expect(history.Index).toBe(0);
  expect(history.Points).toHaveLength(1);
  expect(history.Points[0]).not.toBe(redo);
  expect(history.StoredData).toEqual([]);
  expect(history.SaveRedoPoints).toHaveBeenCalledOnce();
  expect(history.PopRedoPoints).not.toHaveBeenCalled();
});

it('preserves prior redo through a paste timeout and ignores late insertion', async () => {
  vi.useFakeTimers();
  try {
    const paste = vi.fn(),
      shapes: unknown[] = [];
    state.api = {
      ...state.api,
      getCurrentPage: () => 0,
      pluginMethod_PasteText: paste,
      pre_Paste: (_fonts: unknown, _images: unknown, insert: () => void) => {
        setTimeout(insert, 11000);
      },
      WordControl: {
        m_oLogicDocument: {
          Slides: [{ cSld: { spTree: shapes } }],
          IsMasterMode: () => false,
          GetCurrentController: () => ({ resetSelection: vi.fn() }),
        },
      },
    };
    const history = state.api.nativeHistory as {
      Index: number;
      Points: Array<{ Items: unknown[] }>;
      StoredData: unknown[];
      PopRedoPoints: unknown;
    };
    const redo = { Items: ['Earlier undone edit'] };
    history.Points.push(redo);
    const result = expect(executeSlideTextInNativeFixture({ text: 'New text' })).rejects.toThrow(
      'Native paste timed out',
    );
    await vi.advanceTimersByTimeAsync(10000);
    await result;
    expect(history.Points[0]).toBe(redo);
    expect(history.Index).toBe(-1);
    expect(history.StoredData).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(paste).not.toHaveBeenCalled();
    expect(history.Points[0]).toBe(redo);
    expect(history.PopRedoPoints).toHaveBeenCalledOnce();
    expect(state.busy).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it.each(['before', 'after'])(
  'retains redo and the original error when native group opening throws %s creating its point',
  async (phase) => {
    state.api = {
      ...state.api,
      getCurrentPage: () => 0,
      pluginMethod_PasteText: vi.fn(),
      WordControl: {
        m_oLogicDocument: {
          Slides: [{ cSld: { spTree: [] } }],
          IsMasterMode: () => false,
          GetCurrentController: () => ({ resetSelection: vi.fn() }),
        },
      },
    };
    const history = state.api.nativeHistory as {
      Index: number;
      Points: Array<{ Items: unknown[] }>;
      StoredData: unknown[];
      startGroupPoints: () => void;
      cancelGroupPoints: unknown;
    };
    const redo = { Items: ['Earlier undone edit'] };
    history.Points.push(redo);
    const start = history.startGroupPoints;
    history.startGroupPoints = () => {
      if (phase === 'after') start();
      throw new Error('Native group opening failed');
    };
    await expect(executeSlideTextInNativeFixture({ text: 'Text' })).rejects.toThrow('Native group opening failed');
    expect(history.Index).toBe(-1);
    expect(history.Points[0]).toBe(redo);
    expect(history.StoredData).toEqual([]);
    expect(history.cancelGroupPoints).toHaveBeenCalledTimes(phase === 'after' ? 1 : 0);
    expect(state.busy).toBe(false);
  },
);

it('preserves prior redo when aborted during native preparation and ignores late insertion', async () => {
  vi.useFakeTimers();
  try {
    const paste = vi.fn(),
      shapes: unknown[] = [];
    state.api = {
      ...state.api,
      getCurrentPage: () => 0,
      pluginMethod_PasteText: paste,
      pre_Paste: (_fonts: unknown, _images: unknown, insert: () => void) => {
        setTimeout(insert, 11000);
      },
      WordControl: {
        m_oLogicDocument: {
          Slides: [{ cSld: { spTree: shapes } }],
          IsMasterMode: () => false,
          GetCurrentController: () => ({ resetSelection: vi.fn() }),
        },
      },
    };
    const history = state.api.nativeHistory as {
      Index: number;
      Points: Array<{ Items: unknown[] }>;
      StoredData: unknown[];
      PopRedoPoints: unknown;
    };
    const redo = { Items: ['Earlier undone edit'] };
    history.Points.push(redo);
    const abort = new AbortController();
    const outcome = executeSlideTextInNativeFixture({ text: 'New text' }, abort.signal).catch((error) => error);
    abort.abort();
    await vi.advanceTimersByTimeAsync(11000);
    expect(await outcome).toMatchObject({ name: 'AbortError' });
    expect(history.Points[0]).toBe(redo);
    expect(history.Index).toBe(-1);
    expect(history.StoredData).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(paste).not.toHaveBeenCalled();
    expect(history.Points[0]).toBe(redo);
    expect(history.PopRedoPoints).toHaveBeenCalledOnce();
    expect(state.busy).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it('reads the entire range with unambiguous addresses including blanks and embedded newlines', async () => {
  const values = [
    ['Name', 'Value'],
    ['Cora\nDavi', ''],
    ['Mira', '20'],
  ];
  state.api.wb = {
    getWorksheet: () => ({ model: { getRange3: (r: number, c: number) => ({ getValue: () => values[r][c] }) } }),
  };
  const result = await getRangeTool.execute({ range: 'a1:b3' });
  expect(result).toEqual({
    range: 'A1:B3',
    text: 'A1:B3\nA1: "Name"\nB1: "Value"\nA2: "Cora\\nDavi"\nB2: ""\nA3: "Mira"\nB3: "20"',
  });
});
it('rejects oversized read ranges and cancellation without partial output', async () => {
  await expect(getRangeTool.execute({ range: 'A1:XFD1048576' })).rejects.toThrow();
  state.api.wb = { getWorksheet: () => ({ model: { getRange3: () => ({ getValue: () => 'x'.repeat(80000) }) } }) };
  await expect(getRangeTool.execute({ range: 'A1:B1' })).rejects.toThrow('officeRangeReadTooLarge');
  const abort = new AbortController();
  abort.abort();
  await expect(getRangeTool.execute({ range: 'A1:B1' }, abort.signal)).rejects.toThrow();
});

it('rejects combined text overflow even when each individual range fits', async () => {
  state.api.wb = { getWorksheet: () => ({ model: { getRange3: () => ({ getValue: () => 'x'.repeat(40000) }) } }) };
  await expect(getRangeTool.execute({ range: 'A1' })).resolves.toHaveProperty('range', 'A1');
  await expect(getRangesTool.execute({ ranges: 'A1,B1' })).rejects.toThrow('officeRangeReadTooLarge');
});
