# CLAUDE.md — document 项目指南

## 项目概述

基于 OnlyOffice 的本地 Web 文档编辑器，所有处理在浏览器端完成，无需服务器，保护用户隐私。支持 docx、xlsx、pptx、csv 等格式。

- **线上地址**：https://ranuts.github.io/document/
- **GitHub**：https://github.com/ranuts/document
- **技术栈**：TypeScript + Vite + Tailwind CSS + OnlyOffice Web Apps

---

## 开发命令

```bash
pnpm install --frozen-lockfile   # 安装依赖
pnpm run dev                     # 启动开发服务器（含热更新）
pnpm run build                   # 生产构建（执行 bin/build.sh）
pnpm run build:single            # 打包为单个 HTML 文件
pnpm run lint:ts                 # oxlint + tsc --noEmit（CI 必跑）
pnpm run format:check            # prettier 格式检查（CI 必跑）
pnpm run test                    # 单元测试（Vitest）
pnpm run test:coverage           # 带覆盖率的单元测试
pnpm run test:e2e                # E2E 测试（Playwright，需先 build）
pnpm run lint                    # lint:ts + lint:docker
```

---

## 目录结构

```
lib/                  # 核心业务逻辑（纯 TypeScript）
  converter.ts          # 加载 OnlyOffice API / x2t 转换器
  document.ts           # 文件打开、新建、URL 加载
  document-converter.ts # 格式转换（docx/xlsx/pptx/csv 互转）
  document-types.ts     # 共享类型定义
  document-utils.ts     # 纯工具函数（类型判断、MIME、路径）
  embed-api.ts          # iframe 嵌入 API（postMessage 协议）
  events.ts             # MessageCodec 事件处理（桌面端集成）
  file-types.ts         # OnlyOffice 文件类型常量映射
  i18n.ts               # 国际化（中/英/日/韩/德/法/西/葡/俄）
  loading.ts            # 加载状态 UI
  onlyoffice-editor.ts  # 编辑器实例生命周期、保存、只读模式
  ui.ts                 # 控制面板、菜单、FAB 等 UI 组件
  empty_bin.ts          # 新建文档时使用的空文档二进制数据
store/
  index.ts              # 全局状态（当前文档对象），基于 ranuts/utils createSignal
types/
  editor.d.ts           # OnlyOffice DocEditor 类型声明
  assets.d.ts           # CSS 模块类型声明（declare module '*.css'）
styles/
  base.css              # 全局样式（含 embed-mode 布局）
index.ts              # 应用入口（初始化事件、UI、PWA）
index.html            # HTML 入口
```

---

## 核心模块说明

### embed-api.ts — iframe 嵌入 API

允许父页面通过 `postMessage` 控制编辑器。触发条件：

- URL 含 `?embed=`、`?embed=1`、`?embed=true`、`?embedded=1` 等参数
- 或页面被嵌入 iframe（`window.parent !== window`）

支持的消息类型：

| 消息类型                                                                              | 说明                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `document:open` / `document:open-url` / `document:open-file` / `document:open-buffer` | 打开文档（支持 url / File / Blob / ArrayBuffer / Uint8Array） |
| `document:set-readonly`                                                               | 切换只读模式                                                  |
| `document:save`                                                                       | 触发保存，父页面收到带 File 的 `document:saved` 响应          |
| `document:get-state`                                                                  | 查询当前状态（readonly、hasDocument）                         |

使用 `?embedOrigin=https://example.com` 可限制消息来源。

### onlyoffice-editor.ts — 编辑器生命周期

- `createEditorInstance(config)` — 创建/重建编辑器，内部有操作队列防并发
- `setReadonlyMode(bool)` / `getReadonlyMode()` — 只读模式
- `requestSaveDocument(targetExt, options)` — 触发编辑器保存并返回 File，60s 超时
- `setConverterCallbacks(...)` — 注入转换器（解耦循环依赖）
- `editorSendCommand(params)` — 内部 helper，优先用 `serviceCommand`（9.3.0），降级 `sendCommand`（7.4.1）

**9.3.0 Breaking Change**：`DocEditor.sendCommand` 已改名为 `serviceCommand`。
直接调用 `window.editor.sendCommand(...)` 在 9.3.0 会抛 `TypeError`。
所有调用均通过 `editorSendCommand()` helper 路由，保持双版本兼容。

**9.3.0 Web Mode 权限初始化时序（重要）**：文档加载有隐式前提——
`onEditorPermissions` 必须在 `onDocumentContentReady` 之前运行，否则各 controller 的 `this.mode` 为 `undefined`，`createDelayedElements()` 崩溃。

