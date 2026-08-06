# v9 上线就绪审计——两个阻塞项，都在缓存/导出层，不在编辑器核心

## 背景

用户问"目前 v9 已经达到可以上线的标准了吗？整体都再检查一遍吧"。之前几轮验证
（见 [2026-08-05](2026-08-05-v9-web-mode-build-variant.md)、
[2026-08-06 issue 审计](2026-08-06-v7-issue-audit-and-test-coverage.md)）都是在
`pnpm run dev:v9`（Vite dev server）下测的。这轮换成 `pnpm run build:v9` +
`pnpm run preview:v9`（真·生产构建 + 静态服务），逐项过一遍此前没覆盖的面：生产
构建本身、只读模式、embed API 全链路、PDF 导出、PWA/Service Worker、字体加载
策略。

**结论：不能直接上线。两个真·阻塞项，都在"资产层"（Service Worker 缓存策略、
PDF/非原生格式导出），不在编辑器核心（打开/编辑/保存 docx/xlsx/pptx 这条主链路
本身没问题，生产构建下逐项复测过一遍全部通过）。**

## 阻塞项 1：Service Worker 是从 `feat/update` 原样抄来的旧版本，会把 App Shell 挤出缓存

`public-v9/sw.js`（4KB，未改过）和 v7 现在跑的 `public/sw.js`（7.5KB，经过多轮
修复）是两个完全不同版本。diff 出来 v9 缺了 v7 后来加的所有修复：

- **单一缓存 + `MAX_CACHE_ITEMS = 100`，没有 core/runtime 拆分**——这正是 v7 自己
  文档里描述过的、已经踩过的坑（"the old single 100-item cache was constantly
  evicting its own shell"）。`limitCacheSize()` 在每次 `cache.put()` 后都会跑，
  超过 100 项就删掉最早写入的（`keys[0]`），而最早写入的恰恰是 `install` 阶段
  缓存的 App Shell（`index.html`/`manifest.json`/核心 JS）。
- v9 的 `sdkjs/` + `web-apps/` 资源树有 **1507 个文件**（v7 只有 284 个）——只要
  打开一次编辑器，运行时缓存策略（stale-while-revalidate）就会把这些文件往同一个
  缓存里塞，很快超过 100 项上限，把刚装好的 App Shell 挤出去。
- 没有 v7 后来加的 `DEPLOY_COUPLED` 网络优先策略（给 `ran-tokens.css`/
  `lang-switch.js` 这类"文件名不变但内容每次部署都变"的文件用）、没有对
  hashed asset（`/assets/*`）的非 200 响应做错误处理（会退化成用 HTML 内容当
  JS/CSS 用，报 MIME type 错误）——这两个都是 v7 在
  [2026-07-05](2026-07-05-sw-stale-build-auto-reload.md)/
  [2026-07-11](2026-07-11-sw-cache-and-create-entries.md) 两篇文档里记录过的
  真实故障复盘，v9 目前会原样重犯。

**影响**：落地页明确写了"PWA · OFFLINE — 断网也能用"，这是主打卖点之一。当前
v9 的 Service Worker 配置下，这个承诺大概率兑现不了——用几次之后离线打开可能连
主页壳都加载不出来。

**同时发现**：`public-v9/` 下没有 `_headers` 文件（Cloudflare Pages 的显式缓存
头配置），v7 有一份专门写的、注释详细的 `public/_headers`（hashed asset 设
`immutable`、`sw.js`/HTML 设 `no-cache`，防止"部署后引用的 hashed 文件已经不
存在"这类故障）。v9 目前完全依赖 Cloudflare 默认行为，没有这层保险。

**结论**：v9 的静态资产/缓存层基本没有从 v7 后续的加固里受益，这次 v9 移植工作
的精力全部投在了 OnlyOffice SDK 集成层（`onlyoffice-editor.ts`），资产层是原样
从更早的 `feat/update` 快照抄过来的，没跟上 v7 主线的修复。上线前必须把 v7 的
`sw.js`/`_headers` 改进移植过来，并针对 v9 更大的资源树（1507 vs 284 个文件）
重新评估缓存容量上限——`MAX_CACHE_ITEMS = 100` 对 v9 完全不够用，需要按 v7 那样
拆分 core/runtime 两个缓存，且 runtime 上限要显著提高（v7 是 600，v9 资源更多，
可能还需要更高）。

