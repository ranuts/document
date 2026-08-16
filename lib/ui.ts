import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { ButtonBuilder, Div, View } from 'ranui/builder';
import { prefetchEditorAssets, type EditorKind } from './prefetch';
import { t } from '@ranuts/shared/i18n';
import { showLoading } from './loading';
import { onCreateNew, onOpenDocument } from './document';

// Landing hero visibility. The hero (#landing-hero) lives in the served HTML for
// SEO/GEO; it toggles in lockstep with the legacy control panel so EVERY show/hide
// path (including the FAB error fallbacks below) keeps them in sync. Centralizing
// it here — rather than only in index.ts's callbacks — means no raw
// showControlPanel()/hideControlPanel() call can surface the legacy overlay on top
// of the hero. body.landing-active also lets the page scroll and hides the legacy
// overlay (see styles/base.css); in embed mode CSS force-hides the hero regardless.
//
// Unlike the panel/FAB singletons below, the hero is NOT built by this module,
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

// DOM this module owns, as lazy singletons — the TS equivalent of a Swift
// `lazy var`: built on first access via `??=`, so consumers always get a
// non-null element and never carry Optional guards. The two FAB elements live
// in one object because they're created together and only make sense together.
// (index.ts still calls the create* wrappers at boot, so in practice
// everything is built up front; the laziness just makes call order a non-issue.)
let controlPanel: HTMLElement | null = null;
let fab: { container: HTMLElement; button: HTMLElement } | null = null;

const getControlPanel = (): HTMLElement => (controlPanel ??= buildControlPanel());
const getFab = (): { container: HTMLElement; button: HTMLElement } => (fab ??= buildFab());

// Hide control panel and show top floating bar
export const hideControlPanel = (): void => {
  // A document is taking over — dismiss the crawlable landing hero with the panel.
  hideLanding();

  // Always ensure FAB is visible when hiding control panel
  getFab().container.style.display = 'block';

  const panel = getControlPanel();
  // Immediately disable pointer events to prevent blocking
  panel.style.pointerEvents = 'none';
  panel.style.opacity = '0';
  // Hide after transition for smooth animation
  setTimeout(() => {
    panel.style.display = 'none';
  }, 300);
};

// Show control panel and hide FAB
export const showControlPanel = (): void => {
  // Back to the home state (no document, or an error) — bring the hero back so
  // it, not the legacy overlay, is what the user (and crawlers) see.
  showLanding();

  const panel = getControlPanel();
  panel.style.display = 'flex';
  setTimeout(() => {
    panel.style.opacity = '1';
  }, 10);
  // Only hide FAB if editor is not open
  // If editor is already open, keep FAB visible so user can access menu
  if (!window.editor) {
    getFab().container.style.display = 'none';
  }
};

// Create fixed action button in bottom right corner. Kept as the public
// boot-time API (index.ts warms the UI up front); idempotent via the lazy
// getter, so a second call never builds a duplicate.
export const createFixedActionButton = (): HTMLElement => getFab().container;

// Build the FAB (menu panel + trigger button) and mount it. Function
// declaration (hoisted) so the lazy getters above can reference it.
function buildFab(): { container: HTMLElement; button: HTMLElement } {
  let isMenuOpen = false;
  let hideMenuTimeout: NodeJS.Timeout;

  const showMenu = () => {
    clearTimeout(hideMenuTimeout);
    isMenuOpen = true;
    menuPanel.style.display = 'flex';
    menuPanel.style.pointerEvents = 'auto';
    setTimeout(() => {
      menuPanel.style.opacity = '1';
      menuPanel.style.transform = 'translateY(0) scale(1)';
    }, 10);
  };

  const hideMenu = () => {
    isMenuOpen = false;
    menuPanel.style.opacity = '0';
    menuPanel.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => {
      menuPanel.style.display = 'none';
      menuPanel.style.pointerEvents = 'none';
    }, 200);
  };

  const createMenuButton = (
    text: string,
    onClick: () => void | Promise<void>,
    showLoadingImmediately = true,
    prefetchKind?: EditorKind | 'loader',
  ): HTMLDivElement =>
    Div()
      .class('fab-menu-item')
      .children(
        ButtonBuilder()
          .class('fab-menu-button')
          .text(text)
          // Hovering a New/Open entry is intent: start pulling the engine now.
          .on('pointerenter', () => {
            if (prefetchKind) prefetchEditorAssets(prefetchKind === 'loader' ? undefined : prefetchKind);
          })
          .on('click', async () => {
            hideMenu();
            // Only show loading immediately if specified (for operations that don't require user interaction)
            let removeLoading: (() => void) | null = null;
            if (showLoadingImmediately) {
              const loadingResult = showLoading();
              removeLoading = loadingResult.removeLoading;
            }
            try {
              // Small delay to ensure menu hide animation completes
              await new Promise((resolve) => setTimeout(resolve, 100));
              await onClick();
            } catch (error) {
              console.error('Error in menu button action:', error);
              // Show control panel on error
              showControlPanel();
            } finally {
              // Only remove loading if it was shown
              if (removeLoading) {
                removeLoading();
              }
            }
          })
          .build(),
      )
      .build();

  // Menu panel - compact style
  const menuPanel = Div()
    .id('fab-menu')
    .class('fab-menu')
    .children(
      createMenuButton(
        t('uploadDocument'),
        () => {
          onOpenDocument();
          // If user cancelled, nothing happens (onchange won't fire)
          // If user selected file, document will be opened in handleChange
        },
        false, // Don't show loading immediately - wait for file selection
        'loader',
      ),
      createMenuButton(
        t('newWord'),
        async () => {
          await onCreateNew('.docx');
        },
        true,
        'docx',
      ),
      createMenuButton(
        t('newExcel'),
        async () => {
          await onCreateNew('.xlsx');
        },
        true,
        'xlsx',
      ),
      createMenuButton(
        t('newPowerPoint'),
        async () => {
          await onCreateNew('.pptx');
        },
        true,
        'pptx',
      ),
      // AI assistant entry — lazy-loads the agent panel on first click (no bundle
      // cost until used). Idempotent: if a panel already exists (e.g. opened via
      // ?agent=1 or a prior click), do nothing and let its own launcher reopen it.
      createMenuButton(
        t('agentTitle'),
        async () => {
          if (document.querySelector('.agent-panel')) return;
          const { createAgentPanel } = await import('./agent-plugin');
          createAgentPanel();
        },
        false,
      ),
      // Light / dark / system. The landing hero has the same <r-theme-switch>
      // in its footer, but the hero is hidden once a document is open and the
      // editor follows the site theme (lib/editor-theme.ts) -- without this
      // row there is no way to flip it while editing.
      Div()
        .class('fab-menu-item fab-menu-theme')
        .children(
          View('r-theme-switch')
            .class('theme-switch')
            .attr('label', t('themeLabel'))
            .attr('label-system', t('themeSystem'))
            .attr('label-light', t('themeLight'))
            .attr('label-dark', t('themeDark')),
        ),
    )
    // Keep menu visible when hovering over it
    .on('mouseenter', () => {
      clearTimeout(hideMenuTimeout);
      if (!isMenuOpen) {
        showMenu();
      }
    })
    // Hide menu when leaving menu panel
    .on('mouseleave', () => {
      hideMenuTimeout = setTimeout(() => {
        hideMenu();
      }, 200);
    })
    .build();

  // Main FAB button
  const button = ButtonBuilder()
    .id('fab-button')
    .class('fab-button')
    .text(t('menu'))
    // Show menu on hover button
    .on('mouseenter', () => {
      showMenu();
    })
    // Hide menu when leaving button (if not moving to menu)
    .on('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      // If moving to menu panel, don't hide
      if (relatedTarget && (relatedTarget === menuPanel || menuPanel.contains(relatedTarget))) {
        return;
      }
      hideMenuTimeout = setTimeout(() => {
        hideMenu();
      }, 200);
    })
    .build();

  const container = Div().id('fab-container').class('fab-container').children(menuPanel, button).build();
  document.body.appendChild(container);
  return { container, button };
}