正常路径：socket.io 服务器推送 join 事件 → SDK 触发 `asc_onGetEditorPermissions` → `onEditorPermissions` → `_isPermissionsInited=true`。

无服务器的 `onAppReady` 四步流程（`src/lib/onlyoffice-editor.ts`）：

1. 等 `loadDocument` 运行完（`mainCtrl.document` 有值）
2. 拦截 `mainCtrl.onEditorPermissions`，永远用 `fakePerms`（防止 SDK 的第二次调用把 `isEdit` 重置为 false）
3. 等 `_isPermissionsInited=true`，超过 2s 后手动触发
4. Patch SDK 门控函数（见下），再调用 `api.asc_openDocumentFromBytes(ooxmlBytes)`

详细分析见 [docs/explorations/2026-06-15-web-mode-permissions-debug.md](docs/explorations/2026-06-15-web-mode-permissions-debug.md)。

**⚠️ 核心 Bug — Shc/Mrc/K8b 门控函数（2026-06-21 修复）**：`asc_openDocumentFromBytes` 内部调用 `Shc`（Word）/`Mrc`（Cell）/`K8b`（Slide），这些函数检测 `!a.AscDesktopEditor`。我们的 polyfill 使其为 truthy，所以走 Desktop 分支（`LocalStartOpen()` noop）而非 Web 路径（`BRj`/`rxk`/`Fzj`），字节被静默丢弃，canvas 永远空白。

修复：在步骤 4 之前 patch 三个门控函数，强制走 Web 路径：

```typescript
patchWebPath('Shc', 'BRj', 'C0a', 'b_'); // Word SDK
patchWebPath('Mrc', 'rxk', 'J6a', 'tW'); // Cell SDK
patchWebPath('K8b', 'Fzj', '$cb', 'aN'); // Slide SDK
```

详细分析见 [docs/explorations/2026-06-21-shc-brj-web-path-patch.md](docs/explorations/2026-06-21-shc-brj-web-path-patch.md)。

**文档字节来源**：`onAppReady` 里 `binData` 含分号 → 新建文档，从 `g_sEmpty_ooxml` 取对应扩展名的最小 OOXML ZIP；否则用 `pendingCopy`（打开已有文件时在 `createEditorInstance` 入口处拷贝的原始 `Uint8Array`）。

**弹窗抑制（2026-06-21 修复了隐藏 bug）**：`suppressDialogsInFrame(iwin)` 在 `onAppReady` 里 patch `iwin.Common.UI.warning` / `Common.UI.alert`，抑制 "Connection is lost" 弹窗。`vite.config.ts` 的 `suppressConnectionLost` 是冗余防线。

**⚠️ 关键陷阱**：`Common.UI.alert()` 的返回值会被 `app.js` 链式调用：`Common.UI.alert(s).$window.attr("data-value", t)`。如果 suppress 函数返回 `undefined`，下一步访问 `undefined.$window` 会抛 TypeError，产生"Cannot read properties of undefined (reading '$window')"的级联崩溃。正确做法是返回带有 `$window` 属性的 mock 对象。

**AscDesktopEditor polyfill（2026-06-21 新增）**：SDK 假设运行在 Desktop App 内，所有文件选取操作（插入图片、插入视频、插入音频、插入外部文档等）均调用 `window.AscDesktopEditor.OpenFilenameDialog()` 和 `LocalFileGetImageUrl()`。在纯浏览器环境中这个对象不存在，导致所有工具栏文件操作立即 crash。

修复：在 Vite 中间件注入到所有三种编辑器 iframe 的 `<script>` 里实现 polyfill：

- `OpenFilenameDialog(filter, isMultiselect, callback)` → 创建隐藏的 `<input type="file">`，用 filter 类型（`"images"`/`"video"`/`"audio"`/`"word"`/`"cell"`）设置 `accept` 属性
- `LocalFileGetImageUrl(key)` → 通过内部 `_map` 返回 `URL.createObjectURL()` 生成的 blob URL
- `AddVideo(key, cb)` / `AddAudio(key, cb)` → 从 `_map` 取 blob URL，以 `cb(0, {url, name})` 格式回调
- `DownloadFiles(urls, extra, cb)` → 用 `fetch()` 下载远程 URL，转为 blob URL（word SDK 专用）
- `LocalFileGetRelativePath(key)` → 返回 `false`（cell SDK 专用，配合 `LocalFileGetSaved()` 短路）
- `DownloadFiles(urls, extra, cb)` → 用 `fetch()` 下载远程 URL，转为 blob URL（word SDK 专用）
- `LocalFileGetRelativePath(key)` → 返回 `false`（cell SDK 专用，配合 `LocalFileGetSaved()` 短路）
- `execCommand(cmd, data)` → noop（app.js 在 SDK 初始化最早期**同步调用**，缺失则整个初始化链断开，`onAppReady` 永远不触发，文档永远停留在 loading skeleton）
- `LocalFileRecents()` → `[]`（`execCommand("doc:onready")` 之后立即调用）
- `CreateEditorApi(apiObj)` → noop（`sdk-all-min.js` 中 `a.AscDesktopEditor && a.AscDesktopEditor.CreateEditorApi(this)` 将 Asc API 对象注册到 Desktop 宿主；纯浏览器模式不需要此注册）
- 其余 50+ 方法 → 安全的 no-op stub（全量分析所有 SDK + web-apps 文件中的 `AscDesktopEditor.*` 调用，100% 覆盖）

