# v9 E2E 回归套件固化 + 它当场抓出的两个冷启动生产 bug（SharedWorker 拼写引擎挂起、fetchFonts 字体竞态）

日期：2026-08-13
分支：feat/v9-web-mode
状态：**回归套件落地并全绿（4/4，约 14 秒）**；调试过程中定位并修复两个只在
"全新浏览器 profile 首次访问"下复现的生产级 bug——真实首次访问用户必踩，
手工测试（热缓存环境）永远发现不了。CLAUDE.md 已同步更新。

## 一、回归套件（用户要求把手工验证用例固化，每次可回归）

- 新增 `playwright.v9.config.ts`（testDir `test/e2e-v9`，端口 4174，webServer
  自动 `vite build --mode v9` + preview，串行执行）+
  `test/e2e-v9/embed-regression.spec.ts`。
- 驱动方式：embed-demo.html 的 postMessage API + 页面内 SheetJS 生成/解析
  工作簿——**仓库不放任何二进制 fixture**，且走的是真实编辑器 + 真实 x2t。
- 四个用例，一一对应迁移期修过的 bug 类：
  1. 多 sheet open-buffer 打开 + 保存往返逐字节完整（#113、#31）
  2. xlsx → PDF 导出，断言 `%PDF-` 魔数（#28 / 错误码 80 场景）
  3. CSV 打开 + 存回 CSV 内容一致（#13、#33）
  4. 只读打开状态正确且保存被拒（#25、#87）
- 接入：`pnpm run test:e2e:v9`；CI e2e job 在 v7 冒烟后追加运行，失败上传
  `playwright-report-v9/`。

## 二、套件首跑即抓出的 bug（根因链，逐层实证）

首跑 3/4 失败（保存类全部超时），但同样操作在开发者的浏览器里全部正常。
逐层排查：

### 根因 1：fetchFonts 字体竞态（打开文档就崩，最核心）

vendor 构建自带的 `window.AscCommon.fetchFonts`（该第三方构建加的，x2t 转换前
收集引擎字体用）**无条件读 `AscFonts.g_font_infos.forEach`**。冷 profile 下
打开文档的内部转换（xlsx→bin）会跑在字体系统初始化完成之前，此时
`g_font_infos` 还是 undefined → `TypeError: Cannot read properties of
undefined (reading 'forEach')` → 转换失败 → `isDocumentLoadComplete` 永远
false → 所有保存/导出静默失效。热环境字体来自缓存、初始化先完成，所以
手工测试从未复现。

**修复**：`prepareEditorIframe()` 给 `AscCommon.fetchFonts` 包守卫——字体
系统未就绪时回调空数组（导入方向转换不需要字体；PDF 导出发生得晚，届时
字体总是就绪的）。

### 根因 2：SharedWorker 拼写引擎挂起

无协作服务器时 SDK 兜底 `new SharedWorker(sdkjs/common/spell/spell.js,
'onlyoffice-spellchecker')`。冷 profile + Service Worker 控制的 origin 下，
SharedWorker 脚本请求在 Chromium 里**永久 pending**（`customization.
features.spellcheck.mode:false` 拦不住引擎加载；SW 侧放行 `/spell/` 路径也
无效——请求根本没走到可响应的层）。热环境免疫的原因很阴险：**同名
SharedWorker 在上一个页面还活着，直接复用、不发新请求**。

**修复**：`prepareEditorIframe()` 在编辑器 iframe 里
`defineProperty(window, 'SharedWorker', undefined)`——SDK 构造器检测不到
SharedWorker 就回退普通专用 Worker，加载正常（spell.js/spell.wasm 均正常
完成，拼写功能保留）。

### 附带加固

- `triggerPersonalDownloadAs` 增加 SDK 公开标志门（`api.isLoadFullApi &&
api.isDocumentLoadComplete`），未就绪返回 false；`requestSaveDocument`
  的 v9 路径改为"等 onDocumentReady（60s 上限）+ 500ms 重试直到 SDK 全量
  就绪"——onDocumentReady 早于全量 API 加载完成，过早开火会被 SDK 静默丢弃。
- sw.js 放行 `/sdkjs/common/spell/`（防御性保留）。

### 调试过程的教训（已写进 CLAUDE.md）

**4174 端口的残留 preview 服务器 + Playwright `reuseExistingServer` = 调试
一个不含新代码的陈旧构建**。中途有两轮"修复无效"其实是修复根本没进产物；
杀干净端口、显式重建后才拿到真实信号。诊断利器：chrome-devtools MCP 的
`isolatedContext`（等价全新 profile，稳定复现"首次访问"）。

## 三、文档更新

- **CLAUDE.md**：开发命令补 v9 全套（dev:v9/build:v9/preview:v9/
  test:e2e:v9）；测试体系补两套 E2E 说明与调试教训；CI 流程补 v9 步骤；
  过时的"OnlyOffice 升级评估"整节替换为已实施方案的现状摘要（底座、集成
  方式、关键代码位置、部署约束、CSV 特例、待办）；删掉两处过期的逐文件
  覆盖率表（改为"以 test:coverage 输出为准"）。
- **README / readme.zh**：不动——v9 尚未成为生产路径，用户向文档等切换
  上线时一并更新（已列入 CLAUDE.md 待办）。

## 验证

- `pnpm run test:e2e:v9`：4/4 通过（约 14 秒，冷启动路径）。
- 302 个单测、lint:ts、format:check 全绿。
- 修复对热环境无行为变化（守卫只在未就绪窗口内生效）。
