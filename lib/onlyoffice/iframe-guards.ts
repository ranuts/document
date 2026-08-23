import { installOpenFailureGuard } from './open-failure';
import { injectLocalChromeCss } from './guards/chrome';
import { shadowSharedWorker } from './guards/shared-worker';
import { installFetchFontsGuard } from './guards/fetch-fonts';
import { installServerlessImagePipeline } from './guards/image-pipeline';
import { installServerlessSaveSemantics } from './guards/serverless-save';
import { installLongActionLeakGuard } from './guards/long-action';
import { installSeriesSettingsGuard } from './guards/series-settings';
import { installFontLoadAcceleration } from './guards/font-loading';
import { installCommentSelectionGuard } from './guards/comment-selection';
import { installCanvasLossGuard } from './guards/canvas-loss';
import { releaseWasmBinary } from './guards/wasm-binary-release';
import { installSingleUnloadPrompt } from './guards/unload-prompt';
import { installHintFallbackGuard } from './guards/hint-fallback';
import { installAboutSourceNotice } from './guards/about-source';

/**
 * Same-origin preparation of the editor iframe, applied from onAppReady and
 * onDocumentReady. Every treatment is idempotent and independent: each one
 * patches the vendor build by name, flags the frame it patched, and reports
 * whether it is in place. They are re-applied on a timer because the SDK
 * pieces they hook land at different points of the editor boot.
 *
 * Each guard lives in its own file under ./guards with the defect it exists
 * for written down next to it. None of them is optional -- every one is a
 * production bug that reached users.
 *
 * Returns true once every guard whose absence would still be felt later has
 * landed on some frame, so the caller can stop re-applying: the five that must
 * be in place before a document can be opened and saved, plus the wasm binary
 * release, which reports "in place" once it is watching for x2t rather than
 * once it has released -- x2t can load long after this timer is gone (see
 * ./guards/wasm-binary-release).
 */
export function prepareEditorIframe(): boolean {
  let fullyApplied = false;
  for (let i = 0; i < window.frames.length; i++) {
    try {
      const win = window.frames[i];
      const doc = win.document;
      if (!doc) continue;

      installOpenFailureGuard(win);
      injectLocalChromeCss(doc);

      const sharedWorkerShadowed = shadowSharedWorker(win);
      const fetchFontsGuarded = installFetchFontsGuard(win);
      const imagePipelineInstalled = installServerlessImagePipeline(win);
      const saveSemanticsInstalled = installServerlessSaveSemantics(win);
      const longActionGuarded = installLongActionLeakGuard(win);

      installSeriesSettingsGuard(win);
      installFontLoadAcceleration(win);
      installCommentSelectionGuard(win);
      installCanvasLossGuard(win, doc);
      installSingleUnloadPrompt(win);
      installHintFallbackGuard(win);
      installAboutSourceNotice(doc);
      const wasmBinaryHandled = releaseWasmBinary(win);

      if (
        sharedWorkerShadowed &&
        fetchFontsGuarded &&
        imagePipelineInstalled &&
        saveSemanticsInstalled &&
        longActionGuarded &&
        wasmBinaryHandled
      ) {
        fullyApplied = true;
      }
    } catch {
      // cross-origin frame -- not the editor, skip
    }
  }
  return fullyApplied;
}