## 阻塞项 2：PDF 导出（以及任何非原生格式导出）完全不工作

上一轮修复的 Save/DownloadAs 重定向（`Ncj`/`DOj`/`mTi` 离线保存触发器，见
[2026-08-05 文档](2026-08-05-v9-web-mode-build-variant.md)）只覆盖了"存成文档
自己的原生格式"这一种情况（docx 存 docx、xlsx 存 xlsx、pptx 存 pptx）。这次专门
测了 `requestSaveDocument('PDF', ...)`（对应 embed API 的
`document:save { targetExt: 'pdf' }`，也是用户在 UI 上点"导出为 PDF"时走的同一
条代码路径）：

- 用 spy 包了一层 `api.asc_DownloadAs`，确认调用 `window.editor.downloadAs('PDF')`
  时**这个函数根本没被调用过**——不是"调用了但返回错误格式"，是请求在更早的
  地方（`window.editor.downloadAs()` 内部的 `_sendCommand` → iframe 侧的命令
  路由）就被吞掉了，没有任何日志、任何错误，静默无响应。
- 对照测试：同一份文档，`downloadAs('XLSX')`（原生格式）稳定成功；
  `downloadAs('PDF')`（非原生格式）稳定无响应，重复测了三次结果一致。
- 通过 `document:save { targetExt: 'pdf' }`（`requestSaveDocument` 的 60 秒
  超时机制）也没能补救——因为请求根本没有触发任何后续事件，只能干等到超时。

**没有深挖到底层根因**（这次任务是"审计现状"不是"修复"，根因定位留给下一轮）。
从代码看，`handleSaveDocument` 本身对"非原生格式导出"的处理逻辑是对的——如果
`embeddedSaveRequest.targetExt` 是 `'PDF'`，它会正确地把 `convertBinToDocumentFn`
的第三个参数设成 `'PDF'`，x2t 那边转换本身没问题（v7 的 PDF 导出用的是同一段
`packages/converter/src/document-converter.ts` 代码，issue #28 记录过这条路径
本来就修过一次）。断点在更上游：v9 Web Mode 精简过的编辑器配置（缺少真实
license/协同服务器）导致 iframe 内部的命令路由在遇到"目标格式 ≠ 当前文档类型"
时被拦住了，没有走到 `asc_DownloadAs`。

**影响**："导出为 PDF"这个功能点，在 v9 里是完全不可用的（不是"部分能用"或
"格式有瑕疵"，是请求悄无声息地消失）。如果产品页面/落地页有导出 PDF 相关的
承诺或者用户预期，这是一个功能倒退。

## 已确认没问题的部分（生产构建下逐项复测）

- **核心编辑流程**：Word/Excel/PowerPoint 三种类型新建文档 → 编辑 → 保存，在
  `build:v9` + `preview:v9`（不是 dev server）下全部复测通过，字节数与上一轮
  dev 模式下测的结果一致（Word 34424 字节、Excel 3658 字节、PPT 28302 字节）。
- **只读模式**（对应 issue #85/#87"预览模式"）：`?src=<url>&readonly=true`
  打开真实文件后，工具栏正确收窄成只有"文件"/"视图"两个菜单，`mode=view`
  正确传入 iframe config，视觉上确认是只读渲染。
- **embed API 全链路**：`document:open-buffer`（真实 base64 xlsx payload）→
  `document:opened` → `document:get-state` → `document:save`（原生格式）→
  `document:saved`（带正确的 `fileName`/`size`/`file`）全部走通。
- **字体按需加载**（回应 issue #22"升级 v9 能否减少字体加载"）：新建一个空白
  Word 文档，网络面板显示只请求了约 10 个具体字体文件（DejaVuSans 系列、
  LiberationSans 系列、NotoSansSC-Regular），不是把 `public-v9/fonts/` 下全部
  33 个文件都加载一遍——`font-map.json` + XHR 拦截的按需加载机制确认生效。
  **但打包体积本身反而更大**（v9 fonts 目录 186MB/33 文件 vs v7 139MB/25
  文件）——issue #22 说的"更少字体加载"说的是运行时按需拉取的数量，不是构建
  产物体积，这点在回复 issue 时需要说清楚，避免误导。