**不影响保存路径**：SDK 内部保存走 Desktop 路径的条件是 `this.Aja === true`。使用 `asc_openDocumentFromBytes` 打开文档时 `Aja` 始终为 `undefined`，保存仍通过 `onSaveDocument` 服务器路径触发，不受 polyfill 影响。

详细分析见：

- [docs/explorations/2026-06-21-toolbar-asc-desktop-editor-polyfill.md](docs/explorations/2026-06-21-toolbar-asc-desktop-editor-polyfill.md)（工具栏崩溃 + $window 修复）
- [docs/explorations/2026-06-21-asc-desktop-editor-load-crash-stubs.md](docs/explorations/2026-06-21-asc-desktop-editor-load-crash-stubs.md)（execCommand / CreateEditorApi + 完整 stub 补全）

**Vite 中间件字体重写（两层机制，2026-06-20 完整修复）**：

`vite.config.ts` 包含两个字体相关插件：

1. **`onlyofficeWebModePatch`**：向编辑器 iframe HTML 的 `<head>` 注入内联 `<script>`，patch `window.XMLHttpRequest.prototype.open`，将 `ascdesktop://fonts/<name>` 重写为 `/fonts/<mapped>`（font-map.json 决定映射）。确认：Web Mode 9.3.0 中 `sdk-all-min.js` 确实通过 `ascdesktop://fonts/` XHR 加载**文档字体**（msyh.ttc 等），该 patch 正常拦截。

2. **`fontRemapMiddleware`**（2026-06-20 新增）：在 HTTP 层拦截所有 `GET /fonts/<file>` 请求，根据 font-map.json 直接返回映射后的文件内容。解决了 JS-level patch 无法覆盖的**系统字体直接 HTTP 请求**问题（见下方 CJK 乱码根因）。

**CJK 中文乱码根因（2026-06-20 确认并修复）**：本地 DOCX 中文显示为 Š/ä/š/ı/ê 等乱码，根因是 **split-brain 渲染**：

- HarfBuzz 塑形：使用文档字体（msyh.ttc → NotoSansSC，经 XHR patch 拦截）→ 返回 CJK GID（290=新，166=东）
- FreeType 渲染：使用 DejaVuSans（SDK 启动时通过**直接 HTTP GET `/fonts/DejaVuSans.ttf`** 加载，绕过 JS XHR patch）→ 相同 GID 在 DejaVuSans 里是 Latin 字符（290=Š，166=ä）

修复：`fontRemapMiddleware` 在服务端将 `/fonts/DejaVuSans.ttf` 等系统字体请求重定向到 `/fonts/NotoSansSC-Regular.ttf`，使塑形和渲染使用同一 GID 空间。`public/fonts/NotoSansSC-Regular.ttf`（10.1MB，indexToLocFormat=1 LONG loca）覆盖全部简体中文字符集，已在 `font-map.json` 中全面替换了旧的 `NotoSansSC-Subset-LongLoca.ttf`（176KB 子集，只覆盖 ~501 个字符，导致 Word 页脚/Excel 等文档中的 CJK 字符显示为不可见 tofu）。

详细分析见 [docs/explorations/2026-06-20-cjk-font-split-brain-fix.md](docs/explorations/2026-06-20-cjk-font-split-brain-fix.md)。

### store/index.ts — 全局状态

```ts
const [getDocmentObj, setDocmentObj] = createSignal<{
  fileName: string;
  file?: File;
  url?: string | URL;
}>({ fileName: '' });
```

---

## 测试体系

### 单元测试（Vitest + jsdom）

配置文件：`vitest.config.ts`

