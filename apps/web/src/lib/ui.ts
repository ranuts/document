import { localStorageGetItem, localStorageSetItem } from 'ranuts/utils';
import { LanguageCode, getLanguage, t } from '@bybrowser/editor';
import { onOpenDocument } from './document';
import { navigateNewDocument } from './app-router';

type LandingPage = {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  sections: Array<{
    title: string;
    body: string;
  }>;
};

const landingPages: Record<string, LandingPage> = {
  '/': {
    eyebrow: 'Private Office editing, no document server',
    title: 'Local Document Editor in Your Browser',
    description:
      'Edit DOCX, XLSX, PPTX, and CSV files locally in your browser. Files stay on your device, with no upload, no account, and no document server runtime.',
    badge: 'Multi-format',
    sections: [
      {
        title: 'Private by default',
        body: 'The editor runs in the browser and keeps local files local, which makes it useful for sensitive documents, internal tools, and offline workflows.',
      },
      {
        title: 'Deploy anywhere',
        body: 'Ship the static build to GitHub Pages, Vercel, Netlify, Cloudflare Pages, Nginx, or Docker. No document server is required.',
      },
      {
        title: 'Built for products',
        body: 'Use the iframe postMessage API to embed editing into your own app while your parent system owns auth, storage, and upload flow.',
      },
    ],
  },
  '/private-document-editor/': {
    eyebrow: 'Private document editing in the browser',
    title: 'Private Document Editor With No Upload',
    description:
      'Open Office documents in a local-first browser editor. Edit Word, Excel, PowerPoint, and CSV files without sending private files to a hosted document service.',
    badge: 'No upload',
    sections: [
      {
        title: 'Local-first workflow',
        body: 'Documents are opened from the device or a CORS-enabled URL and handled in the browser, which keeps sensitive files out of third-party upload pipelines.',
      },
      {
        title: 'Office file coverage',
        body: 'Use one editor entry point for DOCX, XLSX, PPTX, and CSV workflows instead of separate single-format utilities.',
      },
      {
        title: 'Deployable by teams',
        body: 'Run it as a static site or Docker container for internal portals, privacy-sensitive reviews, and offline-friendly document tasks.',
      },
    ],
  },
  '/docx-editor/': {
    eyebrow: 'Edit Word documents without upload',
    title: 'DOCX editor with no server upload',
    description:
      'Open Word documents directly in the browser, edit locally, and save the file back to your device. A focused path for privacy-sensitive DOCX workflows.',
    badge: 'DOCX no upload',
    sections: [
      {
        title: 'No account gate',
        body: 'Users can start from a local file or create a new document without signing in or sending a file to a hosted conversion service.',
      },
      {
        title: 'Format-aware editing',
        body: 'The editor is powered by OnlyOffice web apps and WASM conversion assets, preserving Office workflows better than plain rich-text editors.',
      },
      {
        title: 'Offline-ready',
        body: 'Install the PWA over HTTPS and keep a document editor available even when the network is unreliable.',
      },
    ],
  },
  '/xlsx-editor/': {
    eyebrow: 'Edit spreadsheets without upload',
    title: 'XLSX Editor in Your Browser',
    description:
      'Open and edit Excel spreadsheets locally in the browser. Create or review XLSX files without an account, upload flow, or document server.',
    badge: 'XLSX local',
    sections: [
      {
        title: 'Spreadsheet editing',
        body: 'Work with Excel-style files through the OnlyOffice spreadsheet editor while keeping the file workflow local-first.',
      },
      {
        title: 'Useful for internal data',
        body: 'Review sheets, operational exports, and lightweight data files where a cloud upload is unnecessary or undesirable.',
      },
      {
        title: 'Static deployment',
        body: 'Host the same frontend build on GitHub Pages, Cloudflare Pages, Vercel, Nginx, or Docker.',
      },
    ],
  },
  '/pptx-editor/': {
    eyebrow: 'Edit presentations without upload',
    title: 'PPTX Editor in Your Browser',
    description:
      'Open and edit PowerPoint presentations locally in the browser. Create or update PPTX files with no account and no document server.',
    badge: 'PPTX local',
    sections: [
      {
        title: 'Presentation workflow',
        body: 'Use the OnlyOffice presentation editor for slide decks while keeping private files on the user device.',
      },
      {
        title: 'No hosted conversion step',
        body: 'The local-first architecture avoids sending presentation files to a third-party conversion endpoint for basic editing workflows.',
      },
      {
        title: 'Ready for portals',
        body: 'Embed it in internal products, LMS systems, or admin tools with the iframe API when document storage lives elsewhere.',
      },
    ],
  },
  '/csv-editor/': {
    eyebrow: 'Open tabular files locally',
    title: 'CSV Editor in Your Browser',
    description:
      'Open CSV files in a browser-based Office editor for local review and editing. Keep simple tabular documents off upload-based tools.',
    badge: 'CSV local',
    sections: [
      {
        title: 'Tabular file support',
        body: 'Use a spreadsheet-style interface for CSV files instead of editing structured data in a plain text box.',
      },
      {
        title: 'Private by default',
        body: 'A local-first flow is useful for exports, reports, and small datasets that should not be copied into random online tools.',
      },
      {
        title: 'One editor surface',
        body: 'Keep CSV, XLSX, DOCX, and PPTX workflows behind the same product interface and deployment pipeline.',
      },
    ],
  },
  '/onlyoffice-wasm/': {
    eyebrow: 'OnlyOffice in a static web app',
    title: 'OnlyOffice WASM document editor',
    description:
      'A pure frontend integration path for OnlyOffice web apps and x2t WebAssembly conversion. Explore local Office editing without operating Document Server.',
    badge: 'WASM architecture',
    sections: [
      {
        title: 'Serverless architecture',
        body: 'Static assets, WebAssembly conversion, and browser APIs replace a traditional document conversion backend for many local editing scenarios.',
      },
      {
        title: 'Developer friendly',
        body: 'The project includes Docker deployment, GitHub Pages deployment, iframe embedding, and documented postMessage events.',
      },
      {
        title: 'Open-source constraints',
        body: 'Fonts, AGPL obligations, and Office compatibility are documented so teams can evaluate the approach before adopting it.',
      },
    ],
  },
  '/embed-document-editor/': {
    eyebrow: 'Iframe API for product teams',
    title: 'Embed a private document editor',
    description:
      'Embed the editor with an iframe and control document open/save flows with postMessage. Keep auth, permissions, and file storage in the parent app.',
    badge: 'postMessage API',
    sections: [
      {
        title: 'Clean ownership boundary',
        body: 'The parent application handles users, permissions, upload, and persistence. The iframe focuses on editing and document events.',
      },
      {
        title: 'Works with URLs',
        body: 'Open documents with query parameters or postMessage, as long as remote sources provide CORS-compatible access.',
      },
      {
        title: 'Product integration',
        body: 'Use it for knowledge bases, LMS systems, internal portals, admin dashboards, or document review flows.',
      },
    ],
  },
  '/self-hosted-document-editor/': {
    eyebrow: 'Static hosting or Docker',
    title: 'Self-hosted document editor',
    description:
      'Run a browser-based Office editor on your own infrastructure. Deploy as static files or a Docker container, with optional HTTPS and basic auth.',
    badge: 'Self-hosted',
    sections: [
      {
        title: 'Own the deployment',
        body: 'Serve the static app from Nginx, Cloudflare Pages, Vercel, Netlify, GitHub Pages, or the provided Docker image.',
      },
      {
        title: 'Useful for private networks',
        body: 'A local-first editor is a practical fit for intranets, labs, regulated teams, and workflows where documents should not leave the device.',
      },
      {
        title: 'Simple operational model',
        body: 'Build once, host static assets, and avoid maintaining a collaborative document server for single-user editing flows.',
      },
    ],
  },
};

