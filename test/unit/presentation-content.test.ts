import { beforeEach, expect, it, vi } from 'vitest';
import { createSlideTool } from '../../lib/agent-plugin/presentation-content';

const fixture = vi.hoisted(() => ({ context: null as any, readonly: false }));
vi.mock('../../lib/agent-plugin/editor-bridge', () => ({
  requireEditorContext: () => fixture.context,
  getEditorContext: () => fixture.context,
}));
vi.mock('../../lib/onlyoffice/readonly', () => ({ getReadonlyMode: () => fixture.readonly }));

beforeEach(() => {
  fixture.readonly = false;
  const original = { cSld: { spTree: [] } };
  const logic = {
    Slides: [original],
    IsMasterMode: () => false,
    CanEdit: () => true,
    GetWidthMM: () => 254,
    GetHeightMM: () => 142.875,
    Recalculate: vi.fn(),
    Document_UpdateInterfaceState: vi.fn(),
  };
  let group = -1;
  const history = {
    Index: -1,
    Points: [] as Array<{ Items: unknown[] }>,
    _getLongPointIndex: () => group,
    startGroupPoints: vi.fn(() => {
      group = ++history.Index;
      history.Points.push({ Items: [] });
    }),
    endGroupPoints: vi.fn(() => {
      group = -1;
    }),
    cancelGroupPoints: vi.fn(() => {
      logic.Slides.splice(1);
      history.Points.splice(group);
      history.Index = group - 1;
      group = -1;
    }),
  };
  const builder = {
    GetPresentation: () => ({
      AddSlide: vi.fn((slide) => {
        logic.Slides.push(slide.Slide);
        history.Points[history.Index].Items.push(slide);
      }),
    }),
    CreateSlide: () => {
      const Slide = { cSld: { spTree: [] as unknown[] } };
      return {
        Slide,
        RemoveAllObjects: () => {},
        AddObject: (shape: { Drawing: unknown }) => {
          Slide.cSld.spTree.push(shape.Drawing);
          return true;
        },
      };
    },
    CreateNoFill: () => ({}),
    ThemeColor: () => ({ theme: 'tx1' }),
    CreateStroke: () => ({}),
    CreateShape: (_type: string, width: number, height: number) => {
      const paragraphs: any[] = [];
      const Drawing = {
        width,
        height,
        getText: () => paragraphs.map((p) => p.text).join('\n') + '\n',
        recalculate: () => {},
        getTextRect: () => ({ l: 0, t: 0, r: width / 36000, b: height / 36000 }),
        getDocContent: () => ({
          GetText: () => paragraphs.map((p) => p.text).join('\n') + '\n',
          GetSummaryHeight: () =>
            paragraphs.reduce(
              (sum, p) => sum + ((Math.max(1, Math.ceil(p.text.length / 80)) * p.fontSize) / 2) * 0.5,
              0,
            ),
        }),
      };
      return {
        Drawing,
        SetPosition: vi.fn(),
        SetVerticalTextAlign: vi.fn(),
        SetPaddings: vi.fn(),
        GetDocContent: () => ({
          RemoveAllElements: () => {
            paragraphs.length = 0;
            paragraphs.push(builder.CreateParagraph());
          },
          GetElement: (index: number) => paragraphs[index],
          Push: (p: { text: string }) => {
            paragraphs.push(p);
            return true;
          },
        }),
      };
    },
    CreateParagraph: () => ({
      text: '',
      AddText(text: string) {
        this.text += text;
      },
      fontSize: 36,
      SetFontSize(size: number) {
        this.fontSize = size;
      },
      SetBold: vi.fn(),
      SetColor: vi.fn(),
    }),
  };
  fixture.context = {
    api: {
      isDocumentLoadComplete: true,
      isLoadFullApi: true,
      isLongAction: () => false,
      sync_StartAction: vi.fn(),
      sync_EndAction: vi.fn(),
      WordControl: { m_oLogicDocument: logic },
    },
    Asc: { c_oAscAsyncActionType: { BlockInteraction: 1 }, c_oAscAsyncAction: { ApplyChanges: 9 } },
    AscCommon: { History: history },
    presentationBuilder: builder,
  };
});

it('creates separate title and body objects as one reversible native operation', async () => {
  const { api, AscCommon } = fixture.context;
  const oldSlide = api.WordControl.m_oLogicDocument.Slides[0];
  await expect(
    createSlideTool.execute({ title: '项目预算', body: '预算 120\n截止日期 11 月 1 日' }),
  ).resolves.toMatchObject({ verified: true, count: 2 });
  const slides = api.WordControl.m_oLogicDocument.Slides;
  expect(slides[0]).toBe(oldSlide);
  expect(slides[1].cSld.spTree.map((s: { getText(): string }) => s.getText())).toEqual([
    '项目预算\n',
    '预算 120\n截止日期 11 月 1 日\n',
  ]);
  expect(AscCommon.History.startGroupPoints).toHaveBeenCalledOnce();
  expect(AscCommon.History.endGroupPoints).toHaveBeenCalledOnce();
  expect(api.sync_EndAction).toHaveBeenCalledOnce();
});

it('rolls back a native verification failure and releases the interaction mask', async () => {
  const { api, presentationBuilder, AscCommon } = fixture.context;
  presentationBuilder.GetPresentation = () => ({ AddSlide: () => {} });
  await expect(createSlideTool.execute({ title: 'Budget', body: '120' })).rejects.toThrow('verified');
  expect(api.WordControl.m_oLogicDocument.Slides).toHaveLength(1);
  expect(AscCommon.History.cancelGroupPoints).toHaveBeenCalledOnce();
  expect(AscCommon.History.Index).toBe(-1);
  expect(api.sync_EndAction).toHaveBeenCalledOnce();
});

it.each(['readonly', 'master', 'busy', 'missing-builder'])('rejects %s before creating content', async (reason) => {
  const { api } = fixture.context;
  if (reason === 'readonly') fixture.readonly = true;
  if (reason === 'master') api.WordControl.m_oLogicDocument.IsMasterMode = () => true;
  if (reason === 'busy') api.isLongAction = () => true;
  if (reason === 'missing-builder') fixture.context.presentationBuilder = undefined;
  await expect(createSlideTool.execute({ title: 'Budget', body: '120' })).rejects.toThrow();
  expect(fixture.context.AscCommon.History.startGroupPoints).not.toHaveBeenCalled();
});

it('rejects cancelled and oversized content without modifying the presentation', async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(createSlideTool.execute({ title: 'Budget', body: '120' }, abort.signal)).rejects.toThrow();
  await expect(createSlideTool.execute({ title: 'x'.repeat(501), body: '120' })).rejects.toThrow();
  expect(fixture.context.api.WordControl.m_oLogicDocument.Slides).toHaveLength(1);
});

it('paginates overflowing native slide text without losing content and keeps one history group', async () => {
  const body = Array.from({ length: 70 }, (_, i) => `Item ${i + 1}: project budget`).join('\n');
  const result = await createSlideTool.execute({ title: 'Project budget', body });
  const slides = fixture.context.api.WordControl.m_oLogicDocument.Slides.slice(1);
  expect(slides.length).toBeGreaterThan(1);
  expect(slides.map((s: any) => s.cSld.spTree[1].getText().replace(/\n$/, '')).join('')).toBe(body);
  expect(result).toMatchObject({ verified: true, added: slides.length });
  expect(fixture.context.AscCommon.History.Index).toBe(0);
});
