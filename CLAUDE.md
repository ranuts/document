# CLAUDE.md — document 项目指南

## 项目概述

基于 OnlyOffice 的本地 Web 文档编辑器，所有处理在浏览器端完成，无需服务器，保护用户隐私。支持 docx、xlsx、pptx、csv、pdf 等格式。

- **线上地址**：https://edit.chaxus.com/ （旧址 https://ranuts.github.io/document/ 已跳转至此）
- **GitHub**：https://github.com/ranuts/document
- **技术栈**：TypeScript + Vite + ranui 设计体系（`--ran-*` token + `r-*` 组件，无 CSS 框架）+ OnlyOffice Web Apps

---

## 提交流程（2026-08-16 起：PR 制，main 受保护）

`main` 分支保护已开（含管理员）：**不能直推**，必须 PR，且必须通过 6 个必需检查——
`Lint and Validate` / `E2E` / `E2E (Cloudflare Pages semantics)` / `E2E (Docker image)` /
`Preview smoke against Cloudflare Pages`（`.github/workflows/preview-smoke.yml`：等 CF Pages
为该 PR 提交构建好 preview，再对 preview URL 跑冒烟集）/ `Cloudflare Pages`；线性历史，
自动合并与合并后删分支已开。常规操作：

```bash
git switch -c <topic>            # 多会话共用工作树时一律在分支上提交
git push -u origin <topic>
gh pr create --fill
gh pr merge --auto --rebase      # 检查全绿后自动 rebase 合并（约 15 分钟）
```

若不小心提交到了本地 main：`git branch <topic> && git reset --hard origin/main` 再照上走。

**多会话并行**：不要共用同一个 checkout（HEAD/index/dist/test-results 都会互相干扰）。
第二个及以后的会话用独立 worktree：`git worktree add .claude/worktrees/<name> -b <topic>`
（`.claude/` 已在 .gitignore），各自 `pnpm install`、各占一个 `E2E_PORT`；PR 流程不变。

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
pnpm run test:e2e                # E2E 测试（Playwright，自动 build+preview）——不含 @serial
pnpm run test:e2e:serial         # 时序预算用例（@serial），单 worker 独占跑；本地要跑全须两条都跑
pnpm run test:e2e:docker         # 同套 E2E 跑在生产 Docker 镜像上（bin/test-e2e-docker.sh）
CORPUS_DIR=<本地语料目录> pnpm run test:e2e:corpus   # 真实文档回归矩阵（本地/夜间，语料不入库）
pnpm run lint                    # lint:ts + lint:docker
```

---

## 目录结构

```
lib/                  # 应用层（纯 TypeScript，只在本站点用）
  converter.ts          # 加载 OnlyOffice API / x2t 转换器
  document.ts           # 文件打开、新建、URL 加载
  embed-api.ts          # iframe 嵌入 API（postMessage 协议）
  events.ts             # MessageCodec 事件处理（桌面端集成）
  file-types.ts         # OnlyOffice 文件类型常量映射
  loading.ts            # 加载状态 UI
  onlyoffice-editor.ts  # 编辑器生命周期门面：挂载/重建/loadEditorApi，并对外统一导出下面这些模块
  onlyoffice/           # 编辑器周边（2026-08-19 从 1975 行的单文件拆出，公开导出面不变）
    iframe-guards.ts      # 10 条运行时守卫的编排；每条守卫一个文件在 guards/
    guards/               # chrome / shared-worker / fetch-fonts / image-pipeline /
                          # serverless-save / long-action / series-settings /
                          # font-loading / comment-selection / canvas-loss /
                          # wasm-binary-release / unload-prompt
    open-state.ts         # 就绪、打开失败、frame 首个错误（三处共用的单一状态源）
    open-failure.ts       # 失败分类、-82 guard、环境类失败重开一次（经 setOpenRunner 注入避免环）
    font-system.ts        # 字体系统就绪判定 + awaitFontSystem（#144）
    wasm-memory.ts        # x2t 声明的内存（283 MB initial / 2048 MB maximum，由 vendor-contract 解析二进制钉住）+ 分配失败识别 + 两段探测（#144）
    save-stream.ts        # 保存通道：请求生命周期、asc_DownloadAs 触发、file-stream 回收、CSV 往返
    viewport.ts           # 紧凑视口判定与布局同步（#145）
    sdk-api.ts            # 同源 iframe 里的 Asc.editor 访问、restriction 常量
    readonly.ts           # 运行时只读（挂载永远可编辑，加载后加 restriction）
    ui-theme.ts           # 默认经典主题与站点主题跟随
    file-helpers.ts       # 文件名/MIME/字节形状小工具
  ui.ts                 # 落地 hero 显隐 + 控制面板（右下角 Menu FAB 已于 2026-08-20 移除）
  analytics.ts          # Cloudflare Web Analytics（刻意不用 GA；线上实际走 CF 面板边缘注入，因此 embed 视图会被计入、/embed-demo 双计，读数规则见 docs/explorations/2026-08-17-analytics-edge-injection-double-count.md）
  pending-open.ts       # 静态落地页经 IndexedDB 交接文件（?open=local）
  unsaved-guard.ts      # 未保存提示（beforeunload）+ 全局脏位，编辑器 onDocumentStateChange 驱动
  embed-mode.ts         # isEmbedMode() 单一实现（save-stream / unsaved-guard / history 共用）
  save-target.ts        # 文档在磁盘上的那个文件：记住 File System Access 句柄，之后的保存直接写回
  history/              # 本地历史（自动保存恢复点），2026-08-22
    db.ts                 # IndexedDB schema：docs（元数据）+ blobs（字节）两个 store
    store.ts              # CRUD、内存分页与标题子串搜索、每篇 3 rev、七天过期、配额降级
    autosave.ts           # 节拍器：脏位 + 空闲 + 间隔三重条件，visibilitychange 补一刀，Web Locks 互斥
    session.ts            # 会话身份：mint docId 并写进 ?saved=<id>
    recovery.ts           # 启动恢复条（Office Document Recovery 模型）
    types.ts / index.ts   # 记录形状与保留期工具 / 对外装配（含 savedToDisk 回调注入）
  history-page.ts       # /history 页面（第三个 vite entry，见 history.html）
  sw-update.ts          # SW 更新策略的编辑器一侧（有文档打开时不提升 worker）；落地页一侧在 public/sw-register.js
  agent-plugin/         # Agent 协同编辑：editor-bridge（直调 window.editor）、tools、ui/
packages/             # pnpm workspace，供 ran 生态三处站点共享（包名 @ranuts/*）
  shared/               # document-types / document-utils / i18n（en + zh-CN 词条；编辑器 UI 语言另由 vendor 45 语言包提供）/ store（createSignal）
  converter/            # 格式转换：CSV↔XLSX（SheetJS）、docx-zip 媒体处理、签名嗅探、PDF 字体清单
  agent-core/           # LLM 运行时 + 多 Provider（anthropic/openai/gemini/ollama/webllm）+ key 存储
  chat-ui/              # 聊天面板 UI
types/
  editor.d.ts           # OnlyOffice DocEditor 类型声明
  assets.d.ts           # CSS 模块类型声明（declare module '*.css'）
styles/
  base.css              # 全局样式（含 embed-mode 布局）
public/               # v9 vendor（sdkjs / web-apps / x2t.wasm.gz / XOR 字体目录）+ 落地页、demo、SW
bin/                  # build.sh、test-e2e-docker.sh、font-catalog.mjs、bundle_single_html.js、build-pages.mjs（markdown→/help /changelog；由 vite 插件 `generated-pages` 在 build/dev 时渲染进 public/，产物不入库）、sitemap-lastmod.mjs（改完落地页/内容后跑一次，按 git 提交日期刷新 sitemap 的 lastmod，`--check` 可校验）、x2t-memory-report.mjs（只读：打印 x2t 向浏览器要多少内存，以及静态/BSS 下界——vendor 升级后跑一次，判断 `initial` 是否仍然动不了）
content/              # 生成页面的 markdown 源（content/<locale>/*.md，frontmatter title/description）
docs/                 # embed-api / fonts 文档、explorations/（每次改动的记录）、superpowers/plans/
index.ts              # 编辑器入口（初始化事件、UI、PWA），挂在 editor.html
index.html            # `/`：静态落地页（无编辑器 bundle；CTA 跳 /editor，旧深链内联脚本重定向）
editor.html           # `/editor`：编辑器页面（?new= ?file= ?src= ?embed=1 ?open=local ?saved=<id>）
history.html          # `/history`：本地历史页（noindex，只读 IndexedDB 元数据，不加载编辑器）
```

---

## 核心模块说明

### embed-api.ts — iframe 嵌入 API

允许父页面通过 `postMessage` 控制编辑器。触发条件：

- URL 含 `?embed=`、`?embed=1`、`?embed=true`、`?embedded=1` 等参数（编辑器路由是 `/editor`；`/` 是静态落地页，遇到这些参数或被 iframe 嵌入时带参跳到 `/editor`）
- 或页面被嵌入 iframe（`window.parent !== window`）

支持的消息类型：

| 消息类型                                                                              | 说明                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `document:open` / `document:open-url` / `document:open-file` / `document:open-buffer` | 打开文档（支持 url / File / Blob / ArrayBuffer / Uint8Array） |
| `document:set-readonly`                                                               | 切换只读模式                                                  |
| `document:save`                                                                       | 触发保存，父页面收到带 File 的 `document:saved` 响应          |
| `document:get-state`                                                                  | 查询当前状态（readonly、hasDocument）                         |

使用 `?embedOrigin=https://example.com` 可限制消息来源。

