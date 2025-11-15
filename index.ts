import { MessageCodec, Platform, getAllQueryString } from 'ranuts/utils';
import type { MessageHandler } from 'ranuts/utils';
import { handleDocumentOperation, initX2T, loadEditorApi, loadScript } from './lib/x2t';
import { getDocmentObj, setDocmentObj } from './store';
import { showLoading } from './lib/loading';
import { type Language, LanguageCode, getLanguage, setLanguage, t } from './lib/i18n';
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
      }
    };
  });
};

// Update UI text
const updateUIText = () => {
  const uploadButton = document.getElementById('upload-button');
  if (uploadButton) uploadButton.textContent = t('uploadDocument');

  const newWordButton = document.getElementById('new-word-button');
  if (newWordButton) newWordButton.textContent = t('newWord');

  const newExcelButton = document.getElementById('new-excel-button');
  if (newExcelButton) newExcelButton.textContent = t('newExcel');

  const newPptxButton = document.getElementById('new-pptx-button');
  if (newPptxButton) newPptxButton.textContent = t('newPowerPoint');
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

  menuPanel.appendChild(createMenuButton(t('uploadDocument'), () => {
    onOpenDocument();
  }));
  menuPanel.appendChild(createMenuButton(t('newWord'), () => {
    onCreateNew('.docx');
  }));
  menuPanel.appendChild(createMenuButton(t('newExcel'), () => {
    onCreateNew('.xlsx');
  }));
  menuPanel.appendChild(createMenuButton(t('newPowerPoint'), () => {
    onCreateNew('.pptx');
  }));

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

// Show fixed action button
const showTopFloatingBar = () => {
  const fabContainer = document.querySelector('#fab-container') as HTMLElement;
  if (fabContainer) {
    fabContainer.style.display = 'block';
  }
};

// Create floating bubble with drag functionality (deprecated, keeping for reference)
const createFloatingBubble = () => {
  const bubble = document.createElement('div');
  bubble.id = 'floating-bubble';
  bubble.style.cssText = `
    position: fixed;
    bottom: 40px;
    right: 40px;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1);
    cursor: move;
    z-index: 1000;
    display: none;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
    user-select: none;
    overflow: hidden;
  `;

  // Add subtle animation background
  const bubbleBg = document.createElement('div');
  bubbleBg.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
    pointer-events: none;
  `;
  bubble.appendChild(bubbleBg);

  // Bubble icon - using SVG for better quality
  const bubbleIcon = document.createElement('div');
  bubbleIcon.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5V19M5 12H19" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  bubbleIcon.style.cssText = `
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
  bubble.appendChild(bubbleIcon);

  // Menu panel (shown on hover)
  const menuPanel = document.createElement('div');
  menuPanel.id = 'bubble-menu';
  menuPanel.style.cssText = `
    position: absolute;
    bottom: 80px;
    right: 0;
    background: white;
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15), 0 4px 8px rgba(0, 0, 0, 0.1);
    padding: 8px;
    display: none;
    flex-direction: column;
    gap: 2px;
    min-width: 180px;
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    z-index: 1001;
  `;

  // Helper to hide bubble
  const hideBubble = () => {
    bubble.style.display = 'none';
  };

  // Create menu buttons
  const createMenuButton = (text: string, onClick: () => void) => {
    const button = document.createElement('r-button');
    button.textContent = text;
    button.style.cssText = `
      background: transparent;
    border: none;
      color: #333;
      font-size: 14px;
    font-weight: 500;
      padding: 12px 16px;
      text-align: left;
      cursor: pointer;
      border-radius: 10px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      width: 100%;
      transform: scale(1);
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)';
      button.style.color = '#667eea';
      button.style.transform = 'scale(1.02) translateX(4px)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
      button.style.color = '#333';
      button.style.transform = 'scale(1) translateX(0)';
    });
    button.addEventListener('click', () => {
      onClick();
      hideBubble();
      menuPanel.style.display = 'none';
      menuPanel.style.opacity = '0';
    });
    return button;
  };

  menuPanel.appendChild(createMenuButton(t('uploadDocument'), () => {
    onOpenDocument();
  }));
  menuPanel.appendChild(createMenuButton(t('newWord'), () => {
    onCreateNew('.docx');
  }));
  menuPanel.appendChild(createMenuButton(t('newExcel'), () => {
    onCreateNew('.xlsx');
  }));
  menuPanel.appendChild(createMenuButton(t('newPowerPoint'), () => {
    onCreateNew('.pptx');
  }));

  bubble.appendChild(menuPanel);

  // Menu state management
  let isMenuOpen = false;
  let hoverTimeout: NodeJS.Timeout;

  const showMenu = () => {
    clearTimeout(hoverTimeout);
    isMenuOpen = true;
    menuPanel.style.display = 'flex';
    menuPanel.style.pointerEvents = 'auto';
    setTimeout(() => {
      menuPanel.style.opacity = '1';
      menuPanel.style.transform = 'translateY(0) scale(1)';
    }, 10);
    bubble.style.transform = 'scale(1.1)';
    bubble.style.boxShadow = '0 12px 32px rgba(102, 126, 234, 0.5), 0 4px 12px rgba(0, 0, 0, 0.15)';
    bubbleIcon.style.transform = 'rotate(90deg)';
  };

  const hideMenu = () => {
    isMenuOpen = false;
    menuPanel.style.opacity = '0';
    menuPanel.style.transform = 'translateY(10px) scale(0.95)';
    bubble.style.transform = 'scale(1)';
    bubble.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1)';
    bubbleIcon.style.transform = 'rotate(0deg)';
    hoverTimeout = setTimeout(() => {
      menuPanel.style.display = 'none';
      menuPanel.style.pointerEvents = 'none';
    }, 250);
  };

  const toggleMenu = () => {
    if (isMenuOpen) {
      hideMenu();
    } else {
      showMenu();
    }
  };

  // Hover to show menu
  bubble.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimeout);
    if (!isMenuOpen) {
      showMenu();
    }
  });

  // Hide menu when mouse leaves bubble and menu
  const handleMouseLeave = () => {
    hoverTimeout = setTimeout(() => {
      hideMenu();
    }, 200);
  };

  bubble.addEventListener('mouseleave', (e) => {
    // Check if mouse is moving to menu panel
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && (relatedTarget === menuPanel || menuPanel.contains(relatedTarget))) {
      return; // Don't hide if moving to menu
    }
    handleMouseLeave();
  });

  menuPanel.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimeout);
  });

  menuPanel.addEventListener('mouseleave', handleMouseLeave);

  // Drag functionality
  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX = 0;
  let initialY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDistance = 0;

  bubble.addEventListener('mousedown', (e) => {
    // Don't start drag if clicking on menu panel
    if ((e.target as HTMLElement).closest('#bubble-menu')) return;
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    isDragging = false;
    dragDistance = 0;
    initialX = e.clientX - (bubble.offsetLeft || 0);
    initialY = e.clientY - (bubble.offsetTop || 0);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - dragStartX);
      const deltaY = Math.abs(moveEvent.clientY - dragStartY);
      dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Only start dragging if moved more than 8px
      if (dragDistance > 8 && !isDragging) {
        isDragging = true;
        bubble.style.cursor = 'grabbing';
        // Hide menu when dragging starts
        if (isMenuOpen) {
          hideMenu();
        }
      }
      
      // Handle actual dragging
      if (isDragging) {
        moveEvent.preventDefault();
        currentX = moveEvent.clientX - initialX;
        currentY = moveEvent.clientY - initialY;

        // Keep bubble within viewport
        const maxX = window.innerWidth - bubble.offsetWidth;
        const maxY = window.innerHeight - bubble.offsetHeight;
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        bubble.style.left = `${currentX}px`;
        bubble.style.top = `${currentY}px`;
        bubble.style.right = 'auto';
        bubble.style.bottom = 'auto';
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (isDragging) {
        isDragging = false;
        bubble.style.cursor = 'move';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  // Click to toggle menu (only if not dragging)
  bubble.addEventListener('click', (e) => {
    // Don't toggle if clicking on menu panel
    if ((e.target as HTMLElement).closest('#bubble-menu')) return;
    // Don't toggle if was dragging
    if (isDragging) {
      return;
    }
    e.stopPropagation();
    toggleMenu();
  });

  document.body.appendChild(bubble);
  return bubble;
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