```
test/unit/
  vitest-smoke.test.ts        # 基础冒烟
  document-utils.test.ts      # src/lib/document-utils.ts
  i18n.test.ts                # src/lib/i18n.ts
  embed-api.test.ts           # src/lib/embed-api.ts（initEmbedApi、消息路由、来源过滤）
  onlyoffice-editor.test.ts   # src/lib/onlyoffice-editor.ts（只读模式、requestSaveDocument）
  seo-pages.test.ts           # pages/ 下 SEO landing pages 和 sitemap 校验
  sw-routing.test.ts          # Service Worker 路由规则
test/setup/vitest.ts          # 全局 mock：matchMedia、URL.createObjectURL、localStorage
```

**当前覆盖率（coverage include 范围内，2026-06-19 `pnpm run test:coverage`）：**

| 文件                 | 语句   | 分支   | 函数   | 行     |
| -------------------- | ------ | ------ | ------ | ------ |
| document-utils.ts    | 89.47% | 86.95% | 100%   | 89.47% |
| embed-api.ts         | 97.18% | 90.62% | 100%   | 97.18% |
| i18n.ts              | 90.56% | 65%    | 93.33% | 91.3%  |
| onlyoffice-editor.ts | 22.06% | 22.22% | 30.43% | 22.66% |
| **All files**        | 45.72% | 46.2%  | 57.14% | 46.13% |

覆盖率阈值（全局）：语句 35%、分支 25%、函数 35%、行 35%。

**注意事项：**

- `embed-api.ts` 有模块级 `initialized` 单例，测试需用 `vi.resetModules()` + 动态 `import()` 获取新实例
- 旧模块实例的 `window.message` 监听器在 `resetModules` 后仍残留，**不要用 `toHaveBeenCalledTimes` 断言次数**，改用 `toHaveBeenCalledWith` 匹配消息内容或用唯一 ID 定向检索
- `requestSaveDocument` 有内部超时状态，测试需配合 `vi.useFakeTimers()` + `vi.runAllTimers()` 清理
- 源码已迁到 `src/`、页面已迁到 `pages/`；新增或修改测试时不要再使用旧的 `../../lib/*`、`../../store` 或根目录 `index.html` 路径。

### E2E 测试（Playwright）

配置文件：`playwright.config.ts`，使用 Chromium，baseURL `http://127.0.0.1:4173`。

```
test/e2e/
  app-smoke.spec.ts   # 应用加载、PWA manifest 冒烟测试
  embed-api.spec.ts   # embed mode 与 postMessage API 冒烟测试
```

E2E 在 CI 中依赖 `lint` job 成功后才运行（`needs: lint`）。本地运行前需先 `pnpm run build`。

### 2026-06-19 CI 恢复记录

本轮修复目标：恢复目录迁移后断掉的基础质量门禁，**不改变 OnlyOffice Web Mode 运行逻辑**。

已修复：

- `vitest.config.ts` alias 和 coverage include 从旧目录 `lib/`、`store/` 改为 `src/lib/`、`src/store/`。
- 单测导入路径从 `../../lib/*`、`../../store` 改为 `../../src/lib/*`、`../../src/store`。
- `seo-pages.test.ts` 改为读取 `pages/index.html` 和 `pages/{slug}/index.html`，并匹配当前 sitemap 域名 `https://bybrowser.com/`。
- `src/lib/document-converter.ts` 中 OOXML ZIP 快路径不再直接返回 `Uint8Array<ArrayBufferLike>`，改为返回切片后的 `ArrayBuffer`，避免 TypeScript 6 对 `BlobPart` 的严格泛型约束报错。

已验证通过：

```bash
pnpm run lint:ts       # oxlint + tsc --noEmit
pnpm run test          # 7 files / 96 tests passed
pnpm run test:coverage # thresholds passed
pnpm run build         # build completed successfully
pnpm run test:e2e      # 10 tests passed
git diff --check
```

仍需注意：

- `pnpm run format:check` 仍会失败，但失败来自大量既有未格式化文件（`CLAUDE.md`、`pages/*.html`、`src/lib/empty_bin.ts`、`src/lib/ui.ts` 等），不是本轮改动引入。本轮只对触碰文件执行了 Prettier 检查并通过。
- 曾尝试增加一个专项 E2E 验证“New Word → `[OO] asc_openDocumentFromBytes`”，但当前 macOS 环境多次在 Chromium 启动阶段失败：`bootstrap_check_in ... MachPortRendezvousServer ... Permission denied (1100)`。该临时测试已删除，避免把环境不稳定性提交进仓库。
- 真实浏览器里的 Web Mode 连续刷新、Excel / PowerPoint、保存链路仍未完成验证；这些仍属于 OnlyOffice 9.3.0 升级主线的待办。

