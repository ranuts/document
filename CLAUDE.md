# CLAUDE.md — document 项目指南

## 项目概述

基于 OnlyOffice 的本地 Web 文档编辑器，所有处理在浏览器端完成，无需服务器，保护用户隐私。支持 docx、xlsx、pptx、csv、pdf 等格式。

- **线上地址**：https://edit.chaxus.com/ （旧址 https://ranuts.github.io/document/ 已跳转至此）
- **GitHub**：https://github.com/ranuts/document
- **技术栈**：TypeScript + Vite + Tailwind CSS + OnlyOffice Web Apps

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
pnpm run test:e2e                # E2E 测试（Playwright，自动 build+preview）
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
  onlyoffice-editor.ts  # 编辑器实例生命周期、保存、只读模式、运行时守卫
  ui.ts                 # 控制面板、菜单、FAB 等 UI 组件
  analytics.ts          # Cloudflare Web Analytics（刻意不用 GA；线上实际走 CF 面板边缘注入，因此 embed 视图会被计入、/embed-demo 双计，读数规则见 docs/explorations/2026-08-17-analytics-edge-injection-double-count.md）
  pending-open.ts       # 静态落地页经 IndexedDB 交接文件（?open=local）
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
bin/                  # build.sh、test-e2e-docker.sh、font-catalog.mjs、bundle_single_html.js、build-pages.mjs（markdown→/help /changelog；由 vite 插件 `generated-pages` 在 build/dev 时渲染进 public/，产物不入库）、sitemap-lastmod.mjs（改完落地页/内容后跑一次，按 git 提交日期刷新 sitemap 的 lastmod，`--check` 可校验）
content/              # 生成页面的 markdown 源（content/<locale>/*.md，frontmatter title/description）
docs/                 # embed-api / fonts 文档、explorations/（每次改动的记录）、superpowers/plans/
index.ts              # 编辑器入口（初始化事件、UI、PWA），挂在 editor.html
index.html            # `/`：静态落地页（无编辑器 bundle；CTA 跳 /editor，旧深链内联脚本重定向）
editor.html           # `/editor`：编辑器页面（?new= ?file= ?src= ?embed=1 ?open=local）
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

### onlyoffice-editor.ts — 编辑器生命周期

- `createEditorInstance(config)` — 创建/重建编辑器，内部有操作队列防并发
- `setReadonlyMode(bool)` / `getReadonlyMode()` — 只读模式
- `requestSaveDocument(targetExt, options)` — 触发编辑器保存并返回 File，180s 超时（慢链路首存要先下 10 MB wasm；打开失败会立即拒绝）
- `setConverterCallbacks(...)` — 注入转换器（解耦循环依赖）

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
  sw-routing.test.ts          # sw.js 缓存策略路由
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
`test/e2e/` 现有 29 个 spec，下面先说三条主线，再给全量清单：

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
| 失败与守卫        | `open-failure`（-82 可见 + 保存快速拒绝，兼作 L0 自检）、`comment-bulk-actions`（守卫 8）                                                                                                                                                                                                                                                                |
| 视觉 / 性能       | `visual-roundtrip`（无基线：原始 vs 存回再打开逐像素）、`slow-network` _opt-in_ `SLOW_NET=1`                                                                                                                                                                                                                                                             |
| 交互面（策略 §9） | `api-surface` _opt-in_ `API_SWEEP=1`、`shortcut-surface` _opt-in_ `SHORTCUT_SWEEP=1`、`ui-crawl` _opt-in_ `UI_CRAWL=1`（逐页签点遍工具栏按钮，归因到按钮）、`monkey` _opt-in_ `MONKEY=1`（定种子随机序列，可精确回放）                                                                                                                                   |
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

**四个 job**，触发条件：push/PR 到 main/master。`lint` 先跑，三个 e2e job
在它之后并行。

| job          | 名称（分支保护里的必需检查名）   | 正常耗时                   | timeout |
| ------------ | -------------------------------- | -------------------------- | ------- |
| `lint`       | Lint and Validate                | ~1.5 min                   | 15 min  |
| `e2e`        | E2E                              | ~9 min                     | 30 min  |
| `e2e-docker` | E2E (Docker image)               | ~8 min（镜像构建仅占 46s） | 30 min  |
| `e2e-pages`  | E2E (Cloudflare Pages semantics) | ~18 min                    | 45 min  |

