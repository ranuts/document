import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { t } from './i18n';
import { showLoading } from './loading';
import { onCreateNew, onOpenDocument } from './document';

// Hide control panel and show top floating bar
export const hideControlPanel = (): void => {
  const container = document.querySelector('#control-panel-container') as HTMLElement;
  if (container) {
    // Immediately disable pointer events to prevent blocking
    container.style.pointerEvents = 'none';
    container.style.opacity = '0';
    // Hide after transition for smooth animation
    setTimeout(() => {
      container.style.display = 'none';
      showTopFloatingBar();
    }, 300);
  }
};

// Show control panel and hide FAB
export const showControlPanel = (): void => {
  const container = document.querySelector('#control-panel-container') as HTMLElement;
  const fabContainer = document.querySelector('#fab-container') as HTMLElement;
  if (container) {
    container.style.display = 'flex';
    setTimeout(() => {
      container.style.opacity = '1';
    }, 10);
  }
  if (fabContainer) {
    fabContainer.style.display = 'none';
  }
};

// Show fixed action button
const showTopFloatingBar = (): void => {
  const fabContainer = document.querySelector('#fab-container') as HTMLElement;
  if (fabContainer) {
    fabContainer.style.display = 'block';
  }
};

// Create fixed action button in bottom right corner
export const createFixedActionButton = (): HTMLElement => {
  const fabContainer = document.createElement('div');
  fabContainer.id = 'fab-container';
  fabContainer.className = 'fab-container';

  // Main FAB button
  const fabButton = document.createElement('button');
  fabButton.id = 'fab-button';
  fabButton.textContent = t('menu');
  fabButton.className = 'fab-button';

  // Menu panel - compact style
  const menuPanel = document.createElement('div');
  menuPanel.id = 'fab-menu';
  menuPanel.className = 'fab-menu';

  const createMenuButton = (text: string, onClick: () => void | Promise<void>, showLoadingImmediately = true) => {
    // Create wrapper for the entire menu item
    const menuItem = document.createElement('div');
    menuItem.className = 'fab-menu-item';

    const button = document.createElement('button');
    button.textContent = text;
    button.className = 'fab-menu-button';

    // Handle hover on the wrapper
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.background = '#f5f5f5';
    });
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.background = 'transparent';
    });

    button.addEventListener('click', async () => {
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
    });

    menuItem.appendChild(button);
    return menuItem;
  };

  menuPanel.appendChild(
    createMenuButton(
      t('uploadDocument'),
      async () => {
        const result = await onOpenDocument();
        // If user cancelled file selection, show control panel again
        // (FAB menu will be hidden by hideMenu() call in createMenuButton)
        if (!result) {
          showControlPanel();
        }
      },
      false, // Don't show loading immediately - wait for file selection
    ),
  );
  menuPanel.appendChild(
    createMenuButton(t('newWord'), async () => {
      await onCreateNew('.docx');
    }),
  );
  menuPanel.appendChild(
    createMenuButton(t('newExcel'), async () => {
      await onCreateNew('.xlsx');
    }),
  );
  menuPanel.appendChild(
    createMenuButton(t('newPowerPoint'), async () => {
      await onCreateNew('.pptx');
    }),
  );

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

  // Show menu on hover button
  fabButton.addEventListener('mouseenter', () => {
    showMenu();
  });

  // Hide menu when leaving button (if not moving to menu)
  fabButton.addEventListener('mouseleave', (e) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    // If moving to menu panel, don't hide
    if (relatedTarget && (relatedTarget === menuPanel || menuPanel.contains(relatedTarget))) {
      return;
    }
    hideMenuTimeout = setTimeout(() => {
      hideMenu();
    }, 200);
  });

  // Keep menu visible when hovering over it
  menuPanel.addEventListener('mouseenter', () => {
    clearTimeout(hideMenuTimeout);
    if (!isMenuOpen) {
      showMenu();
    }
  });

  // Hide menu when leaving menu panel
  menuPanel.addEventListener('mouseleave', () => {
    hideMenuTimeout = setTimeout(() => {
      hideMenu();
    }, 200);
  });

  fabContainer.appendChild(menuPanel);
  fabContainer.appendChild(fabButton);
  document.body.appendChild(fabContainer);
  return fabContainer;
};

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

  const fabButton = document.querySelector('#fab-button') as HTMLElement;
  if (!fabButton) {
    return;
  }

  // Create guide container
  const guide = document.createElement('div');
  guide.id = 'menu-guide';
  guide.className = 'menu-guide';

  // Create arrow pointing down
  const arrow = document.createElement('div');
  arrow.className = 'menu-guide-arrow';

  // Create text content
  const text = document.createElement('div');
  text.textContent = t('menuGuide');
  text.className = 'menu-guide-text';

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.className = 'menu-guide-close';

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.color = '#333';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.color = '#999';
  });

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

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideGuide(true);
  });

  guide.appendChild(arrow);
  guide.appendChild(text);
  guide.appendChild(closeBtn);
  document.body.appendChild(guide);
  menuGuideElement = guide;

  // Auto hide after 5 seconds (don't save to storage)
  setTimeout(() => {
    if (menuGuideElement === guide) {
      hideGuide(false);
    }
  }, 5000);

  // Hide when hovering over menu button (don't save to storage)
  fabButton.addEventListener(
    'mouseenter',
    () => {
      if (menuGuideElement === guide) {
        hideGuide(false);
      }
    },
    { once: true },
  );
};

