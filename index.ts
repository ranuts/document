import { shouldReloadOnControllerChange, wireServiceWorkerUpdates } from './lib/sw-update';
import { getAllQueryString } from 'ranuts/utils';
import { View } from 'ranui/builder';
import { initEmbedApi } from './lib/embed-api';
import { initEvents, setEventUICallbacks } from './lib/events';
import { onCreateNew, onOpenDocument, openDocumentFromUrl, openLocalFile, setUICallbacks } from './lib/document';
import { parseReadonly } from '@ranuts/shared/document-utils';
import { applyDocumentLanguage } from '@ranuts/shared/i18n';
import { getDocmentObj } from '@ranuts/shared/store';
import { initAnalytics } from './lib/analytics';
import { createControlPanel, hideControlPanel, hideLanding, showControlPanel } from './lib/ui';
import 'ranui/button';
import 'ranui/card';
import 'ranui/select';
import { initWebMcp } from './lib/web-mcp';
import { installUnsavedChangesGuard } from './lib/unsaved-guard';
import { initDocumentHistory } from './lib/history';
import '@khmyznikov/pwa-install';
import './styles/base.css';

declare global {
  interface Window {
    onCreateNew: (ext: string) => Promise<void>;
    onOpenDocument: () => void;
    hideControlPanel?: () => void;
    showControlPanel?: () => void;
    DocsAPI: {
      DocEditor: new (elementId: string, config: any) => any;
    };
  }
}

// Reflect the detected shell language on <html> (lang, and dir for RTL locales
// like fa). The static landing pages carry their own lang/dir in the HTML.
applyDocumentLanguage();

// Initialize events
initEvents();
initEmbedApi();
// WebMCP (browser-agent tools): no-op unless the browser exposes
// document/navigator.modelContext and this is a top-level window.
initWebMcp();

// Warn before an accidental close/reload throws away edits that never reached
// the user's disk. No-op in embed mode -- the host page owns that UX.
installUnsavedChangesGuard();

// Local history: keep the recovery points in step with what reaches the disk.
initDocumentHistory();

// Privacy-friendly analytics (no-op unless VITE_CF_BEACON_TOKEN is set; never in embed mode)
initAnalytics();

// Set up UI callbacks to avoid circular dependency. The landing hero is toggled
// inside hideControlPanel/showControlPanel themselves (see lib/ui.ts), so these
// raw functions already keep the hero in sync — no re-wrapping needed.
setUICallbacks({
  hideControlPanel,
  showControlPanel,
});

// Set up UI callbacks for events module. Opening a document over the desktop
// integration channel (RENDER_OFFICE) dismisses the landing hero via
// hideControlPanel's built-in hideLanding() call.
setEventUICallbacks({
  hideControlPanel,
});

// Export onCreateNew to window
window.onCreateNew = onCreateNew;
// Expose the upload flow globally so the landing hero (and other host pages) can trigger it.
window.onOpenDocument = onOpenDocument;

// Export control panel functions for use in other modules
window.hideControlPanel = hideControlPanel;
window.showControlPanel = showControlPanel;

// Initialize UI components
createControlPanel();

// This bundle runs on /editor (editor.html). The homepage / is a static landing
// page whose CTAs navigate here (?new=, ?open=local); legacy deep links on /
// are redirected here by an inline script in index.html.
// Check for file or src parameter in URL
// Both parameters support opening document from URL
// Priority: file > src (for backward compatibility)
// Examples:
//   ?file=https://example.com/doc.docx
//   ?src=https://example.com/doc.docx
//   ?file=doc1.docx&src=doc2.xlsx (will use file: doc1.docx)
const { file, src, readonly, agent } = getAllQueryString();
const documentUrl = file || src;
// Pure preview mode: ?readonly=true (also accepts ?readonly=1 or bare ?readonly).
// Opens the document with editing/download disabled (#25, #85, #87).
const isReadonly = parseReadonly(readonly);
// Experimental AI agent panel: opt-in via ?agent=1 (also ?agent=true or bare ?agent).
const agentEnabled = agent === '1' || agent === 'true' || agent === '';
// Expose the opt-in to the editor iframe (same-origin) so its injected patch only
// adds the "AI" button when the agent feature is enabled — otherwise the button
// stays hidden. See public/onlyoffice-v7-iframe-patch.js.
(window as unknown as { __agentEnabled?: boolean }).__agentEnabled = agentEnabled;
if (agentEnabled) {
  void import('./lib/agent-plugin').then(({ createAgentPanel }) => createAgentPanel());
}
// Bridge: the AI button injected into OnlyOffice's left menu lives inside the
// (same-origin) editor iframe. It toggles the panel either by calling this
// global directly or, as a fallback, by posting `agent:toggle` to this window.
const toggleAgentPanelLazy = (): void => {
  void import('./lib/agent-plugin').then(({ toggleAgentPanel }) => toggleAgentPanel());
};
(window as unknown as { __toggleAgentPanel?: () => void }).__toggleAgentPanel = toggleAgentPanelLazy;
window.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'agent:toggle') toggleAgentPanelLazy();
});
// Deep-link to a blank document: ?new=docx|xlsx|pptx opens the editor straight
// into a new file (skipping the landing hero). The localized homepages use it —
// e.g. /zh-CN/ links to `/?locale=zh-CN&new=docx`, so i18n (which reads ?locale)
// boots the editor UI in Chinese and drops the user directly into editing.
const newExtRaw = getAllQueryString()['new'];
const newExt = typeof newExtRaw === 'string' ? newExtRaw.replace(/^\./, '').toLowerCase() : '';
const createNewOnLoad = ['docx', 'xlsx', 'pptx'].includes(newExt) && !documentUrl;
// `?open=local`: a static landing page (e.g. /zh-CN/) stashed a picked file in
// IndexedDB via public/open-local.js — take it out and open it on boot.
const openParam = getAllQueryString()['open'];
const openLocalOnLoad = openParam === 'local' && !documentUrl && !createNewOnLoad;
// `?saved=<id>`: which of this browser's saved documents to open. Every
// editing session stamps its own id here (see lib/history/session.ts), so a
// reload comes back to the same document instead of a second blank one, and
// the Open link on /history is the URL the editor was already using.
//
// A query parameter rather than a path segment, deliberately. Google Docs and
// Figma put ids in the path because those ids name something on a server that
// anyone with the link can open; this one names a row in one browser's
// IndexedDB. In a path it would look shareable, and the person it was sent to
// would open an empty editor. It is also why it is not called `id`: what makes
// it meaningful is not that it is an identifier, it is that the document is
// saved on this device.
const savedParam = getAllQueryString()['saved'] ?? '';

