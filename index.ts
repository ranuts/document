import { MessageCodec, Platform, getAllQueryString } from 'ranuts/utils';
import type { MessageHandler } from 'ranuts/utils';
import { handleDocumentOperation, initX2T, loadEditorApi, loadScript } from './lib/x2t';
import { getDocmentObj, setDocmentObj } from './store';
import { showLoading } from './lib/loading';
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

// 最近文档接口
interface RecentDocument {
  id: string;
  fileName: string;
  fileType: string;
  lastModified: number;
  url?: string;
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

// 存储最近文档的键名
const RECENT_DOCS_KEY = 'recent_documents';

// 获取最近文档列表
const getRecentDocuments = (): RecentDocument[] => {
  try {
    const recentDocsStr = localStorage.getItem(RECENT_DOCS_KEY);
    return recentDocsStr ? JSON.parse(recentDocsStr) : [];
  } catch (error) {
    console.error('Failed to get recent documents:', error);
    return [];
  }
};

// 保存最近文档列表
const saveRecentDocuments = (docs: RecentDocument[]): void => {
  try {
    localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(docs));
  } catch (error) {
    console.error('Failed to save recent documents:', error);
  }
};

// 添加或更新最近文档
const updateRecentDocument = (doc: Omit<RecentDocument, 'id'>): void => {
  const recentDocs = getRecentDocuments();
  const docId = `${doc.fileName}-${doc.lastModified}`;
  const existingIndex = recentDocs.findIndex(d => d.id === docId);
  
  if (existingIndex !== -1) {
    // 如果文档已存在，更新并移到最前面
    recentDocs.splice(existingIndex, 1);
  }
  
  // 添加新文档到最前面
  recentDocs.unshift({
    ...doc,
    id: docId
  });
  
  // 只保留最近10个文档
  const limitedDocs = recentDocs.slice(0, 10);
  
  saveRecentDocuments(limitedDocs);
  
  // 更新下拉菜单中的最近文档列表
  renderRecentDocuments();
};

// 将updateRecentDocument函数添加到window对象上
window.updateRecentDocument = updateRecentDocument;

// 渲染最近文档列表
const renderRecentDocuments = () => {
  const dropdownPanel = document.querySelector('.recent-docs-dropdown');
  if (!dropdownPanel) return;
  
  const recentDocs = getRecentDocuments();
  
  // 清空现有内容
  dropdownPanel.innerHTML = '';
  
  if (recentDocs.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.style.cssText = `
      padding: 16px;
      text-align: center;
      color: #999999;
      font-size: 14px;
    `;
    emptyMessage.textContent = '暂无最近打开的文档';
    dropdownPanel.appendChild(emptyMessage);
    return;
  }
  
  // 创建文档列表
  const docList = document.createElement('div');
  docList.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 4px;
  `;
  
  recentDocs.forEach(doc => {
    // 创建文档项
    const docItem = document.createElement('div');
    docItem.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    docItem.className = 'recent-doc-item';
    
    // 添加悬停效果
    docItem.addEventListener('mouseenter', () => {
      docItem.style.backgroundColor = '#f5f5f5';
    });
    docItem.addEventListener('mouseleave', () => {
      docItem.style.backgroundColor = 'transparent';
    });
    
    // 创建文档类型图标
    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: white;
      font-size: 14px;
    `;
    
    // 根据文档类型设置不同的图标
    switch (doc.fileType.toLowerCase()) {
      case 'docx':
      case 'doc':
        icon.style.backgroundColor = '#2A579A';
        icon.textContent = 'W';
        break;
      case 'xlsx':
      case 'xls':
        icon.style.backgroundColor = '#40865c';
        icon.textContent = 'X';
        break;
      case 'pptx':
      case 'ppt':
        icon.style.backgroundColor = '#B7472A';
        icon.textContent = 'P';
        break;
      default:
        icon.style.backgroundColor = '#666666';
        icon.textContent = doc.fileType.toUpperCase().charAt(0);
    }
    
    // 创建文档信息容器
    const infoContainer = document.createElement('div');
    infoContainer.style.cssText = `
      flex: 1;
      min-width: 0;
    `;
    
    // 创建文件名
    const fileName = document.createElement('div');
    fileName.style.cssText = `
      font-size: 14px;
      font-weight: 500;
      color: #1f1f1f;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    `;
    fileName.textContent = doc.fileName;
    fileName.title = doc.fileName;
    
    // 创建最后编辑时间
    const lastModified = document.createElement('div');
    lastModified.style.cssText = `
      font-size: 12px;
      color: #999999;
    `;
    
    // 计算相对时间
    const now = Date.now();
    const diff = now - doc.lastModified;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
      lastModified.textContent = `${minutes}分钟前`;
    } else if (hours < 24) {
      lastModified.textContent = `${hours}小时前`;
    } else if (days < 30) {
      lastModified.textContent = `${days}天前`;
    } else {
      // 超过30天显示具体日期
      const date = new Date(doc.lastModified);
      lastModified.textContent = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    }
    
    // 组装文档信息
    infoContainer.appendChild(fileName);
    infoContainer.appendChild(lastModified);
    
    // 组装文档项
    docItem.appendChild(icon);
    docItem.appendChild(infoContainer);
    
    // 添加点击事件，重新打开文档
    docItem.addEventListener('click', () => {
      // 这里需要实现重新打开文档的功能
      // 由于我们没有存储文档内容，只能提示用户重新上传
      alert('由于隐私考虑，文档内容未保存，请重新上传文档。');
    });
    
    // 添加到文档列表
    docList.appendChild(docItem);
  });
  
  // 添加到下拉面板
  dropdownPanel.appendChild(docList);
};