const zhLandingPages: Record<string, LandingPage> = {
  '/': {
    eyebrow: '私密 Office 编辑，无需文档服务器',
    title: '在浏览器中本地编辑文档',
    description:
      '在浏览器中直接编辑 DOCX、XLSX、PPTX 和 CSV 文件，文件始终留在设备上，无需上传、无需账号、无需文档服务器。',
    badge: '多格式支持',
    sections: [
      {
        title: '默认私密',
        body: '编辑器在浏览器内运行，本地文件始终留在本地，适合处理敏感文档、内部工具和离线工作流。',
      },
      {
        title: '随处部署',
        body: '将静态构建部署到 GitHub Pages、Vercel、Netlify、Cloudflare Pages、Nginx 或 Docker，无需文档服务器。',
      },
      {
        title: '面向产品集成',
        body: '通过 iframe postMessage API 将编辑器嵌入自己的应用，认证、存储和上传流程由父应用掌控。',
      },
    ],
  },
  '/private-document-editor/': {
    eyebrow: '浏览器内私密文档编辑',
    title: '无需上传的隐私文档编辑器',
    description:
      '在本地优先的浏览器编辑器中打开 Office 文档，编辑 Word、Excel、PowerPoint 和 CSV 文件，无需将私密文件发送到托管服务。',
    badge: '无需上传',
    sections: [
      {
        title: '本地优先工作流',
        body: '文档从设备或支持 CORS 的 URL 打开，在浏览器内处理，敏感文件不会进入第三方上传管道。',
      },
      {
        title: '全格式覆盖',
        body: '一个编辑器入口支持 DOCX、XLSX、PPTX 和 CSV，无需为每种格式单独使用不同工具。',
      },
      {
        title: '团队可部署',
        body: '作为静态站点或 Docker 容器运行，适用于内部门户、隐私敏感审阅和离线文档场景。',
      },
    ],
  },
  '/docx-editor/': {
    eyebrow: '无需上传，编辑 Word 文档',
    title: '无需上传的 DOCX 编辑器',
    description: '直接在浏览器中打开 Word 文档，在本地编辑并保存回设备，专为隐私敏感的 DOCX 工作流设计。',
    badge: 'DOCX 无需上传',
    sections: [
      {
        title: '无账号门槛',
        body: '从本地文件开始或新建文档，无需登录，也无需将文件发送到托管转换服务。',
      },
      {
        title: '格式感知编辑',
        body: '编辑器基于 OnlyOffice web apps 和 WASM 转换资产，比纯富文本编辑器更好地保留 Office 工作流。',
      },
      {
        title: '离线可用',
        body: '通过 HTTPS 安装为 PWA，即使网络不稳定也能随时使用文档编辑器。',
      },
    ],
  },
  '/xlsx-editor/': {
    eyebrow: '无需上传，编辑表格',
    title: '浏览器内 XLSX 编辑器',
    description: '在浏览器中本地打开和编辑 Excel 表格，无需账号、无需上传、无需文档服务器。',
    badge: 'XLSX 本地',
    sections: [
      {
        title: '表格编辑',
        body: '通过 OnlyOffice 表格编辑器处理 Excel 格式文件，同时保持本地优先的文件工作流。',
      },
      {
        title: '适合内部数据',
        body: '查看报表、运营导出和轻量数据文件，无需不必要的云端上传。',
      },
      {
        title: '静态部署',
        body: '可部署到 GitHub Pages、Cloudflare Pages、Vercel、Nginx 或 Docker。',
      },
    ],
  },
  '/pptx-editor/': {
    eyebrow: '无需上传，编辑演示文稿',
    title: '浏览器内 PPTX 编辑器',
    description: '在浏览器中本地打开和编辑 PowerPoint 演示文稿，无需账号，无需文档服务器。',
    badge: 'PPTX 本地',
    sections: [
      {
        title: '演示文稿工作流',
        body: '使用 OnlyOffice 演示文稿编辑器处理幻灯片，同时将私密文件保留在用户设备上。',
      },
      {
        title: '无托管转换步骤',
        body: '本地优先架构避免将演示文件发送到第三方转换端点。',
      },
      {
        title: '适合门户嵌入',
        body: '通过 iframe API 嵌入内部产品、LMS 系统或管理工具，文件存储留在父应用。',
      },
    ],
  },
  '/csv-editor/': {
    eyebrow: '本地打开表格文件',
    title: '浏览器内 CSV 编辑器',
    description: '在基于浏览器的 Office 编辑器中打开 CSV 文件，本地查看和编辑，避免将数据上传到在线工具。',
    badge: 'CSV 本地',
    sections: [
      {
        title: '表格文件支持',
        body: '使用电子表格风格界面处理 CSV，而非在纯文本框中编辑结构化数据。',
      },
      {
        title: '默认私密',
        body: '本地优先流程适合不应复制到随机在线工具的导出、报告和小型数据集。',
      },
      {
        title: '统一编辑器',
        body: 'CSV、XLSX、DOCX 和 PPTX 工作流共用同一产品界面和部署管道。',
      },
    ],
  },
  '/onlyoffice-wasm/': {
    eyebrow: '静态 Web 应用中的 OnlyOffice',
    title: 'OnlyOffice WASM 文档编辑器',
    description:
      'OnlyOffice web apps 和 x2t WebAssembly 转换的纯前端集成方案，无需运行 Document Server 即可体验本地 Office 编辑。',
    badge: 'WASM 架构',
    sections: [
      {
        title: '无服务器架构',
        body: '静态资产、WebAssembly 转换和浏览器 API 替代了传统文档转换后端。',
      },
      {
        title: '开发者友好',
        body: '项目包含 Docker 部署、GitHub Pages 部署、iframe 嵌入和文档化的 postMessage 事件。',
      },
      {
        title: '开源约束说明',
        body: '字体、AGPL 义务和 Office 兼容性均有文档说明，团队可在采用前评估方案。',
      },
    ],
  },
  '/embed-document-editor/': {
    eyebrow: '面向产品团队的 Iframe API',
    title: '嵌入私密文档编辑器',
    description: '通过 iframe 嵌入编辑器，用 postMessage 控制文档打开和保存流程，认证、权限和文件存储由父应用掌控。',
    badge: 'postMessage API',
    sections: [
      {
        title: '清晰的职责边界',
        body: '父应用负责用户、权限、上传和持久化，iframe 专注于编辑和文档事件。',
      },
      {
        title: '支持 URL 打开',
        body: '通过查询参数或 postMessage 打开文档，只需远程来源支持 CORS。',
      },
      {
        title: '产品集成',
        body: '适用于知识库、LMS 系统、内部门户、管理后台或文档审阅流程。',
      },
    ],
  },
  '/self-hosted-document-editor/': {
    eyebrow: '静态托管或 Docker',
    title: '自部署文档编辑器',
    description:
      '在自己的基础设施上运行基于浏览器的 Office 编辑器，部署为静态文件或 Docker 容器，支持可选的 HTTPS 和基础认证。',
    badge: '自部署',
    sections: [
      {
        title: '掌控部署',
        body: '从 Nginx、Cloudflare Pages、Vercel、Netlify、GitHub Pages 或提供的 Docker 镜像提供静态应用。',
      },
      {
        title: '适合私有网络',
        body: '本地优先编辑器适合内网、实验室、合规团队以及文档不应离开设备的工作流。',
      },
      {
        title: '简单运维模型',
        body: '一次构建，托管静态资产，无需为单用户编辑场景维护协作文档服务器。',
      },
    ],
  },
};

