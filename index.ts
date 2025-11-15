import { MessageCodec, Platform, getAllQueryString } from 'ranuts/utils';
import type { MessageHandler } from 'ranuts/utils';
import { handleDocumentOperation, initX2T, loadEditorApi, loadScript } from './lib/x2t';
import { getDocmentObj, setDocmentObj } from './store';
import { showLoading } from './lib/loading';
import { t } from './lib/i18n';
import 'ranui/button';
import './styles/base.css';

interface RenderOfficeData {
  chunkIndex: number;
  data: string;
  lastModified: number;
  name: string;
  size: number;
  totalChunks: number;
  type: string;
}

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

let fileChunks: RenderOfficeData[] = [];

const events: Record<string, MessageHandler<any, unknown>> = {
  RENDER_OFFICE: async (data: RenderOfficeData) => {
    // Hide the control panel when rendering office
    hideControlPanel();
    fileChunks.push(data);
    if (fileChunks.length >= data.totalChunks) {
      const { removeLoading } = showLoading();
      const file = await MessageCodec.decodeFileChunked(fileChunks);
      setDocmentObj({
        fileName: file.name,
        file: file,
        url: window.URL.createObjectURL(file),
      });
      await initX2T();
      const { fileName, file: fileBlob } = getDocmentObj();
      await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
      fileChunks = [];
      removeLoading();
      // Show menu guide after document is loaded
      setTimeout(() => {
        showMenuGuide();
      }, 1000);
    }
  },
  CLOSE_EDITOR: () => {
    fileChunks = [];
    if (window.editor && typeof window.editor.destroyEditor === 'function') {
      window.editor.destroyEditor();
    }
  },
};

Platform.init(events);

const { file } = getAllQueryString();

const onCreateNew = async (ext: string) => {
  const { removeLoading } = showLoading();
  hideControlPanel();
  setDocmentObj({
    fileName: 'New_Document' + ext,
    file: undefined,
  });
  await loadScript();
  await loadEditorApi();
  await initX2T();
  const { fileName, file: fileBlob } = getDocmentObj();
  await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
  removeLoading();
  // Show menu guide after document is loaded
  setTimeout(() => {
    showMenuGuide();
  }, 1000);
};
// example: window.onCreateNew('.docx')
// example: window.onCreateNew('.xlsx')
// example: window.onCreateNew('.pptx')
window.onCreateNew = onCreateNew;

// Create a single file input element
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.docx,.xlsx,.pptx,.doc,.xls,.ppt,.csv';
fileInput.style.setProperty('visibility', 'hidden');
document.body.appendChild(fileInput);

const onOpenDocument = async () => {
  return new Promise((resolve) => {
    // Trigger file picker click event
    fileInput.click();
    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      const { removeLoading } = showLoading();
      if (file) {
        hideControlPanel();
        setDocmentObj({
          fileName: file.name,
          file: file,
          url: window.URL.createObjectURL(file),
        });
        await initX2T();
        const { fileName, file: fileBlob } = getDocmentObj();
        await handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
        resolve(true);
        removeLoading();
        // Clear file selection so the same file can be selected again
        fileInput.value = '';
        // Show menu guide after document is loaded
        setTimeout(() => {
          showMenuGuide();
        }, 1000);
      }
    };
  });
};

// Hide control panel and show top floating bar
const hideControlPanel = () => {
  const container = document.querySelector('#control-panel-container') as HTMLElement;
  if (container) {
    container.style.opacity = '0';
    setTimeout(() => {
      container.style.display = 'none';
      showTopFloatingBar();
    }, 300);
  }
};

