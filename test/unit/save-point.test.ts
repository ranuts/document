import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureSavePoint, commitSavePoint } from '../../lib/onlyoffice/save-point';

type FakeHistory = {
  Index: number;
  Points: object[];
  Reset_SavedIndex: ReturnType<typeof vi.fn>;
};

// A same-origin iframe carrying the two SDK globals save-point reads.
function mountEditorFrame(): { history: FakeHistory; checkChangedDocument: ReturnType<typeof vi.fn> } {
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const history: FakeHistory = { Index: 1, Points: [{}, {}], Reset_SavedIndex: vi.fn() };
  const checkChangedDocument = vi.fn();
  Object.assign(iframe.contentWindow as object, {
    AscCommon: { History: history },
    Asc: { editor: { CheckChangedDocument: checkChangedDocument } },
  });
  return { history, checkChangedDocument };
}

describe('save point', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when no editor frame is mounted', () => {
    expect(captureSavePoint()).toBeNull();
    expect(commitSavePoint(null)).toBe(false);
  });

  it('marks the document saved when the history did not move', () => {
    const { history, checkChangedDocument } = mountEditorFrame();

    const point = captureSavePoint();

    expect(commitSavePoint(point)).toBe(true);
    expect(history.Reset_SavedIndex).toHaveBeenCalledWith(true);
    expect(checkChangedDocument).toHaveBeenCalledOnce();
  });

  it('leaves the document dirty when an edit landed during the export', () => {
    const { history, checkChangedDocument } = mountEditorFrame();

    const point = captureSavePoint();
    history.Points.push({});
    history.Index = 2;

    expect(commitSavePoint(point)).toBe(false);
    expect(history.Reset_SavedIndex).not.toHaveBeenCalled();
    expect(checkChangedDocument).not.toHaveBeenCalled();
  });

  it('treats undo followed by a new edit as a moved history', () => {
    const { history } = mountEditorFrame();

    const point = captureSavePoint();
    // Same index, different point: the content no longer matches the export.
    history.Points[1] = {};

    expect(commitSavePoint(point)).toBe(false);
    expect(history.Reset_SavedIndex).not.toHaveBeenCalled();
  });
});