const pageSlugs = [
  'private-document-editor',
  'docx-editor',
  'xlsx-editor',
  'pptx-editor',
  'csv-editor',
  'onlyoffice-wasm',
  'embed-document-editor',
  'self-hosted-document-editor',
];

const allLandingPages: Record<string, Record<string, LandingPage>> = {
  [LanguageCode.EN]: landingPages,
  [LanguageCode.ZH]: zhLandingPages,
};

const normalizePathname = () => {
  const pathname = window.location.pathname.replace(/^\/zh-cn/, '');
  for (const slug of pageSlugs) {
    if (pathname.endsWith(`/${slug}`) || pathname.endsWith(`/${slug}/`)) return `/${slug}/`;
  }
  return '/';
};

const getLandingPage = () => {
  const lang = getLanguage();
  const key = normalizePathname();
  return allLandingPages[lang]?.[key] ?? allLandingPages[lang]?.['/'] ?? landingPages['/'];
};

const getSiteRoot = () => {
  const pathname = window.location.pathname;
  const isZh = getLanguage() === LanguageCode.ZH;
  const prefix = isZh ? '/zh-cn' : '';
  for (const slug of pageSlugs) {
    if (pathname.lastIndexOf(`/${slug}`) !== -1) return `${prefix}/`;
  }
  const clean = pathname.replace(/^\/zh-cn/, '') || '/';
  return prefix + (clean.endsWith('/') ? clean : `${clean}/`);
};