---

## CI 流程（.github/workflows/ci.yml）

两个 job，触发条件：push/PR 到 main/master。

**lint job（串行步骤）：**

1. `pnpm/action-setup@v6 version: latest` — 不锁定 pnpm 版本
2. `actions/setup-node@v6 node-version: lts/*` — 不锁定 Node 版本
3. `pnpm install --frozen-lockfile`
4. `pnpm run format:check`
5. `pnpm run lint:ts`
6. `pnpm run test:coverage`
7. `docker compose config --quiet`（验证 Docker Compose 文件）
8. `hadolint/hadolint-action@v3.3.0`（Dockerfile 检查）

**e2e job（需 lint 通过）：**

1. 同上安装步骤
2. `playwright install --with-deps chromium`
3. `pnpm run test:e2e`
4. 失败时上传 `playwright-report/` artifact

---

## 代码规范

- **Lint**：oxlint（规则见 `.oxlintrc.json`）+ TypeScript 6 严格模式
- **格式化**：prettier（配置见 `.prettierrc.json`）
- **TypeScript**：`strict: true`，`noImplicitAny: true`，目标 ESNext，模块解析 bundler
- `baseUrl` 已移除（TypeScript 6 废弃），路径别名使用 `paths` + `@/*` 前缀
- CSS 副作用导入需在 `types/assets.d.ts` 中有 `declare module '*.css' {}`

---

## 重要约定

1. **不锁定工具版本**：CI 中 pnpm 用 `latest`，Node 用 `lts/*`，保持自动跟随最新
2. **循环依赖处理**：`onlyoffice-editor.ts` 与 `converter.ts` 之间通过回调注入（`setConverterCallbacks`）解耦；`ui.ts` 与 `document.ts` 之间通过 `setUICallbacks` 解耦
3. **编辑器操作队列**：`createEditorInstance` 内部有 `editorOperationQueue`，防止并发创建/销毁编辑器
4. **.claude/ 目录**：已加入 `.gitignore`，不提交本地 Claude Code 配置

---

## OnlyOffice 运行架构与浏览器适配原理

### 为什么需要大量浏览器适配

OnlyOffice `web-apps` + `sdkjs` 的代码虽然开源，但设计上只支持两种宿主环境：

```
模式 1：Document Server（标准部署）
  浏览器 → iframe(web-apps/sdkjs) ↔ socket.io ↔ Document Server
  后端负责：License、文件存储、字体、x2t 转换、实时协作

模式 2：Desktop App（桌面版）
  Electron/CEF WebView → iframe(web-apps/sdkjs) ↔ window.AscDesktopEditor（C++）
  C++ 层负责：文件对话框、本地 I/O、字体目录、OS 集成
```

本项目是**第三种模式**——纯浏览器、零服务器——OnlyOffice 从未设计也未测试过这种运行方式。开源代码解决的是"可以看到"，解决不了"绕过架构假设"。每一个"坑"本质上都是：**原本由 C++ Desktop App 或 Document Server 承担的职责，现在需要用浏览器 API 替换实现**。

Fork 修改 SDK 代价极高（几十万行 minified 代码，每次升级需 rebase）。我们的 polyfill 方案是最小侵入：不动 OnlyOffice 代码，升级时只需替换 `public/` 目录。

### WASM 的作用与边界

项目中的 WASM 文件分两类，解决完全不同维度的问题：

**计算层 WASM**（从 C++ 编译，解决"浏览器 JS 太慢"）：

| 文件                                     | 作用                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `wasm/x2t/x2t.wasm`（34 MB）             | 文件格式转换：DOCX/XLSX/PPTX ↔ OnlyOffice 内部格式（DOCY/XLSY/PPSY）       |
| `sdkjs/common/libfont/engine/fonts.wasm` | HarfBuzz（文字塑形）+ FreeType（字体渲染）；CJK split-brain 乱码的根因在此 |
| `sdkjs/common/zlib/engine/zlib.wasm`     | ZIP 解压（OOXML 文件本质是 ZIP）                                           |
| `sdkjs/common/spell/spell/spell.wasm`    | 拼写检查                                                                   |
| `sdkjs/pdf/src/engine/drawingfile.wasm`  | PDF 渲染                                                                   |

**WASM 使零服务器"计算上可行"**：没有 x2t.wasm 就无法在纯浏览器里做格式转换。但我们打开 DOCX/XLSX/PPTX 时实际**绕过了 x2t**（用 `asc_openDocumentFromBytes` 直接喂 OOXML 字节），x2t 目前只在保存时使用。