// Show menu guide tooltip
let menuGuideElement: HTMLElement | null = null;
const MENU_GUIDE_DISMISSED_KEY = 'menu-guide-dismissed';

export const showMenuGuide = (): void => {
  // Check if guide was dismissed in localStorage
  if (localStorageGetItem(MENU_GUIDE_DISMISSED_KEY) === 'true') {
    return;
  }

  // Check if guide was already shown in this session
  if (menuGuideElement) {
    return;
  }

  const { button } = getFab();

  const hideGuide = (saveToStorage = false) => {
    if (saveToStorage) {
      localStorageSetItem(MENU_GUIDE_DISMISSED_KEY, 'true');
    }
    if (guide.parentNode) {
      guide.style.animation = 'guideFadeOut 0.3s ease';
      setTimeout(() => {
        if (guide.parentNode) {
          guide.parentNode.removeChild(guide);
        }
        menuGuideElement = null;
      }, 300);
    }
  };

  const guide = Div()
    .id('menu-guide')
    .class('menu-guide')
    .children(
      Div().class('menu-guide-arrow').build(),
      Div().class('menu-guide-text').text(t('menuGuide')).build(),
      ButtonBuilder()
        .class('menu-guide-close')
        .text('×')
        .on('click', (e) => {
          e.stopPropagation();
          hideGuide(true);
        })
        .build(),
    )
    .build();

  document.body.appendChild(guide);
  menuGuideElement = guide;

  // Auto hide after 5 seconds (don't save to storage)
  setTimeout(() => {
    if (menuGuideElement === guide) {
      hideGuide(false);
    }
  }, 5000);

  // Hide when hovering over menu button (don't save to storage)
  button.addEventListener(
    'mouseenter',
    () => {
      if (menuGuideElement === guide) {
        hideGuide(false);
      }
    },
    { once: true },
  );
};

// Create and append the control panel. Same boot-time wrapper pattern as
// createFixedActionButton above.
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

  const newDocButton = (id: string, label: string, ext: string): HTMLElement =>
    createTextButton(id, label, async () => {
      hideControlPanel();
      const { removeLoading } = showLoading();
      try {
        await onCreateNew(ext);
      } catch (error) {
        console.error(`Error creating new document (${ext}):`, error);
        showControlPanel();
      } finally {
        removeLoading();
      }
    });

  // Button group - centered horizontally with wrap support
  const buttonGroup = Div()
    .class('control-panel-button-group')
    .children(
      createTextButton('upload-button', t('uploadDocument'), () => {
        onOpenDocument();
        // If user cancelled, nothing happens (onchange won't fire, panel stays visible)
        // If user selected a file, the document opens and the panel hides in handleChange
      }),
      newDocButton('new-word-button', t('newWord'), '.docx'),
      newDocButton('new-excel-button', t('newExcel'), '.xlsx'),
      newDocButton('new-pptx-button', t('newPowerPoint'), '.pptx'),
    )
    .build();

  // Container - centered in viewport
  const container = Div().id('control-panel-container').class('control-panel-container').children(buttonGroup).build();
  document.body.appendChild(container);
  return container;
}