const updatePageMeta = (page: LandingPage) => {
  document.title = `${page.title} | OnlyOffice WASM`;
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description) description.content = page.description;
  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = page.title;
  const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
  if (ogDescription) ogDescription.content = page.description;
};

// Helper: push an ad slot once it is in the DOM
const pushAdSlot = (ins: HTMLElement) => {
  try {
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    ins.dataset.pushed = '1';
  } catch {
    // AdSense not loaded yet — slot will activate when script loads
  }
};

// Create a Google AdSense <ins> element (slot activates when AdSense script is present)
const createInsSlot = (id: string): HTMLElement => {
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'ad-unit';

  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  // Replace with your real publisher ID and slot IDs before going live
  ins.setAttribute('data-ad-client', 'ca-pub-XXXXXXXXXXXXXXXX');
  ins.setAttribute('data-ad-slot', '0000000000');
  ins.setAttribute('data-ad-format', 'auto');
  ins.setAttribute('data-full-width-responsive', 'true');
  wrap.appendChild(ins);
  return wrap;
};

// Hide control panel when editor opens
export const hideControlPanel = (): void => {
  const container = document.querySelector('#control-panel-container') as HTMLElement;
  if (container) {
    container.style.pointerEvents = 'none';
    container.style.opacity = '0';
    setTimeout(() => {
      container.style.display = 'none';
    }, 300);
  }
  document.body.classList.add('editor-open');
  const landingNav = document.getElementById('landing-nav');
  if (landingNav) landingNav.style.display = 'none';
};

