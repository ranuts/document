import { Div, View } from 'ranui/builder';
import { prefetchOnIntent, type EditorKind } from './prefetch';
import { t } from '@ranuts/shared/i18n';
import { showLoading } from './loading';
import { onCreateNew, onOpenDocument } from './document';

// Landing hero visibility. The hero (#landing-hero) lives in the served HTML for
// SEO/GEO; it toggles in lockstep with the legacy control panel so EVERY show/hide
// path keeps them in sync. Centralizing it here — rather than only in index.ts's
// callbacks — means no raw showControlPanel()/hideControlPanel() call can surface
// the legacy overlay on top of the hero. body.landing-active also lets the page
// scroll and hides the legacy overlay (see styles/base.css); in embed mode CSS
// force-hides the hero regardless.
//
// Unlike the panel singleton below, the hero is NOT built by this module,
// so its absence can't be ruled out at the type level — the lookup is memoized
// (safe: the hero is only ever toggled, never removed or replaced) but stays
// nullable, and callers keep the guard.
let landingHero: HTMLElement | null = null;
const getLandingHero = (): HTMLElement | null => (landingHero ??= document.getElementById('landing-hero'));

export const showLanding = (): void => {
  document.body.classList.add('landing-active');
  const hero = getLandingHero();
  if (hero) hero.style.display = '';
};

export const hideLanding = (): void => {
  document.body.classList.remove('landing-active');
  const hero = getLandingHero();
  if (hero) hero.style.display = 'none';
};

// DOM this module owns, as a lazy singleton — the TS equivalent of a Swift
// `lazy var`: built on first access via `??=`, so consumers always get a
// non-null element and never carry Optional guards. (index.ts still calls the
// create* wrapper at boot, so in practice it is built up front; the laziness
// just makes call order a non-issue.)
let controlPanel: HTMLElement | null = null;

const getControlPanel = (): HTMLElement => (controlPanel ??= buildControlPanel());

// Hide the control panel; a document is taking over.
export const hideControlPanel = (): void => {
  // Dismiss the crawlable landing hero with the panel.
  hideLanding();

  const panel = getControlPanel();
  // Immediately disable pointer events to prevent blocking
  panel.style.pointerEvents = 'none';
  panel.style.opacity = '0';
  // Hide after transition for smooth animation
  setTimeout(() => {
    panel.style.display = 'none';
  }, 300);
};

// Show the control panel; back to the home state.
export const showControlPanel = (): void => {
  // Back to the home state (no document, or an error) — bring the hero back so
  // it, not the legacy overlay, is what the user (and crawlers) see.
  showLanding();
  // Whatever the URL said it would open did not happen (or was closed), so the
  // panel is the home state again; drop the flag that keeps it off the loading
  // screen (index.ts sets it before the panel is built).
  document.body.classList.remove('opening-document');

  const panel = getControlPanel();
  panel.style.display = 'flex';
  setTimeout(() => {
    panel.style.opacity = '1';
  }, 10);
};

// Create and append the control panel.
export const createControlPanel = (): void => {
  getControlPanel();
};

// Build the control panel and mount it (hoisted for the lazy getter).
function buildControlPanel(): HTMLElement {
  // Helper: a text-style r-button. Hover treatment lives in CSS
  // (.control-panel-button:hover in styles/base.css) so it stays tokenized;
  // the old inline host `color` never reached the shadow content anyway.
  const createTextButton = (id: string, text: string, onClick: () => void): HTMLElement =>
    View('r-button')
      .id(id)
      .class('control-panel-button')
      .text(text)
      .attr('variant', 'text')
      .attr('type', 'text')
      .on('click', onClick)
      .build();

  const newDocButton = (id: string, label: string, kind: EditorKind): HTMLElement => {
    const button = createTextButton(id, label, async () => {
      hideControlPanel();
      const { removeLoading } = showLoading();
      try {
        await onCreateNew(`.${kind}`);
      } catch (error) {
        console.error(`Error creating new document (.${kind}):`, error);
        showControlPanel();
      } finally {
        removeLoading();
      }
    });
    // Hovering a New entry is intent: start pulling that engine now. This used
    // to hang off the removed menu's rows; the panel is what is left.
    prefetchOnIntent(button, kind);
    return button;
  };

  const uploadButton = createTextButton('upload-button', t('uploadDocument'), () => {
    onOpenDocument();
    // If user cancelled, nothing happens (onchange won't fire, panel stays visible)
    // If user selected a file, the document opens and the panel hides in handleChange
  });
  // No extension known yet, so this warms the shared loader only.
  prefetchOnIntent(uploadButton);

  // Button group - centered horizontally with wrap support
  const buttonGroup = Div()
    .class('control-panel-button-group')
    .children(
      uploadButton,
      newDocButton('new-word-button', t('newWord'), 'docx'),
      newDocButton('new-excel-button', t('newExcel'), 'xlsx'),
      newDocButton('new-pptx-button', t('newPowerPoint'), 'pptx'),
    )
    .build();

  // Container - centered in viewport
  const container = Div().id('control-panel-container').class('control-panel-container').children(buttonGroup).build();
  document.body.appendChild(container);
  return container;
}