// Create and append the control panel
export const createControlPanel = (): void => {
  // Create control panel container - centered in viewport
  const container = document.createElement('div');
  container.id = 'control-panel-container';
  container.className = 'control-panel-container';

  // Create button group - centered horizontally with wrap support
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'control-panel-button-group';

  // Helper function to create text button
  const createTextButton = (id: string, text: string, onClick: () => void) => {
    const button = document.createElement('r-button');
    button.id = id;
    button.textContent = text;
    button.setAttribute('variant', 'text');
    button.setAttribute('type', 'text');
    button.className = 'control-panel-button';

    button.addEventListener('mouseenter', () => {
      button.style.color = '#667eea';
      button.style.transform = 'scale(1.05)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.color = '#333';
      button.style.transform = 'scale(1)';
    });
    button.addEventListener('click', onClick);

    return button;
  };

  // Create four buttons
  const uploadButton = createTextButton('upload-button', t('uploadDocument'), async () => {
    const result = await onOpenDocument();
    // Only hide control panel if file was successfully selected
    // If user cancelled, control panel remains visible
    if (result) {
      hideControlPanel();
    }
  });
  buttonGroup.appendChild(uploadButton);

  const newWordButton = createTextButton('new-word-button', t('newWord'), async () => {
    hideControlPanel();
    const { removeLoading } = showLoading();
    try {
      await onCreateNew('.docx');
    } catch (error) {
      console.error('Error creating new Word document:', error);
      showControlPanel();
    } finally {
      removeLoading();
    }
  });
  buttonGroup.appendChild(newWordButton);

  const newExcelButton = createTextButton('new-excel-button', t('newExcel'), async () => {
    hideControlPanel();
    const { removeLoading } = showLoading();
    try {
      await onCreateNew('.xlsx');
    } catch (error) {
      console.error('Error creating new Excel document:', error);
      showControlPanel();
    } finally {
      removeLoading();
    }
  });
  buttonGroup.appendChild(newExcelButton);

  const newPptxButton = createTextButton('new-pptx-button', t('newPowerPoint'), async () => {
    hideControlPanel();
    const { removeLoading } = showLoading();
    try {
      await onCreateNew('.pptx');
    } catch (error) {
      console.error('Error creating new PowerPoint document:', error);
      showControlPanel();
    } finally {
      removeLoading();
    }
  });
  buttonGroup.appendChild(newPptxButton);

  container.appendChild(buttonGroup);
  document.body.appendChild(container);
};