// Create a single file input element
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.docx,.xlsx,.pptx,.doc,.xls,.ppt';
fileInput.style.setProperty('visibility', 'hidden');
document.body.appendChild(fileInput);

const onOpenDocument = async () => {
  return new Promise((resolve) => {
    // 触发文件选择器的点击事件
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
        // 清空文件选择，这样同一个文件可以重复选择
        fileInput.value = '';
      }
    };
  });
};

// Create and append the control panel
const createControlPanel = () => {
  // 创建控制面板容器
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

  // 创建标题区域
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
  title.textContent = 'Web Office';
  titleSection.appendChild(title);

  controlPanel.appendChild(titleSection);

  // 创建最近文档下拉菜单
  const recentDocsButton = document.createElement('r-button');
  recentDocsButton.textContent = '最近文档';
  recentDocsButton.style.position = 'relative';
  
  // 创建下拉菜单面板
  const dropdownPanel = document.createElement('div');
  dropdownPanel.className = 'recent-docs-dropdown';
  dropdownPanel.style.cssText = `
    position: absolute;
    top: 100%;
    right: 0;
    background: white;
    border: 1px solid #eaeaea;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    padding: 8px;
    z-index: 1001;
    width: 350px;
    max-height: 400px;
    overflow-y: auto;
    display: none;
  `;
  recentDocsButton.appendChild(dropdownPanel);
  
  // 添加点击事件，显示/隐藏下拉菜单
  recentDocsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownPanel.style.display = dropdownPanel.style.display === 'none' ? 'block' : 'none';
  });
  
  // 点击页面其他地方隐藏下拉菜单
  document.addEventListener('click', (e) => {
    if (!recentDocsButton.contains(e.target as Node)) {
      dropdownPanel.style.display = 'none';
    }
  });
  
  controlPanel.appendChild(recentDocsButton);

  // 创建按钮组
  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  `;

  // Create upload button
  const uploadButton = document.createElement('r-button');
  uploadButton.textContent = 'Upload Document to view';
  uploadButton.addEventListener('click', onOpenDocument);
  buttonGroup.appendChild(uploadButton);

  // Create new document buttons
  const createDocxButton = document.createElement('r-button');
  createDocxButton.textContent = 'New Word';
  createDocxButton.addEventListener('click', () => onCreateNew('.docx'));
  buttonGroup.appendChild(createDocxButton);

  const createXlsxButton = document.createElement('r-button');
  createXlsxButton.textContent = 'New Excel';
  createXlsxButton.addEventListener('click', () => onCreateNew('.xlsx'));
  buttonGroup.appendChild(createXlsxButton);

  const createPptxButton = document.createElement('r-button');
  createPptxButton.textContent = 'New PowerPoint';
  createPptxButton.addEventListener('click', () => onCreateNew('.pptx'));
  buttonGroup.appendChild(createPptxButton);

  controlPanel.appendChild(buttonGroup);

  // 将控制面板添加到容器中
  container.appendChild(controlPanel);

  // 在 body 的最前面插入容器
  document.body.insertBefore(container, document.body.firstChild);
};

// Initialize the containers
createControlPanel();

// 初始化最近文档列表
renderRecentDocuments();

if (!file) {
  // Don't automatically open document dialog, let user choose
  // onOpenDocument();
} else {
  setDocmentObj({
    fileName: Math.random().toString(36).substring(2, 15),
    url: file,
  });
}
