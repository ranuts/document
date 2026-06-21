import { getAllQueryString } from 'ranuts/utils';
import { setDocumentStateGetter } from '@bybrowser/editor';
import { getDocmentObj } from './store';
import { initEmbedApi } from './lib/embed-api';
import { initEvents, setEventUICallbacks } from './lib/events';
import { onCreateNew, openDocumentFromUrl, setUICallbacks } from './lib/document';
import {
  createControlPanel,
  createFixedActionButton,
  createLandingNav,
  hideControlPanel,
  showControlPanel,
  showMenuGuide,
} from './lib/ui';
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

// Initialize events
initEvents();
initEmbedApi();

// Set up UI callbacks to avoid circular dependency
setUICallbacks({
  hideControlPanel,
  showControlPanel,
  showMenuGuide,
});

// Set up UI callbacks for events module
setEventUICallbacks({
  hideControlPanel,
  showMenuGuide,
});

// Export onCreateNew to window
window.onCreateNew = onCreateNew;

// Export control panel functions for use in other modules
window.hideControlPanel = hideControlPanel;
window.showControlPanel = showControlPanel;

// Map clean editor routes to their document extension.
// These pages auto-open the corresponding document type without showing the landing UI.
const EDITOR_ROUTES: Record<string, string> = {
  '/docx/': '.docx',
  '/xlsx/': '.xlsx',
  '/pptx/': '.pptx',
  '/csv/': '.csv',
};

// Detect editor route by checking if the pathname ends with one of the known suffixes.
// Handles both bare deployments (/) and version-prefixed ones (/9.3.0/).
function getEditorExt(): string | null {
  const p = location.pathname;
  for (const [route, ext] of Object.entries(EDITOR_ROUTES)) {
    if (p.endsWith(route)) return ext;
  }
  return null;
}

const editorExt = getEditorExt();

// Initialize UI components
createLandingNav();
createFixedActionButton();

if (editorExt) {
  // Editor route (/docx/, /xlsx/ …): skip landing panel, auto-open document.
  // The FAB is still created above so the user can save / open other files.
  const { file, src } = getAllQueryString();
  const documentUrl = file || src;
  if (documentUrl) {
    try {
      openDocumentFromUrl(decodeURIComponent(documentUrl));
    } catch {
      openDocumentFromUrl(documentUrl);
    }
  } else {
    onCreateNew(editorExt);
  }
} else {
  // Home route: show landing control panel.
  createControlPanel();

  // Check for file or src parameter in URL (e.g. ?src=https://example.com/doc.docx)
  const { file, src } = getAllQueryString();
  const documentUrl = file || src;
  if (documentUrl) {
    try {
      openDocumentFromUrl(decodeURIComponent(documentUrl));
    } catch {
      openDocumentFromUrl(documentUrl);
    }
  }
}

// Register Service Worker for PWA.
// Keep Vite dev uncached; a stale SW can intercept /src/*.ts as HTML.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
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
