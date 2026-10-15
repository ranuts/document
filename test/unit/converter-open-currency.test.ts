import { afterEach, describe, expect, it, vi } from 'vitest';
const { mount, load } = vi.hoisted(() => ({
  mount: vi.fn(async (_options: unknown) => {}),
  load: vi.fn(async () => {}),
}));
vi.mock('../../lib/onlyoffice-editor', () => ({ createEditorInstance: mount, loadEditorApi: load }));
import { handleDocumentOperation } from '../../lib/converter';
afterEach(() => {
  mount.mockClear();
  load.mockReset().mockResolvedValue(undefined);
  vi.restoreAllMocks();
});

describe('converter open currency', () => {
  it('does not mount if superseded while the editor API loads', async () => {
    let finish!: () => void;
    load.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    let current = true;
    const pending = handleDocumentOperation({ isNew: true, fileName: 'old.docx', isCurrent: () => current });
    const failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    current = false;
    finish();
    await failed;
    expect(mount).not.toHaveBeenCalled();
  });
  it('does not mount if superseded while preprocessing document bytes', async () => {
    let finish!: (value: ArrayBuffer) => void;
    const file = new File(['bytes'], 'old.txt');
    vi.spyOn(file, 'arrayBuffer').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    let current = true;
    const pending = handleDocumentOperation({ isNew: false, fileName: file.name, file, isCurrent: () => current });
    const failed = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(file.arrayBuffer).toHaveBeenCalled());
    current = false;
    finish(new ArrayBuffer(0));
    await failed;
    expect(mount).not.toHaveBeenCalled();
  });
});