### onlyoffice-editor.ts — 编辑器生命周期（门面）

- `createEditorInstance(config)` — 创建/重建编辑器，内部有操作队列防并发
- `setReadonlyMode(bool)` / `getReadonlyMode()` — 只读模式（实现在 `onlyoffice/readonly.ts`）
- `requestSaveDocument(targetExt, options)` — 触发编辑器保存并返回 File，180s 超时（慢链路首存要先下 10 MB wasm；打开失败会立即拒绝；实现在 `onlyoffice/save-stream.ts`）
- `setConverterCallbacks(...)` — 注入转换器（解耦循环依赖）

**改这一块前先看清归属**：本文件只剩挂载/重建/加载 API 三件事，其余按上面的目录
各有其主；跨模块状态一律只有一个持有者（就绪与打开失败在 `open-state.ts`，只读在
`readonly.ts`，保存请求在 `save-stream.ts`），要读就调它导出的访问器，别再复制一份。
新增厂商运行时补丁 = 在 `onlyoffice/guards/` 新建一个文件并在 `iframe-guards.ts`
里挂上，别往门面里塞。

### packages/shared/src/store.ts — 全局状态

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
  document-utils.test.ts      # packages/shared 工具函数
  i18n.test.ts                # 国际化
  embed-api.test.ts           # embed postMessage API（initEmbedApi、消息路由、来源过滤）
  onlyoffice-editor.test.ts   # 编辑器生命周期（只读模式、requestSaveDocument、编辑器配置）
  document-converter.test.ts  # packages/converter（CSV、签名嗅探、zip 直通、错误码提示）
  docx-zip.test.ts            # OOXML zip 媒体提取/预处理
  sw-routing.test.ts          # sw.js 缓存策略路由（内含 DEPLOY_COUPLED 手抄副本；已有一条用例把副本与 sw.js 里的字面量钉在一起，漏改会红）
  sw-register.test.ts         # 落地页 SW 更新策略（直接 eval public/sw-register.js，不抄副本）
  agent-runtime / agent-tools / agent-editor-bridge / agent-ui-*   # agent 运行时、工具、编辑器桥、UI 状态
  agent-llm-{anthropic,openai,openai-format,gemini,ollama,webllm,keys}   # 各 LLM provider 适配