// Show control panel when returning to home
export const showControlPanel = (): void => {
  const container = document.querySelector('#control-panel-container') as HTMLElement;
  if (container) {
    container.style.display = 'flex';
    setTimeout(() => {
      container.style.opacity = '1';
    }, 10);
  }
  document.body.classList.remove('editor-open');
  const landingNav = document.getElementById('landing-nav');
  if (landingNav) landingNav.style.display = 'flex';
};

// Return the URL for a given target language on the current page.
const getLangUrl = (targetLang: LanguageCode): string => {
  const pathname = window.location.pathname;
  if (targetLang === LanguageCode.ZH) {
    if (pathname.startsWith('/zh-cn/')) return pathname;
    for (const slug of pageSlugs) {
      if (pathname.endsWith(`/${slug}`) || pathname.endsWith(`/${slug}/`)) {
        return `/zh-cn/${slug}/`;
      }
    }
    return '/zh-cn/';
  }
  // target EN
  if (!pathname.startsWith('/zh-cn/')) return pathname;
  return pathname.replace(/^\/zh-cn/, '') || '/';
};

// Fixed top navigation — created once, independent of landing shell
export const createLandingNav = (): void => {
  const nav = document.createElement('nav');
  nav.id = 'landing-nav';
  nav.className = 'landing-nav';

  const createTopLink = (text: string, href: string, external = false) => {
    const a = document.createElement('a');
    a.className = 'top-link';
    a.href = href;
    a.textContent = text;
    if (external) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  };

  nav.appendChild(createTopLink('GitHub', 'https://github.com/ranuts/document', true));
  nav.appendChild(createTopLink('Issues', 'https://github.com/ranuts/document/issues', true));

  // Tag icon + select version picker
  const isBeta = __IS_BETA__;

  const versionPicker = document.createElement('div');
  versionPicker.className = 'version-picker';

  const versionIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  versionIcon.setAttribute('class', 'version-icon');
  versionIcon.setAttribute('viewBox', '0 0 24 24');
  versionIcon.setAttribute('fill', 'none');
  versionIcon.setAttribute('stroke', 'currentColor');
  versionIcon.setAttribute('stroke-width', '2');
  versionIcon.setAttribute('stroke-linecap', 'round');
  versionIcon.setAttribute('stroke-linejoin', 'round');
  versionIcon.setAttribute('aria-hidden', 'true');
  versionIcon.innerHTML =
    '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>' +
    '<line x1="7" y1="7" x2="7.01" y2="7"/>';

  const versionSelect = document.createElement('select');
  versionSelect.className = 'version-select';
  versionSelect.setAttribute('aria-label', 'Version');

  const versionOptions: Array<{ value: string; label: string }> = [
    { value: 'stable', label: 'v7' },
    { value: 'beta', label: 'v9.3.0' },
  ];
  for (const { value, label } of versionOptions) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if ((value === 'beta') === isBeta) opt.selected = true;
    versionSelect.appendChild(opt);
  }

  const betaBadge = document.createElement('span');
  betaBadge.className = 'beta-badge';
  betaBadge.textContent = 'beta';
  if (!isBeta) betaBadge.hidden = true;

  versionSelect.addEventListener('change', () => {
    betaBadge.hidden = versionSelect.value !== 'beta';
    window.location.href = versionSelect.value === 'beta' ? __BETA_URL__ : __STABLE_URL__;
  });

  versionPicker.appendChild(versionIcon);
  versionPicker.appendChild(versionSelect);
  versionPicker.appendChild(betaBadge);
  nav.appendChild(versionPicker);

  // Globe icon + select language picker
  const picker = document.createElement('div');
  picker.className = 'lang-picker';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'lang-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    '<circle cx="12" cy="12" r="10"/>' +
    '<line x1="2" y1="12" x2="22" y2="12"/>' +
    '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';

  const select = document.createElement('select');
  select.className = 'lang-select';
  select.setAttribute('aria-label', 'Language');

  const currentLang = getLanguage();
  const options: Array<{ code: LanguageCode; label: string }> = [
    { code: LanguageCode.EN, label: 'English' },
    { code: LanguageCode.ZH, label: '中文' },
  ];
  for (const { code, label } of options) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    if (code === currentLang) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    window.location.href = getLangUrl(select.value as LanguageCode);
  });

  picker.appendChild(svg);
  picker.appendChild(select);
  nav.appendChild(picker);

  document.body.appendChild(nav);
};

