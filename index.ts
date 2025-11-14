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
  if (langButton) langButton.textContent = getLanguage() === 'zh' ? 'English' : '中文';
};

// Create and append the control panel
const createControlPanel = () => {
  // Create control panel container
  const container = document.createElement('div');
  container.style.cssText = `
    width: 100%;
    background: linear-gradient(to right, #ffffff, #f8f9fa);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    border-bottom: 1px solid #eaeaea;
  `;

  const controlPanel = document.createElement('div');
  controlPanel.id = 'control-panel';
  controlPanel.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px;
    z-index: 1000;
    max-width: 1200px;
    margin: 0 auto;
    align-items: center;
  `;

  // Create title section
  const titleSection = document.createElement('div');
  titleSection.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    margin-right: auto;
  `;

  const logo = document.createElement('div');
  logo.style.cssText = `
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #1890ff, #096dd9);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 16px;
  `;
  logo.textContent = 'W';
  titleSection.appendChild(logo);

  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: #1f1f1f;
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
    gap: 12px;
    align-items: center;
  `;

  // Create upload button
  const uploadButton = document.createElement('r-button');
  uploadButton.textContent = t('uploadDocument');
  uploadButton.id = 'upload-button';
  uploadButton.addEventListener('click', onOpenDocument);
  buttonGroup.appendChild(uploadButton);

  // Create new document buttons
  const createDocxButton = document.createElement('r-button');
  createDocxButton.textContent = t('newWord');
  createDocxButton.id = 'new-word-button';
  createDocxButton.addEventListener('click', () => onCreateNew('.docx'));
  buttonGroup.appendChild(createDocxButton);

  const createXlsxButton = document.createElement('r-button');
  createXlsxButton.textContent = t('newExcel');
  createXlsxButton.id = 'new-excel-button';
  createXlsxButton.addEventListener('click', () => onCreateNew('.xlsx'));
  buttonGroup.appendChild(createXlsxButton);

  const createPptxButton = document.createElement('r-button');
  createPptxButton.textContent = t('newPowerPoint');
  createPptxButton.id = 'new-pptx-button';
  createPptxButton.addEventListener('click', () => onCreateNew('.pptx'));
  buttonGroup.appendChild(createPptxButton);

  // Create language switch button
  const langButton = document.createElement('r-button');
  langButton.textContent = getLanguage() === 'zh' ? 'English' : '中文';
  langButton.id = 'lang-button';
  langButton.style.cssText = `
    min-width: 80px;
  `;
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
  buttonGroup.appendChild(langButton);

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
