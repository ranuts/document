/**
 * Shadow SharedWorker inside the editor iframe. The SDK's local spellchecker
 * prefers `new SharedWorker(spell.js, ...)`, and loading that script on a cold
 * profile of a service-worker-controlled origin hangs forever in Chromium (the
 * request never settles; warm profiles are immune only because the previous
 * page's named SharedWorker is still alive and gets reused without a fetch).
 * The stuck load keeps isDocumentLoadComplete false, which silently breaks
 * every save and export. With SharedWorker absent, CSpellchecker falls back to
 * a plain dedicated Worker, which loads fine.
 */
export function shadowSharedWorker(frame: Window): boolean {
  const win = frame as Window & { __ooSharedWorkerShadowed?: boolean };
  if (!win.__ooSharedWorkerShadowed) {
    Object.defineProperty(win, 'SharedWorker', { value: undefined, configurable: true });
    win.__ooSharedWorkerShadowed = true;
    console.log('[OO] SharedWorker shadowed in editor iframe (spellchecker uses a dedicated worker)');
  }
  return Boolean(win.__ooSharedWorkerShadowed);
}