// Create and append the control panel
export const createControlPanel = (): void => {
  document.querySelector('#seo-content')?.remove();

  const page = getLandingPage();
  updatePageMeta(page);

  // Create control panel container - centered in viewport
  const container = document.createElement('div');
  container.id = 'control-panel-container';
  container.className = 'control-panel-container';

  const landing = document.createElement('main');
  landing.className = 'landing-shell';

  const hero = document.createElement('section');
  hero.className = 'landing-hero';

  const content = document.createElement('div');
  content.className = 'landing-copy';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'landing-eyebrow';
  eyebrow.textContent = page.eyebrow;

  const title = document.createElement('h1');
  title.className = 'landing-title';
  title.textContent = page.title;

  const description = document.createElement('p');
  description.className = 'landing-description';
  description.textContent = page.description;

  const trust = document.createElement('div');
  trust.className = 'landing-trust';
  [t('trustNoUpload'), t('trustNoAccount'), t('trustPwaOffline'), page.badge].forEach((item) => {
    const badge = document.createElement('span');
    badge.textContent = item;
    trust.appendChild(badge);
  });

  content.appendChild(eyebrow);
  content.appendChild(title);
  content.appendChild(description);
  content.appendChild(trust);

  const panel = document.createElement('div');
  panel.className = 'landing-action-panel';

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
  const uploadButton = createTextButton('upload-button', t('uploadDocument'), () => {
    onOpenDocument();
    // If user cancelled, nothing happens (onchange won't fire, control panel remains visible)
    // If user selected file, document will be opened and control panel will be hidden in handleChange
  });
  buttonGroup.appendChild(uploadButton);

  const newWordButton = createTextButton('new-word-button', t('newWord'), () => {
    navigateNewDocument('.docx');
  });
  buttonGroup.appendChild(newWordButton);

  const newExcelButton = createTextButton('new-excel-button', t('newExcel'), () => {
    navigateNewDocument('.xlsx');
  });
  buttonGroup.appendChild(newExcelButton);

  const newPptxButton = createTextButton('new-pptx-button', t('newPowerPoint'), () => {
    navigateNewDocument('.pptx');
  });
  buttonGroup.appendChild(newPptxButton);

  panel.appendChild(buttonGroup);

  const hint = document.createElement('p');
  hint.className = 'landing-hint';
  hint.textContent = t('landingHint');
  panel.appendChild(hint);

  hero.appendChild(content);
  hero.appendChild(panel);

  const sections = document.createElement('section');
  sections.className = 'landing-sections';
  page.sections.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'landing-section';
    const h2 = document.createElement('h2');
    h2.textContent = item.title;
    const body = document.createElement('p');
    body.textContent = item.body;
    card.appendChild(h2);
    card.appendChild(body);
    sections.appendChild(card);
  });

  const links = document.createElement('nav');
  links.className = 'landing-links';
  const root = getSiteRoot();
  const navItems: [string, string][] = [
    [t('navPrivateEditor'), `${root}private-document-editor/`],
    [t('navDocxEditor'), `${root}docx-editor/`],
    [t('navXlsxEditor'), `${root}xlsx-editor/`],
    [t('navPptxEditor'), `${root}pptx-editor/`],
    [t('navCsvEditor'), `${root}csv-editor/`],
    [t('navOnlyofficeWasm'), `${root}onlyoffice-wasm/`],
    [t('navEmbedApi'), `${root}embed-document-editor/`],
    [t('navSelfHosted'), `${root}self-hosted-document-editor/`],
    ['GitHub', 'https://github.com/ranuts/document'],
  ];
  navItems.forEach(([label, href]) => {
    const link = document.createElement('a');
    link.textContent = label;
    link.href = href;
    links.appendChild(link);
  });

  // Ad slot between hero and feature cards (landing-page only, hidden when editor opens)
  const landingAd = createInsSlot('ad-landing');
  const landingAdIns = landingAd.querySelector('ins') as HTMLElement;

  landing.appendChild(hero);
  landing.appendChild(landingAd);
  landing.appendChild(sections);
  landing.appendChild(links);
  container.appendChild(landing);
  document.body.appendChild(container);

  // Activate landing ad after element is in DOM
  if (landingAdIns) pushAdSlot(landingAdIns);

};