**WASM 解决不了的问题**（我们需要适配的部分）：

| 需要做的事         | 原本由谁负责                                 | 我们的替代方案                               |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| 文件选择框         | `AscDesktopEditor.OpenFilenameDialog`（C++） | polyfill → `<input type="file">`             |
| 本地文件读取       | `AscDesktopEditor.LocalFileGetImageUrl`      | polyfill → `URL.createObjectURL`             |
| License 验证       | Document Server                              | `fakePerms`（`asc_getLicenseType: () => 3`） |
| 实时协作同步       | socket.io + Document Server                  | Vite 里的 Engine.IO noop server              |
| 字体 HTTP 请求     | Desktop App 的字体目录                       | `fontRemapMiddleware` + font-map.json        |
| 弹窗（断线提示等） | 正常弹出                                     | `suppressDialogsInFrame` + mock dialog       |
| PPTX 文件预处理    | Document Server（x2t 预处理）                | `preprocessPptx()`（修 ZIP/XML 问题）        |

**一句话总结**：WASM 让零服务器**计算上可行**，我们的 polyfill/patch 体系让它**运行时不崩溃**。两者解决完全不同维度的问题。

---

## 技术方向评估

### WebMCP (navigator.modelContext.registerTool)

**结论：技术可行，时机过早，暂缓实现。**

WebMCP 是 W3C Web Machine Learning Community Group 的提案，允许网页向浏览器 AI Agent 注册可调用的工具：

```javascript
navigator.modelContext.registerTool({
  name: 'open_document',
  description: '打开一个文档文件',
  inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
  execute: async ({ url }) => {
    /* ... */
  },
});
```

**与本项目的契合度**：现有 `embed-api.ts` 已通过 `postMessage` 实现了几乎相同的概念，两者可以直接映射：

| embed-api 消息          | 对应 WebMCP 工具         |
| ----------------------- | ------------------------ |
| `document:open-url`     | `open_document_from_url` |
| `document:open-buffer`  | `open_document_file`     |
| `document:save`         | `save_document`          |
| `document:set-readonly` | `set_readonly`           |
| `document:get-state`    | `get_document_state`     |

**暂缓原因**：

1. 仅 Chrome 146+（2026 年 2 月）支持且需手动开启 flag，普通用户覆盖率接近零
2. 跨域 iframe 默认禁用，需父页面加 `allow="tools"`，与 embed 场景冲突
3. Firefox / Safari 无明确支持时间表

**后续时机**：待 Chrome 稳定版默认开启、Firefox 表态后再实现。届时新建 `lib/web-mcp.ts`，复用 `embed-api.ts` 现有的处理逻辑即可，改动量很小。

### OnlyOffice Agent 协同编辑（WebLLM 离线 + pi agent 云端）

**结论：方向价值高，与项目定位高度契合，但有一个关键前提需要先验证，建议分阶段推进。**

详细实施计划见 [docs/superpowers/plans/2026-05-30-agent-collab-editor.md](docs/superpowers/plans/2026-05-30-agent-collab-editor.md)。

#### LLM 推理层：WebLLM vs 云端 API

|          | WebLLM（离线）                         | pi agent Direct Mode（云端） |
| -------- | -------------------------------------- | ---------------------------- |
| 隐私     | ✅ 完全本地，零数据外发                | ⚠️ 请求发往外部 Provider     |
| API Key  | ✅ 不需要                              | ❌ 需要用户提供              |
| 模型质量 | ⚠️ 1–3B 小模型                         | ✅ GPT-4 / Claude 级别       |
| 首次体验 | ⚠️ 下载 ~1.8 GB 模型                   | ✅ 即开即用                  |
| 硬件要求 | ⚠️ WebGPU（Chrome/Firefox/Safari 18+） | ✅ 无特殊要求                |
| 推理速度 | ~40–70 tokens/s（独显）                | 取决于 Provider              |

**推荐策略**：检测到 WebGPU 时默认推荐离线模式（Phi-3.5-mini 或 Llama-3.2-3B），否则降级到云端模式；用户可在设置中自由切换。两种模式共享同一套工具定义接口，切换对 Agent 层透明。

#### 方案内容

将 OnlyOffice JS Plugin API 封装为 Agent 可调用的工具集，在编辑器内嵌 Agent 插件面板，结合 OnlyOffice 的评论与修订模式，实现"人 + Agent 协同编辑"体验。LLM 调用通过 pi agent 的浏览器 Direct Mode 直接从浏览器发出，无需中间服务器，与本项目"纯本地、无服务器"的定位一致。

#### OnlyOffice Plugin API 能力确认