// Landing hero orchestration. Only the bare homepage (no ?file/?src/?new, not
// embedded) shows the crawlable hero. If a document is about to load or be
// created, or we're embedded, hide it immediately to avoid a flash before the
// editor takes over.
const isEmbedded = document.body.classList.contains('embed-mode');
if (documentUrl || isEmbedded || createNewOnLoad || openLocalOnLoad || savedParam) {
  hideLanding();
} else {
  // Bare /editor with nothing to open: the landing lives at / now.
  window.location.replace('/');
}

void (async () => {
  // A stored snapshot wins over every other way of opening: it is strictly
  // newer than the file on disk or the blank document the other parameters
  // would produce, and it is the copy nobody else has.
  if (savedParam && !isEmbedded) {
    const [{ getDoc }, { restoreDocument }] = await Promise.all([
      import('./lib/history/store'),
      import('./lib/history/recovery'),
    ]);
    const doc = await getDoc(savedParam);
    if (doc && (await restoreDocument(doc))) return;
    // No snapshot yet (nothing was edited before the reload) or it expired:
    // fall through and open the same document again under the same id.
  }

  if (documentUrl) {
    try {
      const decodedUrl = decodeURIComponent(documentUrl);
      await openDocumentFromUrl(decodedUrl, undefined, { readonly: isReadonly, docId: savedParam || undefined });
    } catch (error) {
      // If decoding fails, try using original URL
      console.warn('Failed to decode URL, using original:', error);
      await openDocumentFromUrl(documentUrl, undefined, { readonly: isReadonly, docId: savedParam || undefined });
    }
    return;
  }

  if (createNewOnLoad && !isEmbedded) {
    await onCreateNew(`.${newExt}`, { docId: savedParam || undefined });
    return;
  }

  if (openLocalOnLoad && !isEmbedded) {
    const { takePendingFile } = await import('./lib/pending-open');
    const file = await takePendingFile();
    // One-shot param: strip it so a reload lands on the plain homepage instead
    // of hiding the hero again with nothing left to open.
    const cleaned = new URL(window.location.href);
    cleaned.searchParams.delete('open');
    window.history.replaceState(null, '', cleaned);
    if (file) {
      await openLocalFile(file, { historyId: savedParam || undefined });
      return;
    }
    // Stale deep link (reload, bookmarked URL): nothing pending -- back to the landing.
    window.location.replace('/');
    return;
  }

  // `?saved=` on its own and nothing stored under it: the document it names was
  // deleted or has expired, so there is nothing here to show.
  if (savedParam && !isEmbedded) window.location.replace('/');
})();

// No boot-time recovery offer here on purpose. /editor never opens empty (a
// bare visit is redirected to the landing above), so anything shown on boot
// interrupts a document the user is already working in to talk about a
// different one -- which is what it did, and it was wrong every time. Old work
// is offered where the user is not mid-task instead: the landing page's
// "continue last time" line (public/history-recent.js) and /history.

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  // Update policy lives in lib/sw-update.ts: a new build's worker waits until
  // no document is open, then takes over and the page reloads once.
  const hadController = !!navigator.serviceWorker.controller;
  let reloadingForUpdate = false;
  const hasOpenDocument = () => Boolean(getDocmentObj().fileName);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (
      !shouldReloadOnControllerChange({
        hadController,
        alreadyReloading: reloadingForUpdate,
        hasOpenDocument: hasOpenDocument(),
      })
    ) {
      return;
    }
    reloadingForUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        wireServiceWorkerUpdates(registration, hasOpenDocument);
        // Check for updates on every page load. Firefox rejects the update
        // when the registration changed since it was scheduled (a benign race
        // right after register()); swallow it so it never surfaces as an
        // unhandled rejection.
        registration.update().catch(() => {});
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Initialize PWA install component — built with the ranui builder (ecosystem
// convention: no hand-rolled createElement/setAttribute chains).
const initPwaInstall = () => {
  // Use the browser's native resolution from the existing link tags
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  const builder = View('pwa-install')
    .id('pwa-install')
    // use-local-storage: avoid showing the prompt too often
    .attr('use-local-storage', '')
    .attr('name', 'Document Editor')
    .attr('description', 'A privacy-focused, local web-based document editor.')
    .attr('install-description', 'Install the App for a better offline experience and quick access.');
  if (manifest?.href) builder.attr('manifest-url', manifest.href);
  if (icon?.href) builder.attr('icon', icon.href);

  document.body.appendChild(builder.build());
};

// Start PWA initialization after short delay to ensure everything is settled
setTimeout(initPwaInstall, 1000);
