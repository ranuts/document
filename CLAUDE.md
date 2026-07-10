# CLAUDE.md — document 项目指南

## 项目概述

基于 OnlyOffice 的本地 Web 文档编辑器，所有处理在浏览器端完成，无需服务器，保护用户隐私。支持 docx、xlsx、pptx、csv 等格式。

- **线上地址**：https://edit.chaxus.com/ （旧址 https://ranuts.github.io/document/ 已跳转至此）
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
  document-utils.test.ts      # lib/document-utils.ts
  i18n.test.ts                # lib/i18n.ts
  embed-api.test.ts           # lib/embed-api.ts（initEmbedApi、消息路由、来源过滤）
  onlyoffice-editor.test.ts   # lib/onlyoffice-editor.ts（只读模式、requestSaveDocument）
test/setup/vitest.ts          # 全局 mock：matchMedia、URL.createObjectURL、localStorage
```

**当前覆盖率（coverage include 范围内）：**

| 文件                 | 语句 | 分支 | 函数 |
| -------------------- | ---- | ---- | ---- |
| document-utils.ts    | 89%  | 87%  | 100% |
| embed-api.ts         | 75%  | 56%  | 85%  |
| i18n.ts              | 92%  | 65%  | 93%  |
| onlyoffice-editor.ts | 22%  | 16%  | 31%  |

覆盖率阈值（全局）：语句 35%、分支 25%、函数 35%、行 35%。

**注意事项：**

- `embed-api.ts` 有模块级 `initialized` 单例，测试需用 `vi.resetModules()` + 动态 `import()` 获取新实例
- 旧模块实例的 `window.message` 监听器在 `resetModules` 后仍残留，**不要用 `toHaveBeenCalledTimes` 断言次数**，改用 `toHaveBeenCalledWith` 匹配消息内容或用唯一 ID 定向检索
- `requestSaveDocument` 有内部超时状态，测试需配合 `vi.useFakeTimers()` + `vi.runAllTimers()` 清理

### E2E 测试（Playwright）

配置文件：`playwright.config.ts`，使用 Chromium，baseURL `http://127.0.0.1:4173`。

```
test/e2e/
  app-smoke.spec.ts   # 应用加载、PWA manifest 冒烟测试
```

E2E 在 CI 中依赖 `lint` job 成功后才运行（`needs: lint`）。本地运行前需先 `pnpm run build`。

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

## ran 生态优先（ranui / ranuts / builder）

本项目属于 chaxus 的 `ran` 生态（edit.chaxus.com / @ranui/preview / ran.chaxus.com）。写 UI 或工具逻辑时，**优先复用生态自有能力，不要手写重复实现**：

- **组件优先用 ranui**：`r-button` / `r-card` / `r-icon`（含 `name="github"`）/ `r-link` / `r-input` / `r-modal` / `r-select` / `r-tab` 等，`import 'ranui/<name>'` 注册；已装版本的导出以 `node_modules/ranui/dist` 为准。跨 Shadow DOM 定制样式用 `::part`（见 `styles/base.css` 里的 `r-button::part(...)`）。
- **DOM 构造优先用 ranui builder**：`import { Div, View, ButtonBuilder } from 'ranui/builder'`（`lib/ui.ts` 已在用），不要用成堆 `document.createElement` 拼装。
- **设计 token 用 ranui**：颜色/字体/圆角/阴影/暗色统一走 `--ran-*`（`public/ran-tokens.css`，由 `bin/build.sh` 从 `ranui/dist/ranui.css` 同步），不要另造调色板；落地页样式即基于此。
- **工具函数优先用 ranuts**：`import { ... } from 'ranuts/utils'`（如 `getAllQueryString`、`createObjectURL`、`createSignal`），不要重复造轮子。
- **反向改生态**：发现 ranui / ranuts 能力不够用时，去改它们的源仓库 `chaxus/ran`，把能力沉淀回生态供三处共享，而不是在本项目里堆 workaround。

---

## 重要约定

1. **不锁定工具版本**：CI 中 pnpm 用 `latest`，Node 用 `lts/*`，保持自动跟随最新
2. **循环依赖处理**：`onlyoffice-editor.ts` 与 `converter.ts` 之间通过回调注入（`setConverterCallbacks`）解耦；`ui.ts` 与 `document.ts` 之间通过 `setUICallbacks` 解耦
3. **编辑器操作队列**：`createEditorInstance` 内部有 `editorOperationQueue`，防止并发创建/销毁编辑器
4. **.claude/ 目录**：已加入 `.gitignore`，不提交本地 Claude Code 配置

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

### OnlyOffice Web Apps 版本升级（7.5.0 → 9.4.0）

**结论：建议升级，与 Agent 协同计划捆绑进行，主要成本在于获取静态文件而非代码改动。**

#### 当前状态

- **当前版本**：`7.5.0 (build: 2024-10-16)`，文件位于 `public/sdkjs/`（~47 MB）、`public/wasm/`（~74 MB）、`public/web-apps/`
- **最新版本**：`9.4.0`（2026-05-20 发布），跨越约 1.5 年、2 个大版本

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

| 改动                                       | 版本   | 影响                                    |
| ------------------------------------------ | ------ | --------------------------------------- |
| `CreateTable(rows, cols)` 参数顺序变更     | v8.0   | 搜索项目中对 `CreateTable` 的调用       |
| `customization.commentAuthorOnly` 参数移除 | v8.x   | 检查 `onlyoffice-editor.ts` 中的 config |
| `installDeveloperPlugin` shim 移除         | v9.3.1 | 若有插件加载逻辑需更新                  |

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

### 当前覆盖率（coverage include 范围内）

| 文件                   | 语句 | 分支 | 函数 | 备注                       |
| ---------------------- | ---- | ---- | ---- | -------------------------- |
| `embed-api.ts`         | 97%  | 91%  | 100% | 接近完整覆盖               |
| `document-utils.ts`    | 89%  | 87%  | 100% | 接近完整覆盖               |
| `i18n.ts`              | 92%  | 65%  | 93%  | 未覆盖部分语言的特定翻译键 |
| `onlyoffice-editor.ts` | ~28% | ~25% | ~41% | 见下方说明                 |

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