**lint job（串行步骤）：** setup（见下）→ `format:check` → `lint:ts` →
`test:coverage` → `docker compose config --quiet` → hadolint。
**三个 e2e job：** setup（含 chromium）→ 各自的测试命令 → 失败时上传
`playwright-report*/` artifact。

**共用 setup（`.github/actions/setup`）**：pnpm + Node `lts/*` + pnpm 缓存 +
`pnpm install --frozen-lockfile`，`browsers:` 入参非空时再装 Playwright 浏览器。
全部 8 个 workflow 共用它，别在 workflow 里重新内联这几步——
`test/unit/workflow-contract.test.ts` 会拦下来。

**为什么浏览器安装要包一层脚本**：`playwright install --with-deps` 会调
apt-get，而 hosted runner 上的 apt 有过**拉完 release 索引后彻底停住、一个字节
不动**的表现——2026-08-18 一天之内四次 CI 被 GitHub 的 6 小时 job 上限杀掉，
每次挂在不同的 job（三个 e2e job 跑的是同一步，谁中枪是随机的），每次都要人工
重跑。apt 自身没有总时长上限，所以 `.github/scripts/install-playwright.sh` 给
每次尝试套 `timeout` 并重试 3 次，重试前清掉被杀的 apt 留下的锁；浏览器二进制
按 Playwright 版本号进 `actions/cache`，命中时只跑 `install-deps`。

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
action，wrangler 必须经 `bin/serve-pages-dev.sh` 起。三条都由
`test/unit/workflow-contract.test.ts` 钉死。
详见 docs/explorations/2026-08-19-ci-workflow-hardening.md。

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
2. **站点页面统一 ran 设计体系**：所有用户可见页面（落地页、demo 页如
   `public/embed-demo.html`、404 等）必须使用 ranui 组件/设计 token
   （`--ran-*`）与 ranuts 工具，不允许手写游离于设计体系外的样式。
   demo 页也是产品门面，风格必须与主站一致。
3. **用例固化制度（2026-08-15 起）**：每个缺陷修复与新功能必须附带
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
4. **循环依赖处理**：`onlyoffice-editor.ts` 与 `converter.ts` 之间通过回调注入（`setConverterCallbacks`）解耦；`ui.ts` 与 `document.ts` 之间通过 `setUICallbacks` 解耦
5. **编辑器操作队列**：`createEditorInstance` 内部有 `editorOperationQueue`，防止并发创建/销毁编辑器
6. **.claude/ 目录**：已加入 `.gitignore`，不提交本地 Claude Code 配置

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
  `WordControl.OnResize()` 重绘）、字体加载加速、
  `installOpenFailureGuard`（打开转换失败 → asc_onError -82 + toast + 遮罩终止 +
  保存快速拒绝）——其中 image pipeline 修的是"文档含图片
  时保存令主线程永久卡死"：无服务器时 sendImgUrls 注册不了图片，DOCY
  被写入裸外部 URL，x2t.wasm 对此死循环。自愈 getImageLocal + 本地
  sendImgUrls + convertFromBin medias 兜底三件套，见
  docs/explorations/2026-08-15-image-save-hang-root-cause-fix.md。全部
  都是真实生产 bug，别删）。
- **部署约束**：x2t.wasm 只发布 gzip（9.4 MB，x2t_helper 里浏览器端解压
  预置 `Module.wasmBinary`），裸 40 MB 文件超 CF Pages 25 MB 限制、不入库。
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
  数字、缺陷清单、文件位置、怎么跑、下一步）**与 docs/changelogs/2026-08-16-roadmap-sprint.md**（路线图冲刺一页纸：路由拆分 / 帮助中心 / 多语言 / WebMCP / PR 流程变化）。战役进展：第 1 天的"非 ASCII 文件名 P0"已被第 2 天推翻
  （跑道被 SW 击穿，见 docs/explorations/2026-08-15-corpus-harness-sw-route-bug-and-open-failure-guard.md），
  真正修掉的是"打开失败永久转圈"（`installOpenFailureGuard`）与
  "Save 按钮常灰"（守卫 5）。v9 release 公告冻结至战役通过。

---

## 测试覆盖说明

### 为什么 onlyoffice-editor.ts 覆盖率低

这是预期行为，**不需要强行提升**。该文件大量代码是 OnlyOffice 编辑器的事件回调，必须有真实编辑器运行才能触发：

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