OnlyOffice 的 Plugin API 已足够支撑这个方案：

| 能力          | API                | 说明                                  |
| ------------- | ------------------ | ------------------------------------- |
| 插入/替换文本 | `PasteHtml()`      | 在光标处注入 HTML 格式内容            |
| 添加评论      | `AddComment()`     | 带作者、时间戳、内容                  |
| 读取评论      | `GetAllComments()` | 获取全文评论列表                      |
| 修订模式      | Review API         | 所有改动带用户标记，人工逐条接受/拒绝 |
| 获取选中内容  | Selection API      | 读取当前选区文本                      |

官方已有 ChatGPT 插件（v1.1.4+）实现了同样的模式，验证了技术路径可行。

#### pi agent 在浏览器端的定位

pi agent（earendil-works/pi）是一套轻量的多 Provider LLM 调用框架，**不是本地推理引擎**，"浏览器端移植"指的是：

- `@earendil-works/pi-web-ui` 的 **Direct Mode**：Agent 编排逻辑在浏览器 JS 中运行，LLM 请求直接从浏览器发往 Anthropic / OpenAI / Gemini 等 API
- API Key 存储在 localStorage，不经过中间服务器
- **不涉及 WASM 模型量化**，"剪枝"指裁剪掉 Node.js 专属依赖，保留纯浏览器可运行的部分

#### 关键前提：需先验证

本项目使用的是 **OnlyOffice Web Apps（离线 WASM 版）**，而非 OnlyOffice Docs Server。两者在插件 API 支持上存在差异——需要实际验证 `window.Asc.plugin` 对象在当前本地加载方式下是否可用，以及 `AddComment`、Review 模式等 API 是否完整暴露。

#### 建议实施路径（分三阶段）

**阶段一：验证 Plugin API 可用性**（1~2 天）

- 在 `public/` 下新建一个最小插件，验证 `window.Asc.plugin.init` / `callCommand` / `PasteHtml` 是否在当前离线版本中可用
- 若不可用，需评估是否升级到 OnlyOffice Docs Server

**阶段二：Agent 工具层**（新建 `lib/agent-plugin.ts`）

- 将 Plugin API 封装为结构化工具：`insert_text`、`add_comment`、`get_selection`、`set_review_mode`
- 接入 pi agent Direct Mode，支持用户自带 API Key（存 localStorage）
- Provider 支持：Anthropic Claude、OpenAI、Gemini、Ollama（本地模型）

**阶段三：UI 面板与协同流程**

- 在 `lib/ui.ts` 中增加 Agent 侧边栏（复用现有 UI 组件模式）
- 协同流程：Agent 以"修订模式"写入 → 侧边栏展示操作摘要 → 人工在编辑器内逐条接受/拒绝

#### 与现有架构的关系

| 现有模块               | 复用方式                                            |
| ---------------------- | --------------------------------------------------- |
| `embed-api.ts`         | 外部页面仍可通过 postMessage 触发 Agent 操作        |
| `onlyoffice-editor.ts` | `requestSaveDocument` 可在 Agent 完成编辑后直接调用 |
| `lib/ui.ts`            | 复用现有控制面板的显示/隐藏模式添加 Agent 面板      |
| `store/index.ts`       | Agent 执行状态可通过同一 signal 机制管理            |

### OnlyOffice Web Apps 版本升级（9.3.0 → 9.4.0）

**结论：建议升级，与 Agent 协同计划捆绑进行，主要成本在于获取静态文件而非代码改动。**

#### 当前状态

- **当前版本**：`9.3.0 (build:140)`，文件位于 `public/sdkjs/`、`public/wasm/`、`public/web-apps/`
- **最新版本**：`9.4.0`（2026-05-20 发布），跨越 1 个小版本

#### 升级带来的主要收益

| 版本 | 关键改进                                                              |
| ---- | --------------------------------------------------------------------- |
| v8.0 | `CreateTable(rows, cols)` API 重构，性能大幅提升                      |
| v9.2 | **Plugin API 大幅扩展**（新增 Form / CheckBox API），插件调试文档完善 |
| v9.3 | 多页视图、REGEX 函数族（spreadsheet）、图片/形状超链接、PDF API       |
| v9.4 | 25 个演示主题、20 种幻灯片切换动画、表格深色模式、单进程架构简化      |

**对 Agent 协同计划尤为重要**：v9.2 的 Plugin API 扩展是 Agent 工具层的基础，在旧版本上构建 Agent 集成可能遇到 API 不完整的问题。建议**先升级，再做 Agent 开发**。

#### 升级成本

**1. 获取静态文件（最大障碍，预估 1 天）**

