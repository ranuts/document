import { MessageCodec, Platform, getAllQueryString } from 'ranuts/utils';
import type { MessageHandler } from 'ranuts/utils';
import { handleDocumentOperation, initX2T, loadEditorApi, loadScript } from './lib/x2t';
import { getDocmentObj, setDocmentObj } from './store';
import { showLoading } from './lib/loading';
import { type Language, getLanguage, setLanguage, t } from './lib/i18n';
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
    DocsAPI: {
      DocEditor: new (elementId: string, config: any) => any;
    };
  }
}

let fileChunks: RenderOfficeData[] = [];

const events: Record<string, MessageHandler<any, unknown>> = {
  RENDER_OFFICE: async (data: RenderOfficeData) => {
    // Hide the control panel when rendering office
    const controlPanel = document.getElementById('control-panel');
    if (controlPanel) {
      controlPanel.style.display = 'none';
    }
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
fileInput.accept = '.docx,.xlsx,.pptx,.doc,.xls,.ppt';
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
  const title = document.getElementById('title-text');
  if (title) title.textContent = t('webOffice');

  const uploadButton = document.getElementById('upload-button');
  if (uploadButton) uploadButton.textContent = t('uploadDocument');

  const newWordButton = document.getElementById('new-word-button');
  if (newWordButton) newWordButton.textContent = t('newWord');

  const newExcelButton = document.getElementById('new-excel-button');
  if (newExcelButton) newExcelButton.textContent = t('newExcel');

  const newPptxButton = document.getElementById('new-pptx-button');
  if (newPptxButton) newPptxButton.textContent = t('newPowerPoint');

  const langButton = document.getElementById('lang-button');
  if (langButton) {
    const langText = langButton.querySelector('span:last-child');
    if (langText) {
      langText.textContent = getLanguage() === 'zh' ? 'English' : '中文';
    }
  }
};

// Create and append the control panel
const createControlPanel = () => {
  // Create control panel container
  const container = document.createElement('div');
  container.style.cssText = `
    width: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    border-bottom: none;
    position: relative;
    overflow: hidden;
  `;

  // Add subtle pattern overlay
  const patternOverlay = document.createElement('div');
  patternOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
    pointer-events: none;
  `;
  container.appendChild(patternOverlay);

  const controlPanel = document.createElement('div');
  controlPanel.id = 'control-panel';
  controlPanel.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px 24px;
    z-index: 1000;
    max-width: 1400px;
    margin: 0 auto;
    align-items: center;
    position: relative;
  `;

  // Create title section
  const titleSection = document.createElement('div');
  titleSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 14px;
    margin-right: auto;
  `;

  const logo = document.createElement('div');
  logo.style.cssText = `
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #667eea;
    font-weight: 700;
    font-size: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;
  logo.textContent = 'W';
  logo.addEventListener('mouseenter', () => {
    logo.style.transform = 'scale(1.05)';
    logo.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
  });
  logo.addEventListener('mouseleave', () => {
    logo.style.transform = 'scale(1)';
    logo.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
  });
  titleSection.appendChild(logo);

  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 20px;
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    letter-spacing: 0.3px;
  `;
  title.textContent = t('webOffice');
  title.id = 'title-text';
  titleSection.appendChild(title);

  controlPanel.appendChild(titleSection);

  // Create button group
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
  `;

  // Create upload button
  const uploadButton = document.createElement('r-button');
  uploadButton.textContent = t('uploadDocument');
  uploadButton.id = 'upload-button';
  uploadButton.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    color: #667eea;
    border: none;
    font-weight: 500;
    transition: all 0.2s ease;
  `;
  uploadButton.addEventListener('mouseenter', () => {
    uploadButton.style.background = '#ffffff';
    uploadButton.style.transform = 'translateY(-1px)';
    uploadButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });
  uploadButton.addEventListener('mouseleave', () => {
    uploadButton.style.background = 'rgba(255, 255, 255, 0.95)';
    uploadButton.style.transform = 'translateY(0)';
    uploadButton.style.boxShadow = 'none';
  });
  uploadButton.addEventListener('click', onOpenDocument);
  buttonGroup.appendChild(uploadButton);

  // Create new document buttons
  const createDocxButton = document.createElement('r-button');
  createDocxButton.textContent = t('newWord');
  createDocxButton.id = 'new-word-button';
  createDocxButton.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    color: #667eea;
    border: none;
    font-weight: 500;
    transition: all 0.2s ease;
  `;
  createDocxButton.addEventListener('mouseenter', () => {
    createDocxButton.style.background = '#ffffff';
    createDocxButton.style.transform = 'translateY(-1px)';
    createDocxButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });
  createDocxButton.addEventListener('mouseleave', () => {
    createDocxButton.style.background = 'rgba(255, 255, 255, 0.95)';
    createDocxButton.style.transform = 'translateY(0)';
    createDocxButton.style.boxShadow = 'none';
  });
  createDocxButton.addEventListener('click', () => onCreateNew('.docx'));
  buttonGroup.appendChild(createDocxButton);

  const createXlsxButton = document.createElement('r-button');
  createXlsxButton.textContent = t('newExcel');
  createXlsxButton.id = 'new-excel-button';
  createXlsxButton.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    color: #667eea;
    border: none;
    font-weight: 500;
    transition: all 0.2s ease;
  `;
  createXlsxButton.addEventListener('mouseenter', () => {
    createXlsxButton.style.background = '#ffffff';
    createXlsxButton.style.transform = 'translateY(-1px)';
    createXlsxButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });
  createXlsxButton.addEventListener('mouseleave', () => {
    createXlsxButton.style.background = 'rgba(255, 255, 255, 0.95)';
    createXlsxButton.style.transform = 'translateY(0)';
    createXlsxButton.style.boxShadow = 'none';
  });
  createXlsxButton.addEventListener('click', () => onCreateNew('.xlsx'));
  buttonGroup.appendChild(createXlsxButton);

  const createPptxButton = document.createElement('r-button');
  createPptxButton.textContent = t('newPowerPoint');
  createPptxButton.id = 'new-pptx-button';
  createPptxButton.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    color: #667eea;
    border: none;
    font-weight: 500;
    transition: all 0.2s ease;
  `;
  createPptxButton.addEventListener('mouseenter', () => {
    createPptxButton.style.background = '#ffffff';
    createPptxButton.style.transform = 'translateY(-1px)';
    createPptxButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });
  createPptxButton.addEventListener('mouseleave', () => {
    createPptxButton.style.background = 'rgba(255, 255, 255, 0.95)';
    createPptxButton.style.transform = 'translateY(0)';
    createPptxButton.style.boxShadow = 'none';
  });
  createPptxButton.addEventListener('click', () => onCreateNew('.pptx'));
  buttonGroup.appendChild(createPptxButton);

  // Create language switch button with icon
  const langButtonContainer = document.createElement('div');
  langButtonContainer.style.cssText = `
    position: relative;
    display: flex;
    align-items: center;
  `;

  const langButton = document.createElement('button');
  langButton.id = 'lang-button';
  langButton.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    color: #ffffff;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 90px;
    justify-content: center;
  `;
  
  // Create language icon
  const langIcon = document.createElement('span');
  langIcon.style.cssText = `
    display: inline-block;
    width: 18px;
    height: 18px;
    font-size: 16px;
    line-height: 18px;
    text-align: center;
  `;
  langIcon.textContent = getLanguage() === 'zh' ? '🌐' : '🌐';
  
  const langText = document.createElement('span');
  langText.textContent = getLanguage() === 'zh' ? 'English' : '中文';
  
  langButton.appendChild(langIcon);
  langButton.appendChild(langText);
  
  langButton.addEventListener('mouseenter', () => {
    langButton.style.background = 'rgba(255, 255, 255, 0.3)';
    langButton.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    langButton.style.transform = 'translateY(-1px)';
    langButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });
  langButton.addEventListener('mouseleave', () => {
    langButton.style.background = 'rgba(255, 255, 255, 0.2)';
    langButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    langButton.style.transform = 'translateY(0)';
    langButton.style.boxShadow = 'none';
  });
  langButton.addEventListener('click', () => {
    const currentLang = getLanguage();
    const newLang: Language = currentLang === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
    updateUIText();
    // If editor is loaded, recreate it to apply new language
    if (window.editor) {
      const { fileName, file: fileBlob } = getDocmentObj();
      if (fileName) {
        handleDocumentOperation({ file: fileBlob, fileName, isNew: !fileBlob });
      }
    }
  });
  
  langButtonContainer.appendChild(langButton);
  buttonGroup.appendChild(langButtonContainer);

  controlPanel.appendChild(buttonGroup);

  // Append control panel to container
  container.appendChild(controlPanel);

  // Insert container at the beginning of body
  document.body.insertBefore(container, document.body.firstChild);
};

// Initialize the containers
createControlPanel();

// Listen for language change events
window.addEventListener('languagechange', () => {
  updateUIText();
});

if (!file) {
  // Don't automatically open document dialog, let user choose
  // onOpenDocument();
} else {
  setDocmentObj({
    fileName: Math.random().toString(36).substring(2, 15),
    url: file,
  });
}