// Show control panel and hide FAB
const showControlPanel = () => {
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

// Create fixed action button in bottom right corner
const createFixedActionButton = () => {
  const fabContainer = document.createElement('div');
  fabContainer.id = 'fab-container';
  fabContainer.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 1000;
    display: none;
  `;

  // Main FAB button - simple style
  const fabButton = document.createElement('button');
  fabButton.id = 'fab-button';
  fabButton.textContent = t('menu');
  fabButton.style.cssText = `
    min-width: 52px;
    height: 40px;
    padding: 0 16px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
    color: #333;
    font-size: 14px;
    font-weight: 500;
    user-select: none;
    white-space: nowrap;
  `;

  fabButton.addEventListener('mouseenter', () => {
    fabButton.style.background = 'rgba(0, 0, 0, 0.08)';
  });
  fabButton.addEventListener('mouseleave', () => {
    fabButton.style.background = 'rgba(0, 0, 0, 0.05)';
  });

  // Menu panel - compact style
  const menuPanel = document.createElement('div');
  menuPanel.id = 'fab-menu';
  menuPanel.style.cssText = `
    position: absolute;
    bottom: 50px;
    right: 0;
    background: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    padding: 4px;
    display: none;
    flex-direction: column;
    gap: 1px;
    min-width: 130px;
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
    z-index: 1001;
    border: 1px solid rgba(0, 0, 0, 0.08);
  `;

  const createMenuButton = (text: string, onClick: () => void) => {
    // Create wrapper for the entire menu item
    const menuItem = document.createElement('div');
    menuItem.className = 'fab-menu-item';
    menuItem.style.cssText = `
      width: 100%;
      border-radius: 4px;
      transition: background 0.2s ease;
    `;

    const button = document.createElement('r-button');
    button.textContent = text;
    button.setAttribute('variant', 'text');
    button.setAttribute('type', 'text');
    button.className = 'fab-menu-button';
    button.style.cssText = `
      cursor: pointer;
      white-space: nowrap;
      width: 100%;
      text-align: left;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
    `;

    // Handle hover on the wrapper
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.background = '#f5f5f5';
    });
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.background = 'transparent';
    });

    button.addEventListener('click', () => {
      onClick();
      hideMenu();
    });

    menuItem.appendChild(button);
    return menuItem;
  };

  menuPanel.appendChild(
    createMenuButton(t('uploadDocument'), () => {
      onOpenDocument();
    }),
  );
  menuPanel.appendChild(
    createMenuButton(t('newWord'), () => {
      onCreateNew('.docx');
    }),
  );
  menuPanel.appendChild(
    createMenuButton(t('newExcel'), () => {
      onCreateNew('.xlsx');
    }),
  );
  menuPanel.appendChild(
    createMenuButton(t('newPowerPoint'), () => {
      onCreateNew('.pptx');
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

const showMenuGuide = () => {
  // Check if guide was dismissed in localStorage
  // eslint-disable-next-line
  if (localStorage.getItem(MENU_GUIDE_DISMISSED_KEY) === 'true') {
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
  guide.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2);
    padding: 20px 40px 20px 24px;
    z-index: 1002;
    max-width: 300px;
    animation: guideFadeIn 0.3s ease;
    pointer-events: auto;
    border: 1px solid rgba(0, 0, 0, 0.08);
  `;

  // Create arrow pointing down
  const arrow = document.createElement('div');
  arrow.style.cssText = `
    position: absolute;
    bottom: -10px;
    right: 40px;
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid white;
  `;

  // Create text content
  const text = document.createElement('div');
  text.textContent = t('menuGuide');
  text.style.cssText = `
    font-size: 16px;
    color: #333;
    line-height: 1.6;
    margin: 0;
    font-weight: 500;
    padding-right: 0;
  `;

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 12px;
    background: none;
    border: none;
    font-size: 24px;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.color = '#333';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.color = '#999';
  });

  const hideGuide = (saveToStorage = false) => {
    if (saveToStorage) {
      // eslint-disable-next-line
      localStorage.setItem(MENU_GUIDE_DISMISSED_KEY, 'true');
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

// Show fixed action button
const showTopFloatingBar = () => {
  const fabContainer = document.querySelector('#fab-container') as HTMLElement;
  if (fabContainer) {
    fabContainer.style.display = 'block';
  }
};

// Initialize fixed action button
createFixedActionButton();

// Create and append the control panel
const createControlPanel = () => {
  // Create control panel container - centered in viewport
  const container = document.createElement('div');
  container.id = 'control-panel-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    transition: opacity 0.3s ease;
    pointer-events: none;
    padding: 20px;
    box-sizing: border-box;
  `;

  // Create button group - centered horizontally with wrap support
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    max-width: 100%;
    width: 100%;
  `;

  // Helper function to create text button
  const createTextButton = (id: string, text: string, onClick: () => void) => {
    const button = document.createElement('r-button');
    button.id = id;
    button.textContent = text;
    button.setAttribute('variant', 'text');
    button.setAttribute('type', 'text');
    // WebComponent styles are handled via CSS in base.css
    button.style.cssText = `
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transform: scale(1);
    `;

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
  const uploadButton = createTextButton('upload-button', t('uploadDocument'), () => {
    onOpenDocument();
    hideControlPanel();
  });
  buttonGroup.appendChild(uploadButton);

  const newWordButton = createTextButton('new-word-button', t('newWord'), () => {
    onCreateNew('.docx');
    hideControlPanel();
  });
  buttonGroup.appendChild(newWordButton);

  const newExcelButton = createTextButton('new-excel-button', t('newExcel'), () => {
    onCreateNew('.xlsx');
    hideControlPanel();
  });
  buttonGroup.appendChild(newExcelButton);

  const newPptxButton = createTextButton('new-pptx-button', t('newPowerPoint'), () => {
    onCreateNew('.pptx');
    hideControlPanel();
  });
  buttonGroup.appendChild(newPptxButton);

  container.appendChild(buttonGroup);
  document.body.appendChild(container);
};

// Initialize the containers
createControlPanel();

// Export functions for use in other modules if needed
window.hideControlPanel = hideControlPanel;
window.showControlPanel = showControlPanel;

if (!file) {
  // Don't automatically open document dialog, let user choose
  // onOpenDocument();
} else {
  setDocmentObj({
    fileName: Math.random().toString(36).substring(2, 15),
    url: file,
  });
}
