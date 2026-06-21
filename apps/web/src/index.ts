import { setDocumentStateGetter } from '@bybrowser/editor';
import { getDocmentObj } from './store';
import { initEmbedApi } from './lib/embed-api';
import { initEvents, setEventUICallbacks } from './lib/events';
import { onCreateNew, openDocumentFromUrl, setUICallbacks } from './lib/document';
import {
  createControlPanel,
  createLandingNav,
  hideControlPanel,
  showControlPanel,
} from './lib/ui';
import { getStartupAction, registerLocalFilePopstate } from './lib/app-router';
import 'ranui/button';
import '@khmyznikov/pwa-install';
import './styles/base.css';

declare global {
  interface Window {
    onCreateNew: (ext: string) => Promise<void>;
    hideControlPanel?: () => void;
    showControlPanel?: () => void;
    DocsAPI: {
      DocEditor: new (elementId: string, config: any) => any;
    };
  }
}

// Inject store getter into editor package (breaks circular dep)
setDocumentStateGetter(() => getDocmentObj());

// Initialize events and embed API
initEvents();
initEmbedApi();

// Wire up callback-based decoupling
setUICallbacks({ hideControlPanel, showControlPanel });
setEventUICallbacks({ hideControlPanel });

// Expose to window for legacy callers
window.onCreateNew = onCreateNew;
window.hideControlPanel = hideControlPanel;
window.showControlPanel = showControlPanel;

// --- Routing ---

createLandingNav();

const action = getStartupAction();

switch (action.type) {
  case 'home': {
    createControlPanel();
    // Register popstate so the back button works after opening a local file
    // (local files use pushState/SPA navigation, not a real page load).
    registerLocalFilePopstate({
      showHome: showControlPanel,
      destroyEditor: () => {
        try {
          window.editor?.destroyEditor?.();
        } catch {
          // ignore
        }
        window.editor = undefined;
        document.getElementById('iframe')?.replaceChildren();
      },
    });
    break;
  }

  case 'editor-new': {
    onCreateNew(action.ext);
    break;
  }

  case 'editor-url': {
    openDocumentFromUrl(action.url);
    break;
  }

  case 'editor-file-lost': {
    // Local file data can't survive a page reload.
    // Fall back to home so the user can re-open the file.
    createControlPanel();
    // TODO: surface a toast/banner explaining why the file is gone
    break;
  }
}

// --- Service Worker ---

if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        registration.update();
      })
      .catch(() => {});
  });
}

// --- PWA install prompt ---

const initPwaInstall = () => {
  const pwaInstall = document.createElement('pwa-install');
  pwaInstall.id = 'pwa-install';
  pwaInstall.setAttribute('use-local-storage', '');
  pwaInstall.setAttribute('name', 'Document Editor');
  pwaInstall.setAttribute('description', 'A privacy-focused, local web-based document editor.');
  pwaInstall.setAttribute(
    'install-description',
    'Install the App for a better offline experience and quick access.',
  );

  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (manifest?.href) pwaInstall.setAttribute('manifest-url', manifest.href);
  if (icon?.href) pwaInstall.setAttribute('icon', icon.href);

  document.body.appendChild(pwaInstall);
};

setTimeout(initPwaInstall, 1000);
