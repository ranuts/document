/**
 * app-router.ts — 应用路由模块
 *
 * 负责：
 *   1. 路由常量与路径检测（当前是哪种编辑器路由）
 *   2. 启动意图推断（页面加载时应做什么）
 *   3. 导航函数（新建 / 远程 URL / 本地文件三种策略）
 *   4. 本地文件场景的 popstate 管理（SPA 伪导航的后退处理）
 *
 * 不负责：文档内容操作、编辑器初始化、UI 渲染。
 * 这些由调用方通过回调或直接调用各自模块完成。
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorExt = '.docx' | '.xlsx' | '.pptx' | '.csv';

/**
 * 页面加载时的启动动作，由 getStartupAction() 推断：
 *
 * - home            : 当前是首页，显示控制面板
 * - editor-new      : 编辑器路由，无参数 → 新建空文档
 * - editor-url      : 编辑器路由，有 ?src= → 从远程 URL 打开
 * - editor-file-lost: 编辑器路由，有 ?file= 但无文件数据（本地文件刷新后数据丢失）
 */
export type StartupAction =
  | { type: 'home' }
  | { type: 'editor-new'; ext: EditorExt }
  | { type: 'editor-url'; ext: EditorExt; url: string }
  | { type: 'editor-file-lost'; ext: EditorExt; filename: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_EXTS: EditorExt[] = ['.docx', '.xlsx', '.pptx', '.csv'];

/** URL 路径后缀 → 文档扩展名 */
const ROUTE_TO_EXT: Record<string, EditorExt> = {
  '/docx/': '.docx',
  '/xlsx/': '.xlsx',
  '/pptx/': '.pptx',
  '/csv/': '.csv',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getVersionPrefix(): string {
  // Detect any semver-style version prefix (/1.2.3/) so this survives
  // OnlyOffice upgrades (e.g. 9.3.0 → 9.4.0) without code changes.
  const m = /^(\/\d+\.\d+\.\d+\/)/.exec(location.pathname);
  return m ? m[1] : '/';
}

/** 构建编辑器路由的绝对路径 */
function editorPath(ext: EditorExt, params?: Record<string, string>): string {
  const slug = ext.slice(1); // '.docx' → 'docx'
  const prefix = getVersionPrefix();
  const query = params && Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : '';
  return `${prefix}${slug}/${query}`;
}

/** 从文件名提取文档扩展名，不在 VALID_EXTS 内则返回 null */
export function extFromFilename(filename: string): EditorExt | null {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = filename.slice(dot).toLowerCase() as EditorExt;
  return VALID_EXTS.includes(ext) ? ext : null;
}

/** 从远程 URL 推断文档扩展名 */
function extFromUrl(url: string): EditorExt | null {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() ?? '';
    return extFromFilename(filename);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route detection
// ---------------------------------------------------------------------------

/**
 * 根据当前 pathname 返回编辑器类型，不在编辑器路由则返回 null。
 * 使用 endsWith 兼容 v7（/docx/）和 v9（/9.3.0/docx/）两种前缀。
 */
export function getEditorExt(): EditorExt | null {
  const p = location.pathname;
  for (const [suffix, ext] of Object.entries(ROUTE_TO_EXT)) {
    if (p.endsWith(suffix)) return ext;
  }
  return null;
}

export function isEditorRoute(): boolean {
  return getEditorExt() !== null;
}

// ---------------------------------------------------------------------------
// Startup action
// ---------------------------------------------------------------------------

/**
 * 推断当前页面加载时应执行的动作。
 * 在 index.ts 的初始化入口处调用一次即可。
 */
export function getStartupAction(): StartupAction {
  const ext = getEditorExt();
  if (!ext) return { type: 'home' };

  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  const file = params.get('file');

  if (src) {
    try {
      return { type: 'editor-url', ext, url: decodeURIComponent(src) };
    } catch {
      return { type: 'editor-url', ext, url: src };
    }
  }

  if (file !== null) {
    // ?file= 参数仅记录文件名，真实数据无法从 URL 恢复
    return { type: 'editor-file-lost', ext, filename: file };
  }

  return { type: 'editor-new', ext };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * 新建文档：MPA 真实页面导航。
 * 适用于首页"新建 Word / Excel / …"按钮。
 * 后退按钮会做真实页面返回，无需 JS 介入。
 */
export function navigateNewDocument(ext: EditorExt): void {
  window.location.href = editorPath(ext);
}

/**
 * 打开远程 URL：MPA 真实页面导航，URL 放入 ?src= 参数。
 * 支持刷新恢复（重新 fetch）和链接分享。
 *
 * @param url   文档远程地址
 * @param ext   可选，不传则从 URL 文件名自动推断，推断失败默认 .docx
 */
export function navigateRemoteDocument(url: string, ext?: EditorExt): void {
  const targetExt = ext ?? extFromUrl(url) ?? '.docx';
  window.location.href = editorPath(targetExt, { src: url });
}

/**
 * 打开本地文件：pushState 伪导航，不重载页面。
 * File 对象留在内存，调用此函数后立即在当前页面打开编辑器。
 * 后退按钮触发 popstate，由 registerLocalFilePopstate 处理。
 *
 * 需在实际打开编辑器之前调用，以便 URL 在编辑器打开前就已更新。
 *
 * @param file  用户选择的本地文件
 */
export function pushLocalFileRoute(file: File): void {
  const ext = extFromFilename(file.name) ?? '.docx';
  const path = editorPath(ext, { file: file.name });
  history.pushState({ localFile: true, ext }, '', path);
}

// ---------------------------------------------------------------------------
// popstate — 本地文件场景的后退处理
// ---------------------------------------------------------------------------

export type LocalFilePopstateCallbacks = {
  /** 后退到首页时调用：隐藏编辑器、显示控制面板 */
  showHome: () => void;
  /** 销毁当前编辑器实例 */
  destroyEditor: () => void;
};

let _popstateRegistered = false;
let _popstateCallbacks: LocalFilePopstateCallbacks | null = null;

function _handlePopstate(): void {
  // URL 已回到首页路由（不再是编辑器路径）时触发关闭
  if (!isEditorRoute()) {
    _popstateCallbacks?.destroyEditor();
    _popstateCallbacks?.showHome();
  }
}

/**
 * 在首页注册 popstate 监听器，处理本地文件打开后用户按下浏览器后退按钮的场景。
 * 只需注册一次；多次调用只更新回调，不重复绑定事件。
 */
export function registerLocalFilePopstate(callbacks: LocalFilePopstateCallbacks): void {
  _popstateCallbacks = callbacks;
  if (!_popstateRegistered) {
    window.addEventListener('popstate', _handlePopstate);
    _popstateRegistered = true;
  }
}