## 额外发现（不阻塞，但要修）

- **`public-v9/manifest.json` 的 app 名字对不上**：写的是从 `feat/update`
  原样抄来的 `"ByBrowser — Browser-Only Document Editor"`，跟这个产品实际的
  名字（v7 manifest 里的 `"Document Editor"`，落地页标题
  "Open Word, Excel & PowerPoint files, right in your browser."）完全不一致。
  PWA 安装到桌面/主屏幕时，图标下面显示的名字会是错的。`theme_color` 也不同
  （`#0052cc` vs v7 的 `#ffffff`），不确定是有意为之还是照抄漏改，需要确认。
- **一个测试方法论的坑，记录下来避免下次踩**：想验证"打开一个真实多 sheet
  文件后再多 sheet 是否正常"时，第一反应是对着已经渲染完成的编辑器实例再调一次
  `api.asc_openDocumentFromBytes()`省事——结果内部状态（`asc_getWorksheetsCount()`）
  更新了，但 UI 完全没跟着刷新（还是显示旧文档）。这不是产品 bug，是
  `asc_openDocumentFromBytes` 本身只设计给"编辑器刚创建、第一次加载"这个
  场景用，不支持对运行中的编辑器"热替换文档"。后续测"已打开文档"相关的行为，
  必须走真实的文件上传或全新页面加载，不能用这个捷径。
- **`document:save` 在文档尚未完全加载完成时调用会卡住整整 60 秒**：不是
  bug（`requestSaveDocument` 的锁+超时机制本身设计上就是这样，v7 也共享同一段
  逻辑），但值得记录：如果宿主页面在收到 `document:opened` 后立刻发
  `document:save`，而编辑器内部还没真正 ready，这次 save 请求会静默挂起直到
  60 秒超时才释放锁，期间任何后续 save 请求都会立刻收到"A save request is
  already in progress"错误。embed API 使用文档里可以补一句：`document:opened`
  只代表"打开命令已发出"，不代表编辑器已经完全可交互，建议加个 1-2 秒缓冲或
  轮询 `document:get-state` 再发 save。

## 验证方式

- `pnpm run build:v9` 构建成功（有一个跟这次改动无关的预置警告：`lib-*.js`
  超过 500KB，SheetJS 打包体积问题，v7/v9 共用）
- `pnpm run preview:v9` + chrome-devtools MCP 实测：Word/Excel/PPT 新建+保存、
  只读模式（真实 xlsx via `?src=`+`?readonly=true`）、embed API 全链路
  （open-buffer→get-state→save）、PDF 导出（确认失败）、字体按需加载（网络
  面板核对）
- Service Worker/manifest/`_headers` 差异通过直接 diff `public/` 与
  `public-v9/` 下对应文件确认，未做浏览器内实测（离线场景需要真实部署环境，
  本地 preview server 不适合验证 Cloudflare Pages 的 `_headers` 行为）

## 上线前必须做的事（按优先级）

1. 把 v7 `public/sw.js` 的缓存策略移植到 v9（core/runtime 拆分、
   `DEPLOY_COUPLED` 网络优先、hashed asset 错误处理），并针对 v9 更大的资源树
   重新调 `MAX_RUNTIME_ITEMS`
2. 补 `public-v9/_headers`（照抄 v7 的思路，路径改成 v9 的资源结构）
3. 定位并修复 PDF/非原生格式导出为什么没有触达 `asc_DownloadAs`——这个不修，
   "导出 PDF"这个入口在 v9 上线后就是个静默失效的死按钮
4. 改 `public-v9/manifest.json` 的 `name`/`short_name`（顺手确认 `theme_color`
   是否要跟 v7 保持一致）

以上都不涉及编辑器核心链路，预计工作量不大，但**在这几项完成之前，不建议把
v9 作为默认体验推给真实用户**——尤其是 Service Worker 那条，"离线可用"是当前
落地页的核心卖点之一，实际效果和承诺不符是会被用户直接感知到的落差。