test/setup/vitest.ts          # 全局 mock：matchMedia、URL.createObjectURL、localStorage
```

覆盖率阈值（全局）：语句 34%、分支 25%、函数 35%、行 35%（当前实际约
45%/49%/49%，具体以 `pnpm run test:coverage` 输出为准，不要在本文件里维护
逐文件数字——它们过期得很快）。

**注意事项：**

- `embed-api.ts` 有模块级 `initialized` 单例，测试需用 `vi.resetModules()` + 动态 `import()` 获取新实例
- 旧模块实例的 `window.message` 监听器在 `resetModules` 后仍残留，**不要用 `toHaveBeenCalledTimes` 断言次数**，改用 `toHaveBeenCalledWith` 匹配消息内容或用唯一 ID 定向检索
- `requestSaveDocument` 有内部超时状态，测试需配合 `vi.useFakeTimers()` + `vi.runAllTimers()` 清理

### E2E 测试（Playwright）

单一配置 `playwright.config.ts`（端口 4173，webServer 自动 build + preview，
不需要手动先 build；`E2E_PORT=<port>` 另起一套并隔离 `dist-e2e-<port>/` 与
`test-results-<port>/`，`E2E_BASE_URL=<站点>` 则不起本地服务、直接打线上）。
`test/e2e/` 现有 36 个 spec，下面先说三条主线，再给全量清单：

- `app-smoke.spec.ts` — 应用加载、PWA manifest 冒烟
- `embed-api.spec.ts` — embed postMessage 协议
- `embed-regression.spec.ts` — **真实编辑器回归**：通过 embed-demo.html 驱动
  真实编辑器 + 真实 x2t，用 SheetJS 在页面内生成/解析工作簿（仓库里不放二进制
  fixture），覆盖 v9 迁移期修过的每一类 bug：

- 多 sheet 工作簿 open-buffer 打开 + 保存往返数据完整（#113、#31）
- xlsx → PDF 导出（canvas 渲染管线，#28 / 错误码 80 的场景）
- CSV 打开 + 存回 CSV 内容一致（#13、#33）
- 只读打开：状态正确且保存被拒（#25、#87）
- 运行时只读切换：restriction 真实生效（iframe 内 `restrictions` 属性）、
  锁定期保存被拒、解锁后保存往返完整
- docx open-buffer 打开 + 存回 docx（页内零依赖手拼最小 OOXML zip，#113 直接钉死）
- PDF 打开：真实挂载 pdfeditor（断言 iframe URL 路由），页内手拼合法最小 PDF
- URL 插图后保存：产物 zip 含 media 条目且字节完整（守护 serverless image
  pipeline；此前该场景主线程永久卡死）

- `corpus.spec.ts` — **真实文档回归矩阵**（roadmap 方向零）：
  `CORPUS_DIR=<本地语料目录> pnpm run test:e2e:corpus`，可选
  `CORPUS_FILTER=<包含正则>` / `CORPUS_EXCLUDE=<排除正则>` /
  `CORPUS_LIMIT=<上限，截断会打印>` / `CORPUS_VISUAL=1`（L3：原始 vs 存回再
  打开的渲染逐像素比对）；每条用例结束即追加一行到
  `test-results/corpus-rows-<worker>.jsonl`，`node bin/corpus-report.mjs [dir]`
  合并出 JSON + markdown 表（含 L2 内容、L3 视觉、open/save p50/p95）；**夜间 CI** `.github/workflows/nightly-corpus.yml`
  拉 Apache POI test-data 公开语料跑同一套（红=信号非门禁，可
  workflow_dispatch 指定 limit/filter）；对目录下每个 docx/doc/xlsx/xls/pptx/ppt/csv 走
  打开 → 监听致命弹窗/asc_onError → 编辑 → 保存 → 产物 sanity，输出汇总
  报告。语料留在测试机上不入库；未设 `CORPUS_DIR` 整套 skip，CI 保持绿。
  第一天就抓出 P0（非 ASCII 文件名导致 -82 打开失败 + 永久转圈），见
  docs/explorations/2026-08-15-corpus-campaign-day1-chinese-filename-bug.md。

**全量 spec 清单**（PR 档默认全跑；标 _opt-in_ 的靠环境变量开、进夜间）：

| 面向              | spec                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 站点 / 入口       | `app-smoke`、`main-site`（hero 打开 + Ctrl+S 下载）、`entry-paths`（`?file=` / `document:open-url` / `?open=local`）、`sw-warm`（SW 已控制页面）、`font-cache`（第二次打开字体全走缓存）                                                                                                                                                                 |
| embed 协议        | `embed-api`、`embed-regression`（真实编辑器主回归）、`embed-save-default`（裸 save 用文档自身格式）                                                                                                                                                                                                                                                      |
| 格式与内容        | `filename-matrix`、`format-parity`（docx/pptx 导出 PDF + 只读 + 运行时切换）、`resave-idempotence`、`xlsx-features`（合并/公式/2 万行）、`xlsx-panes`（冻结窗格/筛选）、`docx-features`（修订/页眉页脚）、`docx-ruby`（注音底文）、`comments`、`image-insert`、`csv-encoding`（GBK）、`html-as-xls`、`pdf-route`、`pdf-roundtrip`（打开/注释/存回/只读） |
| 失败与守卫        | `open-failure`（-82 可见 + 保存快速拒绝，兼作 L0 自检）、`comment-bulk-actions`（守卫 8）、`wasm-memory`（守卫 10：40 MB x2t 二进制用完即还）                                                                                                                                                                                                            |
| 视觉 / 性能       | `visual-roundtrip`（无基线：原始 vs 存回再打开逐像素）、`slow-network` _opt-in_ `SLOW_NET=1`                                                                                                                                                                                                                                                             |
| 交互面（策略 §9） | `api-surface` _opt-in_ `API_SWEEP=1`、`shortcut-surface` _opt-in_ `SHORTCUT_SWEEP=1`、`ui-crawl` _opt-in_ `UI_CRAWL=1`（逐页签点遍工具栏按钮，归因到按钮）、`monkey` _opt-in_ `MONKEY=1`（定种子随机序列，可精确回放）                                                                                                                                   |
| 字体              | `font-substitution`（被替换的名字与背后的开源 family 指着同一位置，两次渲染逐像素相同）、`pdf-cjk-export`（纯中文文档导出 PDF 后墨迹不得消失——CFF 字体会让它变空白）                                                                                                                                                                                     |
| 本地历史          | `history-page`（分页/中文子串搜索/删除/清空/七天过期/首页披露）、`autosave-recovery`（真实编辑器：编辑→隐藏页面→快照→恢复条→存回；`?saved=` 刷新回同一篇；embed 不写历史）                                                                                                                                                                               |
| 真实语料          | `corpus` _opt-in_ `CORPUS_DIR=…`（见上）                                                                                                                                                                                                                                                                                                                 |

另有三套独立配置：`playwright.pages.config.ts`（`bin/build.sh` + `wrangler pages dev`，
复现 CF Pages 托管语义，CI job `e2e-pages`）、`playwright.browsers.config.ts`
（WebKit + Firefox，夜间）、`playwright.prod.config.ts`（打线上/preview，
`prod-smoke.yml` 与 PR 门禁 `preview-smoke.yml` 用）。

**L0 全局 fixture（`test/e2e/lib/l0.ts`，2026-08-15 起所有 spec 从它
导入 `test`/`expect`）**：自动把 `asc_onError`、厂商致命弹窗、编辑器 iframe
内的 `unhandledrejection`/`error`、pageerror、非白名单 console.error 判为
失败；预期错误须显式 `l0.expectAscError(id)` / `l0.allowFrameError(re)` /
`l0.allowConsole(re)`。`open-failure.spec.ts` 兼作 fixture 自检。
**E2E 跑道三坑（语料战役第 1～2 天全踩过，每个都把"成功"伪装成"超时"）**：

1. 投递字节禁止用 `page.route`——页面被 Service Worker 控制后 route 不
   生效、请求真打到 preview 拿回 SPA index.html；走 `setInputFiles` +
   `document:open-file` 或 `page.evaluate` 传入。2) 直接调 `asc_DownloadAs`
   前必须同时等 `isDocumentLoadComplete && isLoadFullApi`，否则 SDK 静默丢弃。
2. 在 `page.evaluate` 里给别的 frame 挂 `message` 监听时别用
   `instanceof ArrayBuffer`（跨 realm 恒 false）——在本窗口监听、用
   `Object.prototype.toString` 判型。任何"全灭"结果先怀疑跑道。

**这套用例的调试教训（2026-08-13）**：它在首次落地时就抓出两个只在
"全新浏览器 profile 首次访问" 下复现的生产级 bug（SharedWorker 拼写引擎挂起、
fetchFonts 字体竞态，修复见 `lib/onlyoffice-editor.ts` 的 `prepareEditorIframe`）。
本地调试时注意 **杀干净 4173 上的残留 preview 服务器**——Playwright 的
`reuseExistingServer` 会复用旧构建，让你调试一个根本没包含新代码的产物。
多个会话同机并行跑 E2E 时用 `E2E_PORT=4174 pnpm run test:e2e` 各占一个
端口——非默认端口会**同时隔离** `dist-e2e-<port>/` 与 `test-results-<port>/`
（Playwright 起跑会清空 outputDir、vite build 会重写 dist，两会话共用时互相
抹掉对方的产物与结果，表现为假的 `-24 LoadingScriptError` /
`ERR_CONNECTION_REFUSED` / 页面 60s 起不来 / 报告少行）。

**托管语义回归**（CI job `e2e-pages`，配置 `playwright.pages.config.ts`）：
`bin/build.sh` 真部署构建 + `wrangler pages dev` 服务 dist——复现 Cloudflare Pages
的 `index.html`→目录 308、`_headers`、`_redirects`。"本地 vite preview 全绿、
线上坏"的三条缺陷（PDF 被 308 卡在 vendor 加载器、字体目录无缓存头、慢链路
超时）都属于这一层；`test/unit/hosting-contract.test.ts` 钉住 `_headers` 关键
规则；`test/unit/landing-pages.test.ts` 钉住全部 SEO 落地页（public/**/*.html +
index.html）的 canonical/hreflang/JSON-LD/sitemap/双语互指契约——新增落地页必须
同时补 en+zh、sitemap、llms.txt、首页卡片，否则该测试先红。**线上冒烟** `.github/workflows/prod-smoke.yml`：每次 push main 等部署
上线后即跑 + 每日；`E2E_BASE_URL=<站点>` 可把任意 spec 打到部署站。CF 面板里
的 Cache Rules 等不在仓库、CI 复现不了，只能靠冒烟兜底。

**Docker 镜像回归**（`pnpm run test:e2e:docker`，配置
`playwright.docker.config.ts`）：构建生产镜像后把同一套 test/e2e 全部 spec
跑在容器（static-web-server）上，证明镜像端到端可用——正是这条链路抓出了
"Dockerfile 缺 workspace manifest、安装必挂"的问题（CI 原本只查 compose
config 和 hadolint，从不真正 build）。容器由 `bin/test-e2e-docker.sh` 前后
强制清理，绝不复用（残留容器会静默服务陈旧镜像）。镜像的缓存契约在根目录
`sws.toml`（static-web-server 不读 `_headers`，默认按扩展名给 HTML 1 天、
`.js/.css` 1 年且都不校验——自托管用户重拉镜像后浏览器仍跑旧 bundle，
issue #144 第二轮就栽在这里）；改 `_headers` 时必须同步改它，
`test/unit/hosting-contract.test.ts` + `test/e2e/docker-cache-headers.spec.ts`
（`E2E_DOCKER=1`）钉死两边。

E2E 在 CI 中依赖 `lint` job 成功后才运行（`needs: lint`）。

---

## CI 流程（.github/workflows/ci.yml）

触发条件：push/PR 到 main/master。**所有 job 一起起跑，e2e 不等 lint**——lint
只有 1 min，但等它整个 job 结束会在每个 PR 的关键路径上白加 ~90s；仓库是公开
的，runner 免费，lint 红的那次多跑一轮 e2e 比多推一次 commit 划算。

三套 E2E 跑的是**同一批 ~95 个用例**，只是服务器不同（vite preview / 生产镜像 /
wrangler pages dev），这是整个 workflow 的全部成本（install + vite build +
docker build 加起来不到 2 min）。所以每套都用 matrix 切成 **3 个分片**，再由一个
汇总 job 顶着分支保护要求的检查名：

| 分片 job              | 汇总 job（= 必需检查名）                       | 分片耗时    | timeout |
| --------------------- | ---------------------------------------------- | ----------- | ------- |
| `lint`（不分片）      | `lint` → Lint and Validate                     | ~1 min      | 15 min  |
| `e2e-shard` ×3        | `e2e` → E2E                                    | 2.4~4 min   | 20 min  |
| `e2e-docker-shard` ×3 | `e2e-docker` → E2E (Docker image)              | 3.3~4.6 min | 25 min  |
| `e2e-pages-shard` ×5  | `e2e-pages` → E2E (Cloudflare Pages semantics) | ~4.5 min    | 30 min  |

pages 切 5 片而不是 3 片：它单 worker、最慢，是关键路径；但每片还要付 ~2 min
的 `build.sh` + wrangler 启动固定成本，再往上切收益就被这块吃掉了。

**分片而不是加 workers**：runner 只有 4 核、每个 worker 拖一个 WASM 编辑器进程，
而 pages 那套是**故意**单 worker 的（并发下 workerd 会被大文件 abort 打崩，见
`playwright.pages.config.ts`）。分片不动任何一套自己的并发语义。

**时序预算用例走第二趟**：打了 `@serial` 标签的用例（目前只有 open-retry 的
"font system costs a fraction of a second"）从分片的并行那趟里 `--grep-invert`
掉，再由同一个 job 用 `--workers=1` 独占跑一趟。原因是实测：四个 WASM 编辑器
抢四个核时，字体系统就绪要 3400 ms，而断言的边界是 2 s——挂的是机器负载，不是
被测代码。三个分片各跑一遍这趟（每个分片是独立 VM，所以确实独占；一条用例几秒，
且刻意不分片），保持分片彼此对称。Pages 与 Docker 两套是**托管语义**回归，
`--grep-invert @serial` 直接不测时序（在 wrangler / 容器里重测只增噪声）。
两半必须成对存在：少了 `--grep-invert` 预算就又去和三个编辑器抢核，少了第二趟
则**没有任何东西再测它、而且套件照样全绿**——`test/unit/workflow-contract.test.ts`
把这对钉在一起了。

**改分片数要同时改两处**：matrix 的 `shard: [...]` 与命令里 `--shard=N/M` 的 M。
对不上会静默少跑一批用例还报绿——`test/unit/workflow-contract.test.ts` 把两个
数字钉在一起了。

**docker 分片必须直接 `sh ./bin/test-e2e-docker.sh --shard=…`**，不能走
`pnpm run test:e2e:docker -- --shard=…`：pnpm 会把参数吃掉，三个分片各自跑完整
套件、全绿、分片等于没做（实测，见探索文档）。

**lint job（串行步骤）：** setup（见下）→ `format:check` → `lint:ts` →
`test:coverage` → `docker compose config --quiet` → hadolint。
**e2e 分片 job：** setup（含 chromium）→ 各自带 `--shard` 的测试命令 → 失败时
上传 `playwright-report*-<分片号>/` artifact。
**汇总 job：** `if: always()`，`needs.<分片 job>.result != success` 就退 1。

**共用 setup（`.github/actions/setup`）**：pnpm + Node `lts/*` + pnpm 缓存 +
`pnpm install --frozen-lockfile`，`browsers:` 入参非空时再装 Playwright 浏览器。
全部 8 个 workflow 共用它，别在 workflow 里重新内联这几步——
`test/unit/workflow-contract.test.ts` 会拦下来。

**为什么浏览器安装要包一层脚本**：`playwright install --with-deps` 会调
apt-get，而 hosted runner 上的 apt 有过**拉完 release 索引后彻底停住、一个字节
不动**的表现——2026-08-18 一天之内四次 CI 被 GitHub 的 6 小时 job 上限杀掉，
每次挂在不同的 job（三个 e2e job 跑的是同一步，谁中枪是随机的），每次都要人工
重跑。apt 自身没有总时长上限，所以 `.github/scripts/install-playwright.sh` 给
每次尝试套 `timeout` 并重试，重试前清掉被杀的 apt 留下的锁；浏览器二进制
按 Playwright 版本号进 `actions/cache`，命中时只跑 `install-deps`。

**缓存命中时直接不跑 apt**（2026-08-19 起）。读健康 run 的日志才看清 `install-deps`
到底在干什么：Chromium 要的库（libnss3 / libgbm1 / libasound2t64 / libcairo2 …）
**全部 already the newest version**，runner 镜像本来就带；它真正装的只有 **21.1 MB
字体**（fonts-wqy-zenhei / fonts-ipafont-gothic / fonts-unifont / fonts-freefont-ttf /
fonts-tlwg-loma-otf / xfonts-encodings）。而本项目的渲染不经过系统字体——编辑器用自带的
XOR 字体 catalog（`public/fonts/`）、PDF 走 `PDF_FONT_MANIFEST`、落地页用 vendored
Geist woff2；视觉用例比的是"同一浏览器里的原始 vs 存回"，缺字形也是两侧同样缺。

所以那是**每个 job 在全新 VM 上，为没人读的字体，向 Ubuntu 源发一次网络请求**。11 个
job 就是一轮 run 掷 11 次骰子，而骰子是歪的：runner 首选的 `azure.archive.ubuntu.com`
返回 `Ign:`，退回公网 archive 后整个停摆（`noble-security InRelease` 之后零字节）。
本周四个 job 因此被 6 小时上限杀掉，加固之后又有两次各烧 17 分钟。

现在缓存命中直接 `exit 0`（连 apt 配置都不写）；`PLAYWRIGHT_INSTALL_DEPS=true` 是逃生
出口，会把 apt 放回来但只试 1 次 120s、失败仅告警。**冷缓存路径不变**（3 × 300s、失败
判死）——那时候没有浏览器可跑，且它本来就要从 Playwright CDN 下载。

**并发**：PR 收到新 push 时旧 run 直接取消（`cancel-in-progress` 只对
`pull_request` 生效）；push 到 main 的 run 永不取消——那是部署和线上冒烟要判定
的提交。

**`e2e-pages` 的 wrangler 由 `bin/serve-pages-dev.sh` 起**：它固定
`--compatibility-date`（不传的话 wrangler 取**今天**，而随附的 workerd 只支持到
它自己的发布日——2026-08-19 当天所有分支连同 main 全线变红），并且重启循环会
放弃（活不过 10s 视为没起来，连续 3 次带真实错误退出，否则启动错误会被无限
重试成一句无用的 `Timed out waiting 300000ms from config.webServer`）。见
docs/explorations/2026-08-19-wrangler-compat-date-timebomb.md。

**约定**：新增 workflow / job 必须带 `timeout-minutes`，浏览器安装必须走共用
action，wrangler 必须经 `bin/serve-pages-dev.sh` 起，分片数与 `--shard` 分母必须
一致，三个汇总 job 的名字不能改。全部由 `test/unit/workflow-contract.test.ts`
钉死。详见 docs/explorations/2026-08-19-ci-workflow-hardening.md 与
docs/explorations/2026-08-19-ci-e2e-sharding.md。

---

## 代码规范

- **注释与代码内字符串一律英文**：主体语言是英文，包括行内注释、JSDoc、`it()` /
  `describe()` 测试标题、以及代码里拼出来的 UI 文案。标点也用 ASCII（`(` 而不是 `（`）。
  中文只允许出现在这几处：`packages/shared/src/i18n.ts` 的 zh-CN 词条、
  `public/zh-CN/**` 的中文落地页、语言切换器里的 `中文` 自称标签、双语 `public/404.html`
  的那一行，以及 `docs/**` 与本文件。共用页面（如 `public/embed-demo.html`，英文和中文落地页
  都链到它）必须用英文。复查见
  [docs/explorations/2026-07-25-english-first-comments.md](docs/explorations/2026-07-25-english-first-comments.md)。
- **Lint**：oxlint（规则见 `.oxlintrc.json`）+ TypeScript 6 严格模式
- **格式化**：prettier（配置见 `.prettierrc.json`）
- **TypeScript**：`strict: true`，`noImplicitAny: true`，目标 ESNext，模块解析 bundler
- `baseUrl` 已移除（TypeScript 6 废弃），路径别名使用 `paths` + `@/*` 前缀
- CSS 副作用导入需在 `types/assets.d.ts` 中有 `declare module '*.css' {}`
- **隐私红线（仓库是公开的，任何入库文件都受此约束）**：代码、文档、测试、
  脚本、commit 信息中一律不得出现——
  1. 本机绝对路径或家目录路径（`/Users/<用户名>/...`、`~/Desktop/...` 等），
     写文档需要举例时用 `<本地路径>` 占位或仓库相对路径；
  2. 机器用户名、个人邮箱、任何凭据；
  3. 第三方个人的姓名、网名、社交账号、个人仓库名——引用第三方来源用中性
     描述（如"第三方编译的离线包"），不点名到人；
     例外：`chaxus` / `ranuts` 作为项目所有者的公开 GitHub handle、组织名及其
     公开仓库（chaxus/ran 等）可以出现。发现存量泄露：清理正文并在
     docs/explorations/ 记录；git 历史中的残留默认不重写（除非泄露凭据）。

---

## ran 生态优先（ranui / ranuts / builder）

本项目属于 chaxus 的 `ran` 生态（edit.chaxus.com / @ranui/preview / ran.chaxus.com）。写 UI 或工具逻辑时，**优先复用生态自有能力，不要手写重复实现**：

- **组件优先用 ranui**：`r-button` / `r-card` / `r-icon`（含 `name="github"`）/ `r-link` / `r-input` / `r-modal` / `r-select` / `r-tab` 等，`import 'ranui/<name>'` 注册；已装版本的导出以 `node_modules/ranui/dist` 为准。跨 Shadow DOM 定制样式用 `::part`（见 `styles/base.css` 里的 `r-button::part(...)`）。
- **DOM 构造优先用 ranui builder**：`import { Div, View, ButtonBuilder } from 'ranui/builder'`（`lib/ui.ts` 已在用），不要用成堆 `document.createElement` 拼装。
- **设计 token 用 ranui**：颜色/字体/圆角/阴影/暗色统一走 `--ran-*`（`public/ran-tokens.css`，由 `bin/build.sh` 从 `ranui/dist/ranui.css` 同步），不要另造调色板；落地页样式即基于此。
- **工具函数优先用 ranuts**：`import { ... } from 'ranuts/utils'`（如 `getAllQueryString`、`createObjectURL`、`createSignal`），不要重复造轮子。
  二进制/文件相关的通用能力 0.4.0-alpha.5 起也在 ranuts：`createZip` / `readZipEntries` /
  `readZipEntry`（zip 读写）、`bytesToBase64` / `base64ToBytes`（分块，避免大文件
  RangeError）、`fetchMaybeGzip` / `gunzipMaybe`、`isZipContainer` / `isHtmlDocument`
  （字节嗅探）、`decodeTextBytes`（BOM→utf-8→gb18030→latin1）、`saveFileToDisk`
  （File System Access + 锚点兜底）——本仓 converter 与 E2E fixture 已全部改用它们。
- **反向改生态**：发现 ranui / ranuts 能力不够用时，去改它们的源仓库 `chaxus/ran`，把能力沉淀回生态供三处共享，而不是在本项目里堆 workaround。

---

## 重要约定

1. **不锁定工具版本**：CI 中 pnpm 用 `latest`，Node 用 `lts/*`，保持自动跟随最新
2. **SW 两个版本戳，别混用**（这是"部署能不能自己生效"的开关）：`CACHE_VERSION`
   是构建时间戳，只用来命名 **core cache**（HTML/壳，走 network-first，删了无害）；
   `VENDOR_VERSION` 是 **vendor 树内容哈希**（`bin/build.sh` 在 `$DIST_DIR` **里面**对
   `{sdkjs,web-apps,fonts}` 排序后逐文件内容哈希再总哈希，约 1.8s／2610 文件／
   616 MB，含我们塞在 vendor 里的补丁如 `x2t_helper.js`），用来命名 **runtime cache**。
   `cd "$DIST_DIR"` 那步不是讲究：`shasum` 把路径打印在摘要旁边，从外面哈希会把
   输出目录名折进戳里，同一棵树构建到 `dist-e2e-4174/` 与 `dist/` 就成了两个名字。
   因为 `activate()` 会删掉名字不匹配的所有 cache，**runtime cache 一旦按构建戳命名，
   每次部署都等于要抽走上一版的引擎资源**，于是每次部署都必须走协调、谁都没协调成，
   用户就一直跑旧代码（#144）。按内容命名之后：改了 app 代码但没动 vendor 的部署
   共用同一个 runtime cache、删不掉任何东西，install 里直接 `skipWaiting()` 立即接管
   （判据 `wouldDiscardVendorAssets`）。
   **这个判据看的是别的 runtime cache 里有没有真的 vendor 条目，不是看名字**，
   两个方向都会错：落地页自己也会往 runtime cache 里写东西（指纹化的 token CSS、
   Geist 字体表、`open-local.js`、`landing-prefetch.js`），而 `pruneAppAssets`
   只清条目不删 cache，于是"只看过落地页"的访客留下一个空壳，按名字判就是永久
   "有 vendor 资产要丢"；反过来，**引入这套命名的那次部署**，旧 cache 还叫构建戳，
   名字必然不同——而那正是 `sw-register.js` 的 `CLIENT_COUNT` 握手也必然失效的
   同一次部署（要问的旧 worker 从没带过 handler）。两条路一起哑掉，#144 的修复就
   发不出去。改这两个戳的命名前先读
   docs/explorations/2026-08-20-service-worker-update-never-promoted.md。
   **代价是 runtime cache 不再有人清空**，所以两处补偿，缺一处就会把它保护的
   东西反过来淘汰掉：`activate()` 结束时 `pruneAppAssets()` 删掉 cache 里所有
   非 vendor 条目（`/assets/<hash>` 属于刚退场的那个构建，永远不会再被请求，
   否则一次次部署堆到 `MAX_RUNTIME_ITEMS`）；`limitCacheSize` 淘汰时优先挑非
   vendor 条目，而不是 `keys[0]`——`keys()` 按写入顺序，`keys[0]` 恰好是首次
   打开时取的 vendor 树（x2t.wasm.gz、字体 catalog），正是 cache-first 分支要
   保的那几 MB。`VENDOR_ASSET` 的目录列表必须与 `bin/build.sh` 参与
   `VENDOR_VERSION` 的目录一致（`sw-update.test.ts` 钉住）。
   **`pruneAppAssets` 只在本 scope 没有打开的窗口时才扫**（`clients.matchAll`
   带 `includeUncontrolled`）：vendor 未变的部署现在 install 就接管，`activate()`
   是在活页面底下跑的，而开着文档的编辑器页刻意不 reload——把它的
   `/assets/<hash>` 删掉就是删掉世上最后一份（新部署不再提供退场构建的文件名），
   它之后的惰性 `import()`（agent 面板、pending-open 交接）只会走到 404 分支。
   等待没有代价：期间由 `limitCacheSize` 按"vendor 最后淘汰"顶着，下一次没有窗口
   的激活再清。**`activate()` 删陈旧 runtime cache 前会再问一次**
   （`holdsVendorAssetsForOpenWindow`）：`wouldDiscardVendorAssets` 是 install 时
   求值的，而 vendor 未变的部署 activate 跑在活页面底下——这中间旧构建的页面
   可能刚写进第一批 vendor 条目，删掉就是那条判据要防的混版；没有窗口时照删。
3. **SW 更新策略分两侧，缺一侧就发不出去**（vendor 真变了时的慢路）：`sw.js` 在
   vendor 变更时不会自行 `skipWaiting()`（激活会删掉上一版 vendor 缓存，而仍在跑旧版的
   页面之后惰性加载的 sdk-all.js / x2t.wasm.gz / 字体就会与旧会话混版）。此时必须有人
   主动请求切换：
   **落地页**（`/` 与 `/zh-CN/`，见 `public/sw-register.js`）负责提升等待中的
   worker，**编辑器页**（`lib/sw-update.ts`）只在没有文档打开时提升。
   2026-08-16 路由拆分把 `/` 变成不带 bundle 的静态页之后，提升逻辑只剩编辑器页，
   而那里打开流程排在 SW 注册**之前**，`hasOpenDocument()` 永远为真——于是正常
   使用下等待中的 worker **从不被提升**，用户要关掉本站所有标签页才会拿到新版
   （`/zh-CN/` 当时连 worker 都没注册）。落地页提升前会经 `CLIENT_COUNT` 问
   active worker "有没有编辑器窗口开着"（回答带 `count` 与 `editors`，后者按
   `/editor` 路径数），只有 `editors === 0` 才提升，以免把另一个开着文档的
   标签页的缓存删掉。**判据是编辑器窗口、不是窗口总数**：另一个落地页标签没有
   任何会被激活毁掉的会话，按"是不是唯一窗口"判会让习惯常开两个标签页的人永远
   拿不到新版本。旧 worker 的回答里没有 `editors`，那种情况回落到旧判据。**新增落地页要带上 `sw-register.js`**；它属于"固定名、随
   部署变化"的文件，必须同时进 `_headers` 的 no-cache 组与 `sw.js` 的
   `DEPLOY_COUPLED`（由 `hosting-contract.test.ts` / `sw-routing.test.ts` 钉住）。
   `open-local.js` / `landing-prefetch.js` 同理，2026-08-20 起补齐——它们从路由
   拆分起一直漏在 SWR 上，改这两个文件的部署，落地页会一直跑旧的那份。
   落地页那侧的提升要覆盖三种到达方式：已经 `waiting`、`installing` 中途、
   以及 `updatefound` 时已经 `installed`（`statechange` 只报此后的迁移，
   漏掉这一支等于整页生命周期内再没人提升它）。
   见 docs/explorations/2026-08-20-service-worker-update-never-promoted.md。
4. **站点页面统一 ran 设计体系**：所有用户可见页面（落地页、demo 页如
   `public/embed-demo.html`、404 等）必须使用 ranui 组件/设计 token
   （`--ran-*`）与 ranuts 工具，不允许手写游离于设计体系外的样式。
   demo 页也是产品门面，风格必须与主站一致。
   **版式只有两档宽度**（宽版 1152 / 读式 720），**由布局形态决定用哪档、不由页面
   类型决定**——需要横向比较属性的表格/卡片网格用宽版，竖向找目标的列表用读式
   （`/history` 就是后者：按"它是列表页"归到 1152 时实测每行有 236px 死空隙）；
   **正文行宽 45–75 字符**（用 `max-width: 60–72ch` 限制段落，不是限制容器）、
   **内容页有顶栏+页脚，应用页有顶栏无页脚**（`/history`、`/embed-demo` 属后者）、
   **顶栏页脚只有一份样式**（`landing.css`，页面复用其类名而不是抄数值）。取值与业界依据见
   [docs/design-system.md](docs/design-system.md)，`node bin/design-audit.mjs <baseUrl>`
   渲染所有页面打印这些数字，`test/unit/design-contract.test.ts` 把宽度与顶栏钉死。
5. **用例固化制度（2026-08-15 起）**：每个缺陷修复与新功能必须附带
   对应的自动化用例（E2E 优先），否则不算完成；回归类用例优先使用
   真实复杂度语料而非手拼最小文档——合成文档全绿曾两次掩盖真实文档
   的致命问题（插图保存假死、真实 PPTX 编辑报错）。CHANGELOG.md 随
   用户可感知的改动同步更新。
   **新用例必须做反向验证（2026-08-18 起）**：临时去掉/禁用本次修复，
   跑一遍新用例，**确认它变红**，再恢复修复。绿着的用例不等于测到了
   修复——2026-08-18 一天内两次踩到：`installViewportFollow` 的首版用例
   在没有该修复时同样全绿（它其实被另一处改动覆盖了），`layout.rightMenu`
   单向失效的用例也是宽屏挂载、根本走不到出问题的分支。反向验证的结论
   （"去掉 X 后用例 Y 变红"）写进 PR 说明与 docs/explorations 记录。
6. **本地历史（自动保存恢复点，2026-08-22 起）**：定位是 AutoRecover 而**不是** AutoSave——
   快照只进本机 IndexedDB，永远不动用户磁盘上的文件，也**不清除未保存提示**（只有真正导出到
   磁盘才清）。四条硬约束，改这块前先读
   docs/explorations/2026-08-22-autosave-history-implementation.md：
   1. **身份是 `?saved=<id>`，不是文件名**。会话在挂载前 mint id 并写进地址栏；按标题复用行
      会把无关文档的历史合并（每个新建空文档都叫 `New_Document.docx`）。一行 = 一次编辑会话；
      只打开不编辑不留行（行由第一次快照创建）。
   2. **七天自动清除**，从 `max(updatedAt, lastOpenedAt)` 起算，在启动、每次写快照、
      打开历史页三处清扫——只在历史页清扫等于没有清扫。这个窗口是对用户的承诺，
      写在首页 HTML（不是脚本生成）与历史页每一行的倒计时里，改数字要三处一起改。
   3. **不能自己调 `asc_DownloadAs`**：没有 in-flight 请求时 `routeSavedFile` 会直接把
      字节存到磁盘（用户会收到一堆莫名下载）。一律走 `requestSaveDocument`，
      被用户的保存占用时跳过这一拍。
   4. **embed 模式与只读一律不写**；两个标签页开同一 id 由 Web Locks 互斥，拿不到锁的那个
      不写快照（否则两边轮流覆盖，比没有历史更糟）。
   5. **保存优先写回文档自己的文件**（`lib/save-target.ts`，仅 Chromium）：第一次保存选文件，
      句柄按 docId 存进 `handles` store，之后静默写回。任何异常（文件被移走、权限被拒、
      浏览器没这个 API）都回落到下载，并**忘掉句柄**——那既是容错也是"另存为"的出口。
      注意保存到磁盘会清掉未保存脏位，所以之后不再产生快照，直到用户又编辑。
      `?saved=` 用查询参数而不是路径段：这个 id 指的是**某台设备上某个浏览器里的一行记录**，
      放进路径会让它看起来可分享，而收到链接的人只会打开一个空编辑器。
      节拍是 90s 间隔 + 2s 空闲 + 脏位三重条件，另加 `visibilitychange → hidden` 补一刀
      （`beforeunload` 里发起导出来不及）。**E2E 等快照的窗口必须小于 90s**，否则周期 tick
      会替你把用例变绿，测不到它声称测的分支（踩过）。
7. **循环依赖处理**：`onlyoffice-editor.ts` 与 `converter.ts` 之间通过回调注入（`setConverterCallbacks`）解耦；`ui.ts` 与 `document.ts` 之间通过 `setUICallbacks` 解耦
8. **编辑器操作队列**：`createEditorInstance` 内部有 `editorOperationQueue`，防止并发创建/销毁编辑器
9. **.claude/ 目录**：已加入 `.gitignore`，不提交本地 Claude Code 配置

---

## 技术方向评估

### WebMCP（浏览器 Agent 工具）— 已实现，见 `lib/web-mcp.ts`

**状态：已上线**（2026-08-16 接入，2026-08-21 补齐）。本节曾长期写着"暂缓实现"，
与代码不符，已更正。

WebMCP 让页面向浏览器内的 AI Agent 注册结构化工具，Agent 直接调用而不必去
"看"和"点"界面。本站是典型的动词站点（打开 / 转换 / 导出 / 预览），而
`embed-api.ts` 早就把这些动词定义成了消息协议，所以适配层很薄——同一批内部函数
换一个出口。

**7 个工具**（顺序即分组：打开 → 新建 → 导出 → 读取 → 模式 → 状态）：

| 工具                   | 说明                                               |
| ---------------------- | -------------------------------------------------- |
| `open_document_url`    | 从 URL 打开（浏览器自己 fetch，不上传）            |
| `open_document_buffer` | 从 base64 字节打开                                 |
| `create_document`      | 新建空白 document / spreadsheet / presentation     |
| `save_document`        | 导出，可转格式；返回 blob URL（小文件附 data URL） |
| `get_document_text`    | 读取正文，让 Agent 不必导出就能回答内容问题        |
| `set_readonly`         | 运行时切只读                                       |
| `get_document_state`   | 是否有文档、文件名、只读状态                       |

**几条约束，改这块前必须知道**：

1. **只在顶层窗口注册**。跨域 iframe 需要父页面加 `allow="tools"`，与 embed
   场景冲突，所以 `initWebMcp` 检测到自己在 frame 里就直接返回空。
   `webmcp.spec.ts` 有用例钉死。
2. **结果必须可 JSON 序列化**。`save_document` 因此返回 blob URL 而不是 File；
   小于 `INLINE_DATA_URL_MAX_BYTES`（2 MB）时附带 data URL，因为 Agent 不一定
   读得了 blob:。
3. **API 位置在迁移中**：2026-07 从 `navigator.modelContext` 移到
   `document.modelContext`，`findModelContext` 两处都探。所有 WebMCP 特有的形状
   都关在这一个文件里，将来规范再变只改这里。
4. **格式清单必须派生，不能手写**。`OPENABLE_EXTENSIONS` 从
   `DOCUMENT_TYPE_MAP` 算出来——手写的那版曾经落后于引擎，Agent 被告知
   odt/ods/odp/rtf/txt 不支持，而引擎一直读得了。单测钉死两者相等。
5. **工具层是共用的**。`get_document_text` 直接复用
   `lib/agent-plugin/tools.ts` 的实现（`@ranuts/agent-core` 的类型注释里写明
   工具是 transport-agnostic 的），不要在 web-mcp 里另写一份。
   `editor-bridge.ts` 零 import，所以复用不带来 bundle 成本。

**已知缺口（实测 v9，见 docs/explorations/2026-08-21-webmcp-completion.md）**：
引擎只对文字文档提供全文读取，表格和演示文稿返回空字符串。空字符串是有歧义的
（"文档是空的"和"读不出来"长得一样），所以 `get_document_text` 对非 word 文档
显式返回 `supported: false` 加一句改用 `save_document` 的提示，而不是让 Agent
以为文件是空的。同一轮实测还发现 `agent-plugin` 的 `set_cell`
（`asc_setCellValue` 在 v9 已不存在）和 `set_review_mode`（`asc_SetTrackRevisions`
仅 word 有）在 v9 下失效——那是 agent 面板的问题，未在此处修。

**浏览器支持**：Chrome origin trial 阶段，Firefox / Safari 无时间表。所以这是
纯增量能力：`findModelContext` 找不到就整个 no-op，对普通用户零影响。

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

| 现有模块                | 复用方式                                            |
| ----------------------- | --------------------------------------------------- |
| `embed-api.ts`          | 外部页面仍可通过 postMessage 触发 Agent 操作        |
| `onlyoffice-editor.ts`  | `requestSaveDocument` 可在 Agent 完成编辑后直接调用 |
| `lib/ui.ts`             | 复用现有控制面板的显示/隐藏模式添加 Agent 面板      |
| `packages/shared` store | Agent 执行状态可通过同一 signal 机制管理            |

### OnlyOffice v9（已转正：public/ 即 v9，v7 已移除）

**状态：v9 已是唯一路径。** `public/` 直接承载 v9 vendor，v7 引擎资源与全部
v7 代码分支（OO_VARIANT、页面级 x2t 打开转换、empty_bin 模板、v7 iframe patch）
已删除；E2E 回归守护齐全。

- **底座**：第三方编译的 OnlyOffice 9.3.0.133 离线静态包（含
  9.4 版 x2t.wasm，AGPL-3.0），vendor 整体位于 `public-v9/`
  （sdkjs / web-apps（help 已裁剪）/ 索引字体），位于 `public/`。
- **集成方式**：纯公开 DocEditor 配置驱动（blob URL 打开、每次打开唯一
  key），保存经编辑器内部 x2t 转换后由 `onlyoffice-file-stream` postMessage
  抛回页面（`OO_FILE_STREAM_ONLY` 抑制其自带下载）。旧 v9 方案那套 1207 行
  iframe patch 与混淆符号 hook 已全部删除。
- **关键代码**：`lib/onlyoffice-editor.ts` 的 `createPersonalEditorInstance` /
  `handleFileStreamMessage` / `triggerPersonalDownloadAs` / `prepareEditorIframe`
  （最后一个含多个运行时守卫：品牌元素隐藏、SharedWorker 遮蔽、fetchFonts
  字体竞态守卫、**serverless image pipeline**、serverless 保存语义（守卫 5）、
  长操作计数器泄漏（守卫 6：图表/OLE 帧编辑器入口失败后不 EndAction，
  之后每次 asc_DownloadAs 被静默丢弃）、整表序列设置（守卫 7：全选后
  asc_GetSeriesSettings 按 1048576×16384 建序列直接 OOM 崩渲染进程）、
  评论批量操作（守卫 8：无选区时 removeAllComments/resolveAllComments 读
  `_getSelection().ranges` 抛错且漏开历史事务）、画布上下文丢失（守卫 9：
  移动端内存紧张时浏览器丢弃 canvas backing store，vendor 完全不监听
  contextlost/contextrestored，编辑器停在白屏；捕获阶段监听后用
  `WordControl.OnResize()` 重绘）、x2t 二进制回收（守卫 10：解压出的 40.2 MB
  `Module.wasmBinary` 被 emscripten 读过一次后再无用处却常驻整个 frame 生命周期，
  `calledRun` 之后置空。**两份引用都要清**：x2t.js 是未包裹的 classic script，它自己
  `var wasmBinary = Module['wasmBinary']` 在 frame 的 window 上又留了一份且从不清，
  只清 Module 那个属性等于什么都没释放。这条**不靠 `prepareEditorIframe` 的轮询驱动**：空文档
  （`?new=docx`）要到几分钟后的首次保存才加载 x2t，那时定时器早停、
  onDocumentReady 也早过了——所以它给 frame 的 `Module` 与 `calledRun` 装
  accessor 订阅，装上即算就位）、字体加载加速、
  `installOpenFailureGuard`（打开转换失败 → asc_onError -82 + toast + 遮罩终止 +
  保存快速拒绝）——其中 image pipeline 修的是"文档含图片
  时保存令主线程永久卡死"：无服务器时 sendImgUrls 注册不了图片，DOCY
  被写入裸外部 URL，x2t.wasm 对此死循环。自愈 getImageLocal + 本地
  sendImgUrls + convertFromBin medias 兜底三件套，见
  docs/explorations/2026-08-15-image-save-hang-root-cause-fix.md。全部
  都是真实生产 bug，别删）。
- **部署约束**：x2t.wasm 只发布 gzip（9,483,006 字节，**zopfli `--i15` 压的**——比
  vendor 原始压缩小 377 KB，比 Node zlib 小 575 KB，解压后逐字节一致；zopfli 不是仓库
  依赖，vendor 升级后手动重跑 `zopfli --gzip --i15 -c x2t.wasm > x2t.wasm.gz`，
  `vendor-contract` 的尺寸门会提醒），裸 40 MB 文件超 CF Pages 25 MB 限制、不入库。
  **契约钉的是解压后内容的 sha256**，不是 `.gz` 容器的——否则 provenance 会被压缩器
  的选择绑住。加载走 `x2t_helper` 的 `Module.instantiateWasm` 钩子 +
  `instantiateStreaming` 直接吃 `DecompressionStream`——**解压后的 40.2 MB 副本
  不存在**，否则它会压在"向浏览器要 283 MB 堆 + 编译 40 MB 代码"的同一刻（#144）。
  钩子里**绝不能同步抛**（`createWasm()` 会变成致命 `false`），分配失败**绝不回落
  到缓冲路径**（在已耗尽的 renderer 上再要 40 MB 只会更糟）。无流式能力的引擎才走
  `prepareWasmBinary` 缓冲兜底 + 守卫 10 回收。三个符号由 `vendor-contract` 钉住。
  **钩子的失败要报两次，缺一次就有人干等**：rethrow 带 `X2T module` 前缀（给
  `installOpenFailureGuard` 认，它据此分类并重开），同时把失败记在实例上并通知在等的
  `doInitialize`（钩子跑的时候 `loadScript()` 早就 resolve 了，`successCallback` 与
  `onRuntimeInitialized` 都不会再来，没人 settle 就一直等到 `INIT_TIMEOUT`——vendor 侧
  60s、`packages/converter` 侧 300s）。`loadScript()` 在 `hasScriptLoaded` 时必须返回
  `Promise.resolve()` 而不是裸 `return`：流式路径下这个分支是常走的（script 加载成功、
  wasm 才失败），返回 `undefined` 会让下一次尝试同步抛 `undefined.then`。这两份实现
  （`x2t_helper.js` 与 `packages/converter/src/document-converter.ts`）语义必须一致，
  由 `x2t-helper-loading.test.ts` / `converter-wasm-loading.test.ts` 分别驱动真文件钉住。
  **失败消息必须带得动原因**：宿主的 `classifyOpenFailure` 按文本分类，converter 的
  `loadScript` 曾经把一切包成 `Failed to load X2T WASM script`，于是 buffered 路径上
  的 CDN 500 / 内存拒绝都落到默认分支 `document`，报"文件可能已损坏"且不重试。
  **这个 fetch 会重试**（`fetchWasmResponse`，两份实现同策略）：5xx / 408 / 429 与
  fetch 本身 reject 重试，共 3 次、线性退避 0.5s+1s；404 / 403 立即失败（部署事实，
  重试只是拖延错误）。9.4 MB 的 CDN 资源答坏一次就等于整篇文档打不开——2026-08-20
  CF Pages 给这个文件回了个 500，PR #159 的 preview smoke 因此变红，而这条路上唯一
  的补救原本是整个编辑器重开（贵得多，那次也没救回来）。重试的是 fetch 不是
  instantiate，所以"分配失败绝不回落到缓冲路径"照旧；不留跨次引用，不加重内存峰值。
  见 docs/explorations/2026-08-20-x2t-wasm-fetch-transient-retry.md。
  改 `packages/converter/src/**` 后本地要先 `pnpm --filter @ranuts/converter run build`
  ——用例从 `dist` 导入，不重建就还在测旧代码（CI 由包的 `prepare` 覆盖）。
- **内存**：**283 MB initial 不是可调参数，别去调**（试过并回滚）。模块静态/BSS 布局
  铺到 ~267 MB（2501 个不可变 i32 global，最高地址 267.3 MB），声明的 4533 页与下界
  4277 页之间只有 16 MB 余量；降到 64 MB 会在实例化时
  `RuntimeError: memory access out of bounds`，读文件之前就死。数字用
  `node bin/x2t-memory-report.mjs` 现场量，别抄本文。`maximum` 也别调小：它是
  硬上限（`_emscripten_resize_heap` 直接 `return false`），砍它等于砍大文档的能力，而
  glue 的 `getHeapMax()` 又硬编码 2 GB。要降低这个要求只能换一个 `INITIAL_MEMORY` 更小
  的 x2t 构建。详见 docs/explorations/2026-08-20-x2t-wasm-oom-misclassified.md。
- **内存（现状）**：x2t 每个 frame 要 283 MB initial（声明的 maximum 2048 MB 还要被
  预留），分配失败会以 `Aborted(RangeError: ... Out of memory ...)` 出现。这
  **不是**对文档的判决——`classifyOpenFailure` 必须在 `Aborted(` 规则**之前**
  识别它并返回 `environment`，提示语走 `editorErrorOutOfMemory` 而不是"可能已
  损坏"；但要排在 `Conversion failed with code` **之后**——有退出码就说明 x2t
  已经实例化并读过字节，那是它对文档的判决，哪怕消息里带"memory"。
  提示语里的 283 由 `X2T_INITIAL_MB` 经 `t(key, { mb })` 插值，8 条译文只写
  `{mb}`，别手抄数字。**诊断探测不许和重开抢内存**：commit 那半真的会同步
  提交 283 MB，而环境类失败正在重建编辑器要它自己的 283 MB——所以
  `probeX2tMemory({ skipCommit: isOpenRetryInFlight() })`，重开在飞时只问
  reservation（1 页）并回 `deferred`；**浏览器拒绝过一次 commit 之后本 session 不再问**
  （一次失败的打开会两次走到 toast——守卫送进 asc_onError 一次、vendor 自己再报一次
  -82），`registerOpenAttempt` 在用户发起新的打开时 `resetMemoryProbe()` 清掉。别把重建时导航旧 frame 到 `about:blank` 当优化加回来：它会掐断 vendor
  在 ready 之后仍在取的 SVG 图标请求，每次文档切换都报 `Failed to fetch`（试过
  并撤掉，见 docs/explorations/2026-08-20-x2t-wasm-oom-misclassified.md）。
- **CSV**：新 vendor 编辑器不能直接吃 CSV——打开前用 SheetJS 转 XLSX、保存
  流转回 CSV（`packages/converter` 的 `convertCsvToXlsx` / `xlsxToCsvBytes`）。
  解码带严格编码嗅探（fatal UTF-8 → GB18030 → latin1），GBK CSV 不再乱码。
- **运行时只读**：挂载永远 `edit: true`，只读经 `asc_setRestriction(128)`
  在 onDocumentReady 后施加、`setReadonlyMode` 双向切换（详见
  `lib/onlyoffice-editor.ts` 的 `getSdkEditorApi`；E2E "runtime readonly
  toggle" 守护）。别改回 view 模式挂载——那是单向门。
- **字体**：`public/fonts/{index}` 是 XOR 混淆的 catalog 线格式（裸 TTF
  放进去无效），编解码用 `bin/font-catalog.mjs`，体系说明见 docs/fonts.md；
  x2t 转 PDF 的字体注入见 `packages/converter` 的 `PDF_FONT_MANIFEST`。
  **catalog 已全部是可再分发的字体（2026-08-22）**：vendor 原本带着 79 个专有字体
  （171 MB，华文 / 方正 / 中易 / 长城 / Stone 的中文字体 + 微软 Core Fonts +
  Monotype 的 Arial / Times / Courier），已由 `bin/font-license-sweep.mjs` 换成
  开源字体——**换的是注册表不是字节**：专有 family 的 `__fonts_infos` 行改指到替代
  字体已经占着的位置上，文件不改名、不复制。`public/fonts/` 327 MB → 184 MB，
  文档里写着"宋体" / "Arial" 照常解析。改这块前先读
  [docs/explorations/2026-08-22-font-substitution-solved.md](docs/explorations/2026-08-22-font-substitution-solved.md)。
  1. **唯一那条规则**：位置 P 上那个文件里写的 family 名，必须属于某个指向 P 的
     `__fonts_infos` 行。引擎排版时读的是加载文件里的 `m_pFaceInfo.family_name`，
     再拿它过一遍匹配器（`sdk-all.js` 的 `StringShaper.Shape`）；名字指到别处，
     排版与光栅就分家，`Hello` 显示成 `Fcjjm`。原始 catalog 267 个被引用位置全部
     满足这一条，PR #170 打破的正是它（它把替代字体的**文件名**写进了专有位置）。
     `test/unit/font-catalog-licensing.test.ts` 钉住这条不变式。
  2. **新增 family = 位置 + `__fonts_infos` 行 + `g_fonts_selection_bin` 记录**，
     三样缺一不可。少了第三样，匹配器按名字找不到，又变成同一种错位（本轮的 CJK
     family 先踩了一次）。那个 blob 不是黑盒：阅读器在 `sdk-all.js` 里，
     `bin/lib/selection-bin.mjs` 双向实现，单测钉住"解码再编码逐字节还原"与
     "按字体 OS/2 重建的记录与 vendor 写的完全一致"（188 个文件）。
     metrics 缩放到 1000 em 用**整数截断**，四舍五入会差 1。
  3. **回退区间背后的字体必须真的有那些字**。picker 查一次 `__fonts_ranges` 就
     结束，指到一个缺字的字体上就是空白、不会再找第二个——所以 CJK 回退用的
     Noto Sans SC 切的是**全量 CJK**（9.9 MB），只有显式点名的宋/仿/楷走
     GB2312 子集（3.6 MB）。韩文仍走 catalog 自带的 NanumGothic。
     **CJK 必须是 TrueType（glyf），不能用 CFF（`OTTO`）**：pan-CJK 的
     Noto Sans/Serif CJK SC 在编辑器里渲染完全正常，但 x2t 往 PDF 里一个字形都嵌
     不进去——导出的 PDF 中文全空白、拉丁正常。所以用 Noto Sans/Serif **SC** 的
     可变字体实例（`fontTools.varLib.instancer --update-name-table`，那个参数不能
     省，否则两个字重都叫 "Noto Sans SC Thin"）。`test/e2e/pdf-cjk-export.spec.ts`
     钉住这条。
  4. **三处按槽位号硬编码，改完 catalog 必须同步**，否则静默 404：
     `PDF_FONT_MANIFEST`、`public/landing-prefetch.js` 的 `CORE`、
     `test/e2e/landing-prefetch.spec.ts` 的 `CORE_FONTS`。前者从 #174 那次 revert
     起就一直指着不存在的槽位（导出 PDF 里中文全是空白），本轮修好并补了用例。
  5. **验证只能在真实浏览器里看渲染**：视觉 E2E 比的是"原始 vs 存回"，两侧同样的
     错字体，逐像素一致。文本必须跨出 U+A0，并且用 `pluginMethod_PasteHtml` 灌进去
     ——`page.keyboard.type` 会丢字符，丢一个词的像素差和缺陷本身同量级。
     `test/e2e/font-substitution.spec.ts` 用的判据是：被替换的名字与背后那个开源
     family 指着同一个位置，两次渲染必须逐像素相同。
  6. `sdk-all.js` 里硬编码了 `Arial` / `Calibri` / `SimSun` / `Tahoma` / `Batang` /
     `MS Mincho`（按语言的默认字体与主题默认字体），删掉这些 family 名会白屏——
     这也是**替换而不是删除**的理由：一个 family 名都没少。
- **粘贴 XSS**：三个编辑器的粘贴解析 iframe 均带
  `sandbox="allow-same-origin"`（无 allow-scripts），粘贴的 script/on*
  不会执行，无需额外过滤 patch（2026-08-14 排查结论）。
- **详细历史**：docs/explorations/ 下 2026-08-11 ～ 08-14 的 v9 系列文档
  （根因链、迁移记录、issue 回归排查、E2E 固化、同类方案研究）。
- **PDF 打开**：已接入（2026-08-15）。api.js 按 `document.fileType === 'pdf'`
  自动路由 pdfeditor，页面侧只需类型映射（`DOCUMENT_TYPE_MAP.pdf` +
  `getDocumentType`）与文件选择 accept；保存与其他格式共用 file-stream 通道。
- **界面主题**：默认经典 Office 主题 `theme-classic-light`（2026-08-15 起；v9
  加载器原默认 `theme-white` 纯白），经 `customization.uiTheme` 传入。该参数
  启动时压过编辑器自存的 `ui-theme-id`，所以 `resolveUiTheme()` 先读同源
  localStorage 里用户手选的主题、没有才回退经典，别改成硬编码。见
  docs/explorations/2026-08-15-classic-office-ui-theme.md。
- **错误提示**：编辑器 `onError` 会用 ranui message 弹 toast（含错误码与
  描述；-85 附"内容与扩展名不一致"提示），别再只留 console.error。
- **待办（最高优先级，2026-08-15 用户实测判定）**：v9 全面回归战役。
  真实文档实测稳定性不如 v7（P0 现场：真实 35 页 PPTX 编辑标题弹
  "An error occurred during the work with the document" 致命错误框）。
  战役方案与用例固化制度见 docs/superpowers/plans/2026-08-15-next-phase-roadmap.md
  方向零；**测试全覆盖方法论**（格式×操作×输入×环境行为矩阵、三层语料、
  L0–L4 五层判据、缺陷→参数化类用例、矩阵空白格/escape 两项指标）见
  docs/superpowers/plans/2026-08-15-v9-test-coverage-strategy.md，新用例
  按它落位，台账在 docs/test-matrix.md（空白格 = 待补）；**新开会话先读
  docs/changelogs/2026-08-15-v9-regression-campaign.md**（战役一页纸：结论、
  数字、缺陷清单、文件位置、怎么跑、下一步）**与 docs/changelogs/2026-08-16-roadmap-sprint.md**（路线图冲刺一页纸：路由拆分 / 帮助中心 / 多语言 / WebMCP / PR 流程变化）**与 docs/changelogs/2026-08-20-issue-144-memory-and-delivery.md**（issue #144 一页纸：x2t 的 283 MB 内存要求为什么动不了、"别再试这些"负面清单、SW 更新投递为什么曾经完全失效、等报告人截图里的哪串字）。战役进展：第 1 天的"非 ASCII 文件名 P0"已被第 2 天推翻
  （跑道被 SW 击穿，见 docs/explorations/2026-08-15-corpus-harness-sw-route-bug-and-open-failure-guard.md），
  真正修掉的是"打开失败永久转圈"（`installOpenFailureGuard`）与
  "Save 按钮常灰"（守卫 5）。v9 release 公告冻结至战役通过。

---

## 测试覆盖说明

### 为什么 onlyoffice-editor.ts / onlyoffice/ 覆盖率低

这是预期行为，**不需要强行提升**。这些代码大量是 OnlyOffice 编辑器的事件回调与
厂商运行时补丁（`onlyoffice/guards/**` 整目录只有真实编辑器跑起来才会执行），
必须有真实编辑器运行才能触发：

| 函数                             | 无法单测的原因                                                        |
| -------------------------------- | --------------------------------------------------------------------- |
| `createEditorInstance` (~120 行) | 依赖 `window.DocsAPI`，该对象由外部脚本动态注入，jsdom 不执行外部脚本 |
| `handleSaveDocument` (~55 行)    | 由编辑器 `onSave` 事件触发，需真实编辑器实例                          |
| `handleWriteFile` (~75 行)       | 由编辑器 `writeFile` 事件触发（粘贴图片时）                           |
| `handleDownloadAs` (~35 行)      | 由编辑器 `onDownloadAs` 事件触发                                      |
| `queueEditorOperation` (~40 行)  | `createEditorInstance` 内部队列，连带未覆盖                           |
| `loadEditorApi` (~20 行)         | 动态创建 `<script>` 标签加载外部 JS，jsdom 不执行                     |

这些函数不适合单测 mock 覆盖（测试代码会比被测代码更复杂）。**真实编辑器路径由
E2E 回归套件覆盖**（`pnpm run test:e2e` 的 embed-regression.spec：打开/编辑/保存/
转 PDF/CSV 往返/只读/插图，全程真实编辑器 + 真实 x2t；真实文档复杂度由
`test:e2e:corpus` 覆盖）。

**已覆盖的可测部分**（纯函数 + 状态管理）：

- `getSavedFileMimeType` / `getNormalizedFile` / `toUint8Array` — 纯计算逻辑
- `setReadonlyMode` / `getReadonlyMode` — 状态读写
- `requestSaveDocument` — 所有拒绝路径（无编辑器、只读、并发、超时、不支持 downloadAs）