OnlyOffice 没有为"仅静态文件"提供官方分发渠道，可行路径：

```bash
# 最可靠：从官方 Docker 镜像提取
docker run -d --name oo onlyoffice/documentserver:9.4.0
docker cp oo:/var/www/onlyoffice/documentserver/web-apps ./public/web-apps
docker cp oo:/var/www/onlyoffice/documentserver/sdkjs   ./public/sdkjs
docker rm -f oo

# x2t WASM 需单独处理（社区维护）
# 参考：https://github.com/cryptpad/onlyoffice-x2t-wasm
```

**2. 代码层的 Breaking Changes（预估 0.5 天）**

需检查的改动点：

| 改动                                       | 版本   | 影响                                              |
| ------------------------------------------ | ------ | ------------------------------------------------- |
| `CreateTable(rows, cols)` 参数顺序变更     | v8.0   | 搜索项目中对 `CreateTable` 的调用                 |
| `customization.commentAuthorOnly` 参数移除 | v8.x   | 检查 `onlyoffice-editor.ts` 中的 config           |
| `installDeveloperPlugin` shim 移除         | v9.3.1 | 若有插件加载逻辑需更新                            |
| `DocEditor.sendCommand` → `serviceCommand` | v9.x   | ✅ 已修复：通过 `editorSendCommand()` helper 兼容 |

**3. 功能回归测试（预估 1 天）**

- docx / xlsx / pptx / csv 打开与保存
- 格式转换（x2t WASM）
- 只读模式切换
- 现有 E2E smoke test 重跑

**4. 包体积变化**

新版本预计比当前（121 MB）更大，需评估对 GitHub Pages 首屏加载的影响。可配合 Service Worker 预缓存策略缓解。

#### 与 Agent 计划的关系

```
建议顺序：
  升级 OnlyOffice 9.4.0
    ↓
  阶段零：验证新版 Plugin API 可用性
    ↓
  Agent 工具层开发（基于完整的 v9.2+ Plugin API）
```

若先做 Agent 开发、后升级 OnlyOffice，可能需要在旧 API 基础上写兼容代码，升级时再改一遍，事倍功半。

---

## 测试覆盖说明

### 当前覆盖率（coverage include 范围内，2026-06-19）

| 文件                   | 语句   | 分支   | 函数   | 备注                       |
| ---------------------- | ------ | ------ | ------ | -------------------------- |
| `embed-api.ts`         | 97.18% | 90.62% | 100%   | 接近完整覆盖               |
| `document-utils.ts`    | 89.47% | 86.95% | 100%   | 接近完整覆盖               |
| `i18n.ts`              | 90.56% | 65%    | 93.33% | 未覆盖部分语言的特定翻译键 |
| `onlyoffice-editor.ts` | 22.06% | 22.22% | 30.43% | 见下方说明                 |

### 为什么 onlyoffice-editor.ts 覆盖率低

这是预期行为，**不需要强行提升**。该文件 542 行中约 400 行是 OnlyOffice 编辑器的事件回调，必须有真实编辑器运行才能触发：

| 函数                             | 无法单测的原因                                                        |
| -------------------------------- | --------------------------------------------------------------------- |
| `createEditorInstance` (~120 行) | 依赖 `window.DocsAPI`，该对象由外部脚本动态注入，jsdom 不执行外部脚本 |
| `handleSaveDocument` (~55 行)    | 由编辑器 `onSave` 事件触发，需真实编辑器实例                          |
| `handleWriteFile` (~75 行)       | 由编辑器 `writeFile` 事件触发（粘贴图片时）                           |
| `handleDownloadAs` (~35 行)      | 由编辑器 `onDownloadAs` 事件触发                                      |
| `queueEditorOperation` (~40 行)  | `createEditorInstance` 内部队列，连带未覆盖                           |
| `loadEditorApi` (~20 行)         | 动态创建 `<script>` 标签加载外部 JS，jsdom 不执行                     |

这些函数理论上可以通过 E2E 覆盖，但需要 OnlyOffice WebAssembly 完整加载并打开真实文档（耗时 10–30 秒，稳定性差）。强行用单测 mock 覆盖反而会让测试代码比被测代码更复杂，没有实际价值。

**已覆盖的可测部分**（纯函数 + 状态管理）：

- `getSavedFileMimeType` / `getNormalizedFile` / `toUint8Array` — 纯计算逻辑
- `setReadonlyMode` / `getReadonlyMode` — 状态读写
- `requestSaveDocument` — 所有拒绝路径（无编辑器、只读、并发、超时、不支持 downloadAs）
