import { getAllQueryString } from 'ranuts/utils';
import { initEmbedApi } from './lib/embed-api';
import { initEvents, setEventUICallbacks } from './lib/events';
import { onCreateNew, onOpenDocument, openDocumentFromUrl, setUICallbacks } from './lib/document';
import { parseReadonly } from '@ranuts/shared/document-utils';
import { getDocmentObj } from '@ranuts/shared/store';
import { initAnalytics } from './lib/analytics';
import {
  createControlPanel,
  createFixedActionButton,
  hideControlPanel,
  hideLanding,
  showControlPanel,
  showLanding,
  showMenuGuide,
} from './lib/ui';
import 'ranui/button';
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

// Initialize events
initEvents();
initEmbedApi();

// Privacy-friendly analytics (no-op unless VITE_CF_BEACON_TOKEN is set; never in embed mode)
initAnalytics();

// Set up UI callbacks to avoid circular dependency. The landing hero is toggled
// inside hideControlPanel/showControlPanel themselves (see lib/ui.ts), so these
// raw functions already keep the hero in sync — no re-wrapping needed.
setUICallbacks({
  hideControlPanel,
  showControlPanel,
  showMenuGuide,
});

// Set up UI callbacks for events module. Opening a document over the desktop
// integration channel (RENDER_OFFICE) dismisses the landing hero via
// hideControlPanel's built-in hideLanding() call.
setEventUICallbacks({
  hideControlPanel,
  showMenuGuide,
});

// Export onCreateNew to window
window.onCreateNew = onCreateNew;
// Expose the upload flow globally so the landing hero (and other host pages) can trigger it.
window.onOpenDocument = onOpenDocument;

// Export control panel functions for use in other modules
window.hideControlPanel = hideControlPanel;
window.showControlPanel = showControlPanel;

// Initialize UI components
createFixedActionButton();
createControlPanel();

// Wire the landing hero CTAs: primary opens the file picker, secondary starts a
// blank DOCX. Both funnel into the same flows the legacy control panel uses.
const heroOpen = document.getElementById('hero-open');
if (heroOpen) heroOpen.addEventListener('click', () => onOpenDocument());
const heroNew = document.getElementById('hero-new');
if (heroNew) heroNew.addEventListener('click', () => void window.onCreateNew('.docx'));

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
// Landing hero orchestration. Only the bare homepage (no ?file/?src, not embedded)
// shows the crawlable hero. If a document is about to load, or we're embedded,
// hide it immediately to avoid a flash before the editor takes over.
const isEmbedded = document.body.classList.contains('embed-mode');
if (documentUrl || isEmbedded) {
  hideLanding();
} else {
  showLanding();
}

if (documentUrl) {
  // Decode URL if it's encoded
  try {
    const decodedUrl = decodeURIComponent(documentUrl);
    // Open document from URL
    openDocumentFromUrl(decodedUrl, undefined, { readonly: isReadonly });
  } catch (error) {
    // If decoding fails, try using original URL
    console.warn('Failed to decode URL, using original:', error);
    openDocumentFromUrl(documentUrl, undefined, { readonly: isReadonly });
  }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  // Whether a SW was already controlling this page when it started. Each deploy
  // rebuilds sw.js with a fresh CACHE_VERSION; the new SW skipWaiting()s and
  // claims clients, firing `controllerchange`. If a SW was ALREADY in control at
  // startup, that event means a *new build* took over — not the first install —
  // so we can reload once to swap the stale assets for the fresh ones. Without
  // this, the current page keeps rendering the previously-cached build until the
  // user manually refreshes (the "refresh once more and it's fixed" symptom).
  const hadController = !!navigator.serviceWorker.controller;
  let reloadingForUpdate = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Guard 1: only on a real update (not first install). Guard 2: reload once.
    // Guard 3: never while a document is open — a reload would discard unsaved
    // edits. On the landing page fileName is empty, so the reload is invisible.
    if (!hadController || reloadingForUpdate) return;
    if (getDocmentObj().fileName) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        // Check for updates on every page load
        registration.update();
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Initialize PWA install component
const initPwaInstall = () => {
  const pwaInstall = document.createElement('pwa-install');
  pwaInstall.id = 'pwa-install';

  // Optimization: Only use attributes that enhance the specific project experience
  // Use local storage to avoid showing the prompt too often
  pwaInstall.setAttribute('use-local-storage', '');

  // Professional branding
  pwaInstall.setAttribute('name', 'Document Editor');
  pwaInstall.setAttribute('description', 'A privacy-focused, local web-based document editor.');
  pwaInstall.setAttribute('install-description', 'Install the App for a better offline experience and quick access.');

  // Use the browser's native resolution from the existing link tags
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (manifest?.href) pwaInstall.setAttribute('manifest-url', manifest.href);
  if (icon?.href) pwaInstall.setAttribute('icon', icon.href);

  document.body.appendChild(pwaInstall);
};

// Start PWA initialization after short delay to ensure everything is settled
setTimeout(initPwaInstall, 1000);
