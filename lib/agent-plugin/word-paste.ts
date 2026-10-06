import { getEditorContext, requireEditorApi, type EditorApi } from './editor-bridge';
import { withBlockingEditorAction } from './editor-action';
import { beginWordPasteHistory } from './word-paste-history';

interface WordPasteApi {
  WordControl?: { m_oLogicDocument?: { Slides?: unknown[]; Document_UpdateInterfaceState?(): void } };
  _pluginMethod_PasteHtml(html: string, complete: () => void): void;
  pre_Paste(fonts: unknown, images: unknown, insert: () => void): void;
  asc_PasteData(format: unknown, html: unknown, a: unknown, b: unknown, c: unknown, complete: () => void): void;
  Undo(): void;
  isLongAction?(): boolean;
  sync_StartAction?(type: number, action: number): void;
  sync_EndAction?(type: number, action: number): void;
}
const unverified = () => new Error('The change could not be verified. Check the document and use Undo if needed.');

/** Await the Word HTML wrapper, including its native cleanup and history ownership.
 * A cancelled preparation must finish that wrapper before Undo can restore its
 * early deletion. Interception exists only during the synchronous native entry.
 */
export async function pasteWordHtml(
  editor: EditorApi,
  html: string,
  signal?: AbortSignal,
  timeoutMs = 10000,
): Promise<void> {
  signal?.throwIfAborted();
  const api = editor as unknown as WordPasteApi;
  const context = getEditorContext();
  const logic = api.WordControl?.m_oLogicDocument;
  const helper = context?.AscCommon?.g_specialPasteHelper;
  const history = context?.AscCommon?.History;
  const type = context?.Asc.c_oAscAsyncActionType?.BlockInteraction;
  const action = context?.Asc.c_oAscAsyncAction?.ApplyChanges;
  if (!logic || logic.Slides) throw new Error('This operation requires a Word document');
  if (
    context?.api !== editor ||
    !helper ||
    helper.Api !== editor ||
    !history ||
    type === undefined ||
    action === undefined ||
    typeof api._pluginMethod_PasteHtml !== 'function' ||
    typeof api.pre_Paste !== 'function' ||
    typeof api.asc_PasteData !== 'function' ||
    typeof api.Undo !== 'function' ||
    typeof helper.Paste_Process_End !== 'function' ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0
  )
    throw new Error('Editor paste API is unavailable');
  const current = () => {
    try {
      const latest = getEditorContext();
      return (
        requireEditorApi() === editor &&
        latest?.api === editor &&
        api.WordControl?.m_oLogicDocument === logic &&
        latest.AscCommon?.History === history &&
        latest.AscCommon?.g_specialPasteHelper === helper &&
        helper.Api === editor
      );
    } catch {
      return false;
    }
  };
  await withBlockingEditorAction(api, { BlockInteraction: type, ApplyChanges: action }, async (releaseInteraction) => {
    const transaction = beginWordPasteHistory(history, current, () => api.Undo());
    await new Promise<void>((resolve, reject) => {
      const originalPrepare = api.pre_Paste,
        originalPaste = api.asc_PasteData;
      let active = true,
        settled = false,
        calling = true,
        sealed = false,
        prepared = false,
        inserted = false,
        completeSeen = false,
        nativeRequested = false;
      let nativeFinish: (() => void) | undefined;
      let failing = false;
      let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
      let completeCleanup!: () => void;
      const cleanup = new Promise<void>((resolve) => {
        completeCleanup = resolve;
      });
      let pendingFailure: { error: unknown } | undefined;
      const release = () => {
        clearTimeout(timer);
        clearTimeout(cleanupTimer);
        signal?.removeEventListener('abort', abort);
      };
      const fail = (error: unknown) => {
        if (settled || failing) return;
        active = false;
        if (calling) {
          pendingFailure = { error };
          return;
        }
        failing = true;
        release();
        void (async () => {
          try {
            if (
              !current() ||
              (nativeRequested && !sealed) ||
              (sealed && !(inserted ? transaction.ownsPoint() : transaction.isPending()))
            )
              throw unverified();
            if (prepared && !inserted) helper.Paste_Process_End();
            nativeFinish?.();
            if (nativeRequested) {
              // A font-loading action may delay the wrapper's final cleanup.
              // Wait for its callback before restoring document/history state.
              await Promise.race([
                cleanup,
                new Promise<never>((_resolve, rejectCleanup) => {
                  cleanupTimer = setTimeout(() => rejectCleanup(unverified()), timeoutMs);
                }),
              ]);
            }
            if (inserted) {
              // Never undo a partial insertion whose exact changes are unknown.
              transaction.commit();
              throw unverified();
            }
            transaction.rollback();
            logic.Document_UpdateInterfaceState?.();
            settled = true;
            reject(error);
          } catch {
            settled = true;
            reject(unverified());
          } finally {
            release();
          }
        })();
      };
      const succeed = () => {
        if (settled || !active || calling || !completeSeen) return;
        try {
          if (!current() || !nativeRequested || !sealed) throw unverified();
          transaction.commit();
          settled = true;
          active = false;
          release();
          resolve();
        } catch (error) {
          fail(error);
        }
      };
      const abort = () => fail(signal!.reason);
      const timer = setTimeout(() => fail(new Error('Native paste timed out')), timeoutMs);
      signal?.addEventListener('abort', abort, { once: true });
      const prepare: WordPasteApi['pre_Paste'] = function (fonts, images, insert) {
        prepared = true;
        originalPrepare.call(api, fonts, images, () => {
          if (!active) return;
          if (!current() || (!calling && !transaction.isPending())) {
            fail(unverified());
            return;
          }
          inserted = true;
          try {
            insert();
          } catch (error) {
            fail(error);
          }
        });
      };
      const paste: WordPasteApi['asc_PasteData'] = function (format, data, a, b, c, complete) {
        nativeRequested = true;
        let finished = false;
        nativeFinish = () => {
          if (!finished) {
            finished = true;
            // The HTML wrapper defers cleanup while any long action remains.
            // Release only our interaction mask before invoking that wrapper.
            releaseInteraction();
            complete();
          }
        };
        originalPaste.call(api, format, data, a, b, c, nativeFinish);
      };
      api.pre_Paste = prepare;
      api.asc_PasteData = paste;
      try {
        api._pluginMethod_PasteHtml(html, () => {
          completeSeen = true;
          completeCleanup();
          queueMicrotask(succeed);
        });
        if (nativeRequested) {
          transaction.seal();
          sealed = true;
        }
        calling = false;
        if (pendingFailure) fail(pendingFailure.error);
        else if (completeSeen) succeed();
        else if (!prepared) fail(new Error('Native paste was rejected'));
      } catch (error) {
        if (nativeRequested && !sealed) {
          try {
            transaction.seal();
            sealed = true;
          } catch {
            /* Foreign state must not be cleaned. */
          }
        }
        calling = false;
        fail(error);
      } finally {
        if (api.pre_Paste === prepare) api.pre_Paste = originalPrepare;
        if (api.asc_PasteData === paste) api.asc_PasteData = originalPaste;
      }
    });
  });
}
