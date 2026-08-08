# v9 上线就绪审计——三个问题，都已修复并验证

> **2026-08-08 补充**：本文档"可编辑"的验证方式主要是 API 直调（`asc_getCanUndo`
> 等）加截图看，没有用真实键盘敲过字。后来发现 v9 新建文档在特定情况下会
> 完全打不了字（一个假 WebSocket 连接失败 + 一个主题检测崩溃，两者都会泄漏
> 同一个"操作忙碌计数器"，卡住后挡住所有编辑操作）——根因、修复、验证见
> [2026-08-08：v9 打字完全没反应，根因是假 WebSocket 连接泄漏了忙碌计数器](2026-08-08-v9-typing-broken-websocket-action-leak.md)。
> 已修复，但说明这份审计当时的"可编辑"结论覆盖不完整，以后类似审计应该加上
> 真实键盘输入这一步。

## 背景

用户问"目前 v9 已经达到可以上线的标准了吗？整体都再检查一遍吧"。之前几轮验证
（见 [2026-08-05](2026-08-05-v9-web-mode-build-variant.md)、
[2026-08-06 issue 审计](2026-08-06-v7-issue-audit-and-test-coverage.md)）都是在
`pnpm run dev:v9`（Vite dev server）下测的。这轮换成 `pnpm run build:v9` +
`pnpm run preview:v9`（真·生产构建 + 静态服务），逐项过一遍此前没覆盖的面：生产
构建本身、只读模式、embed API 全链路、PDF 导出、PWA/Service Worker、字体加载
策略。

**首次审计结论（本次修复前）：不能直接上线，两个真·阻塞项，都在"资产层"
（Service Worker 缓存策略、PDF/非原生格式导出），不在编辑器核心。用户随后要求
"先修这两个阻塞项，SEO 后面再说"——本文档下半部分记录了修复过程和验证结果。**
**第二轮结论：两个阻塞项均已修复并实测验证通过；过程中额外发现一个新的、范围
更小的问题（`document:open-buffer` 加载的文档触发保存时可能抛
`P_g` 空指针异常或静默挂起），当时判断为不阻塞、留给下一轮。**
**当前结论：这个问题也已定位真正根因（保存路径的通用异步初始化时序竞争，与
embed/内容都无关）并修复验证通过，三个问题目前全部清零（见下方"修复后新发现，
第二轮也已修复"）。**

## 阻塞项 1（已修复）：Service Worker 是从 `feat/update` 原样抄来的旧版本，会把 App Shell 挤出缓存

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
从更早的 `feat/update` 快照抄过来的，没跟上 v7 主线的修复。

**修复**：把 `public/sw.js` 的缓存策略移植到 `public-v9/sw.js`——core/runtime
两个独立缓存、`DEPLOY_COUPLED` 网络优先策略（列表按 v9 实际拥有的文件精简，见下）、
hashed asset 404 时的错误处理与 shell 刷新。`MAX_RUNTIME_ITEMS` 从 v7 的 600 上调
到 2000（v9 资源树 1507 个文件是 v7 的 5.3 倍，但其中很大一部分是单会话不会碰到的
多语言 help/字体文件，没有照比例线性放大到 3000+，先用 2000 打底，需要用真实
上线后的会话数据回头校准）。同时补了 `public-v9/_headers`（镜像 v7 的思路，路径
换成 v9 的资源结构）和两个此前遗漏的静态文件——`public-v9/home.css`（诊断 SW 问题
时顺带发现：根 `index.html` 引用了它但 `public-v9/` 里从来没有这个文件，生产构建下
一直是 404 落到 SPA fallback，返回 HTML 当 CSS 用，浏览器直接拒绝解析，落地页视觉
样式一直没生效）、`public-v9/lang-switch.js`（v9 目前还没有卫星页面，这个文件暂时
用不上，但既然 `sw.js`/`_headers` 的 `DEPLOY_COUPLED` 列表要精确匹配实际文件，先把
它也补齐，为以后卫星页面上线做准备）。

**验证**：`build:v9` + `preview:v9`，清空 SW/缓存后重新打开首页并新建一个 Word
文档（会拉取几十个 sdkjs/web-apps 运行时资源）——`caches.keys()` 确认两个缓存独立
存在（`document-editor-core-*`：6 项，`document-editor-runtime-*`：48 项，远低于
2000 上限），且 core 缓存里 App Shell（`./index.html`）在这之后依然存在
（`shellPresent: true`），验证了旧版单缓存 100 项上限会把 shell 挤掉的问题不再
发生。`curl -I .../home.css` 确认返回 `Content-Type` 匹配真实文件、`Content-Length`
对应真实字节数（不再是 SPA fallback 的 HTML），落地页的大写小节标题/项目符号分隔
符等 `home.css` 特有样式在截图里可见生效。

## 阻塞项 2（已修复）：PDF 导出（以及任何非原生格式导出）完全不工作

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

**根因定位**：读 `public-v9/web-apps/apps/spreadsheeteditor/main/app.js`（压缩过，
按字节偏移量摘取），逐层跟 `_sendCommand({command:'downloadAs', data})` → iframe 内
`Common.Gateway.on("downloadas", ...)` → Main 控制器的 `onDownloadAs(t)`，找到了
准确断点：

```js
onDownloadAs: function (t) {
  if (this.appOptions.canDownload) {
    // ...算出目标格式 e...
    if (e == Asc.c_oAscFileType.PDF || e == Asc.c_oAscFileType.PDFA)
      Common.NotificationCenter.trigger('download:settings', this, e, !0); // <- PDF/PDFA 走这条
    else {
      var o = new Asc.asc_CDownloadOptions(e, !0);
      o.asc_setIsSaveAs(!0);
      this.api.asc_DownloadAs(o); // <- 原生格式走这条，直接调 asc_DownloadAs
    }
  }
}
```

原生格式（docx/xlsx/pptx 匹配当前文档类型）直接调 `this.api.asc_DownloadAs(o)`——
正是我们在 [2026-08-05](2026-08-05-v9-web-mode-build-variant.md) patch 过的那个
函数，所以能正常触发离线保存触发器。但 PDF/PDFA **无条件**改走
`Common.NotificationCenter.trigger('download:settings', ...)`，这是 OnlyOffice
真实产品里"打开一个页面范围/打印设置面板，用户点面板自己的下载按钮才真正调用
`asc_DownloadAs`"的标准交互——不是 v9 特有的判断分支，v7 的
`spreadsheeteditor/main/app.js` 里同一段 `download:settings` 触发逻辑原样存在
（grep 到 5 处）。v9 Web Mode 没有一个真实、可交互的设置面板能让这次触发走完，
所以 PDF/PDFA 请求在这里就停住了，`asc_DownloadAs` 永远不会被调用——不是"请求被拦住
了"，是设计上 PDF 导出从来就不是一次 API 调用能完成的事，只是原生格式恰好抄了近路。

**修复**：仿照已有的 `suppressCoAuthoringDisconnect`（拦截 `api:disconnect`
通知）的模式，新增 `suppressDownloadSettingsDialog`，同样 patch
`Common.NotificationCenter.trigger`，专门拦截 `'download:settings'` 事件：不再
放行给真正打开设置面板的监听器，而是直接调用（已经被 Ncj/DOj/mTi patch 过的）
`api.asc_DownloadAs()`，绕开这个面板走完整个流程。`handleSaveDocument` 本身的
"非原生格式导出"处理逻辑不用动——如果 `embeddedSaveRequest.targetExt` 是
`'PDF'`，它已经会正确地把 `convertBinToDocumentFn` 的第三个参数设成 `'PDF'`，
x2t 那边转换本身没问题（v7 的 PDF 导出用的是同一段
`packages/converter/src/document-converter.ts` 代码，issue #28 记录过这条路径
本来就修过一次）——缺的只是"怎么让 `asc_DownloadAs` 真的被调用"这一步。

**验证**：用 spy 包一层 `api.asc_DownloadAs` 确认之前"完全没被调用"的问题已解决——
`New Excel` 新建文档后直接调 `window.editor.downloadAs('PDF')`，`handleSaveDocument`
正确触发（"Save document event:" 日志出现，此前这条路径连日志都不会有）。

**影响**：修复前，"导出为 PDF"这个功能点在 v9 里是完全不可用的（不是"部分能用"
或"格式有瑕疵"，是请求悄无声息地消失）。现在通过 `New Word/Excel/PowerPoint` 或
真实文件上传打开的文档，PDF 导出能正确触达转换逻辑。

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

## 额外发现（已修复）

- **`public-v9/manifest.json` 的 app 名字对不上**：写的是从 `feat/update`
  原样抄来的 `"ByBrowser — Browser-Only Document Editor"`，跟这个产品实际的
  名字（v7 manifest 里的 `"Document Editor"`，落地页标题
  "Open Word, Excel & PowerPoint files, right in your browser."）完全不一致。
  PWA 安装到桌面/主屏幕时，图标下面显示的名字会是错的。**已改成与 v7 一致的
  `"Document Editor"`/`"Editor"`，`theme_color` 也改回 v7 的 `#ffffff`**（原
  `#0052cc` 判断是照抄 `feat/update` 时漏改，没有找到任何"v9 品牌色应该不同"的
  依据）。

## 修复后新发现，第二轮也已修复：`document:open-buffer` 保存时 `P_g` 空指针

- **一个测试方法论的坑，记录下来避免下次踩**：想验证"打开一个真实多 sheet
  文件后再多 sheet 是否正常"时，第一反应是对着已经渲染完成的编辑器实例再调一次
  `api.asc_openDocumentFromBytes()`省事——结果内部状态（`asc_getWorksheetsCount()`）
  更新了，但 UI 完全没跟着刷新（还是显示旧文档）。这不是产品 bug，是
  `asc_openDocumentFromBytes` 本身只设计给"编辑器刚创建、第一次加载"这个
  场景用，不支持对运行中的编辑器"热替换文档"。后续测"已打开文档"相关的行为，
  必须走真实的文件上传或全新页面加载，不能用这个捷径。

**结论**：最初以为是 `document:open-buffer` 这条打开路径特有、与内容
（SheetJS 生成的 xlsx）相关的 bug，排查了八轮假设都被推翻（详见下方"排查过程"），
最终真相是一个**通用的时序竞争**，任何调用方式都可能触发，只是 embed API
场景下最容易踩中：`asc_openDocumentFromBytes` 调用后立即返回，但引擎内部初始化
（字体异步加载、`za` 等内部状态类的构造）还要再等约 5–6 秒才真正完成；这期间
如果触发保存（无论是原生格式还是 PDF），会在 SDK 内部深处抛
`TypeError: Cannot read properties of null (reading 'P_g')`，或者更隐蔽地——
`editor.downloadAs()` 的 postMessage 握手本身也没准备好，保存请求直接静默挂起、
最终吃满 60 秒超时，且完全不留错误日志。之前"New Word/Excel/PowerPoint"和真实
文件上传路径之所以没有暴露这个问题，只是因为人工点击操作天然有几秒钟的反应
延迟，凑巧总是晚于这个 5–6 秒窗口，不是这两条路径有什么特殊之处。

**修复**：在 `lib/onlyoffice-editor.ts` 里监听 SDK 官方公开的
`asc_onDocumentContentReady` 事件（`runWebModeOnAppReady` 里本来就已经注册了这个
回调，用来做别的 UI 收尾工作，这次只是多接了一个"标记就绪"的信号），并用它同时
网住两条保存入口：

1. **离线保存触发器**（`Ncj`/`DOj`/`mTi`，工具栏 Save 按钮、`asc_Save`、
   `asc_DownloadAs` 最终都会落到这里）——未就绪时不再直接调用，而是把调用推进
   一个等就绪后再执行的队列，就绪信号一到就按顺序补跑。
2. **`requestSaveDocument()`**（embed API `document:save` 的唯一入口，也是本次
   问题的实际触发点）——`embeddedSaveRequest`
   锁和两级超时仍然同步立即生效（保证"重复 save 请求"的报错时机不变），但真正
   调用 `editor.downloadAs()` 那一步会等就绪后再执行；已就绪（正常情况，包括
   v7 全程和 v9 就绪之后的 v9）时仍然完全同步调用，不引入任何延迟。

有个中间版本踩了一个坑记录一下：一开始把等待逻辑写成 `async`/`await`——哪怕
`await` 的是一个已经 resolve 的 Promise，也会让后续代码推迟到下一个微任务再跑。
SDK 自己的 `downloadAs` postMessage 握手期望离线保存触发器在被调用的**同一个
事件循环 tick 内同步执行完**，这个几乎无感的延迟就足以让握手对不上、保存请求
彻底没有任何响应（不报错，也不成功）。改回"已就绪就直接同步调用，未就绪才用
普通回调队列（不是 Promise 链）延后"之后问题才真正消失。加了 15 秒兜底：万一
`asc_onDocumentContentReady` 因为某些未知原因没有触发，也会强制放行排队的保存
请求，避免无限挂起。

**验证**：chrome-devtools MCP 实测两种场景——(1) `document:open-buffer` 打开后
立刻（约 170ms 后）发 `document:save`，不再抛 `P_g` 异常，保存被延后到约
6 秒后自动补跑，`document:saved` 正常带回真实文件（约 6.2 KB）；(2) 打开后等待
8 秒（超过就绪窗口）再发 `document:save`，229ms 内同步完成，与修复前行为一致，
证明快速路径没有引入延迟回归。`pnpm run lint:ts`、`pnpm run test:coverage`
（288 个单测）、`pnpm run format:check` 全绿。

**排查过程（八轮被推翻的假设，记录下来避免下次重复踩坑）**：最初怀疑是
"embed 模式不渲染可见 UI，某个依赖真实绘制过一帧的初始化钩子没机会触发"，
或者是 SheetJS 生成的 xlsx 比预置模板多出 `xl/metadata.xml`（XLDAPR 动态数组
扩展）导致导入器少初始化了什么，逐一用 chrome-devtools MCP 实测排除：iframe
尺寸正常、非隐藏；同样的预置模板内容走 `document:open-buffer` 完全正常；
手工剥离 `xl/metadata.xml` 后问题依旧存在；base64 编解码往返字节级校验无损坏；
x2t 初始化状态对 v9 的打开路径完全不起作用（`handleDocumentOperation` 对 v9
非新建文档直接跳过 x2t）；`createEditorInstance` 只被调用一次，无并发竞争。
真正的突破口是给 `api.za`（保存路径依赖的一个内部状态对象）加了一个属性
setter 陷阱去抓调用栈：它是被一个字体加载队列（`Ncd`/`pUg`，每 50ms 轮询一次
"字体是否加载完成"）处理完毕后才异步赋值的，且这个赋值时间点与官方公开事件
`asc_onDocumentContentReady` 几乎同时触发（实测相差仅 64ms）——这才定位到"是
异步初始化的时序问题，不是 embed/内容特有的问题"这一真正根因。

## 验证方式

- `pnpm run build:v9` 构建成功（有一个跟这次改动无关的预置警告：`lib-*.js`
  超过 500KB，SheetJS 打包体积问题，v7/v9 共用）
- `pnpm run preview:v9` + chrome-devtools MCP 实测（首次审计 + 本轮修复验证共
  两轮）：Word/Excel/PPT 新建+保存、只读模式（真实 xlsx via
  `?src=`+`?readonly=true`）、embed API 全链路（open-buffer→get-state→save）、
  字体按需加载（网络面板核对）、Service Worker 双缓存分离（`caches.keys()` +
  `shellPresent` 检查）、`home.css` 内容返回正确（`curl -I` 核对 `Content-Type`/
  `Content-Length`）、PDF 导出（spy 包 `asc_DownloadAs` 确认从"完全不触发"变成
  "正确触发 `handleSaveDocument`"）
- `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage` 全绿，
  288 个单测（本轮修复未新增测试用例——改动集中在 vendored SDK 的运行时 patch
  逻辑和静态资产文件，不是新的可单测导出函数；`suppressDownloadSettingsDialog`
  跟同类的 `suppressCoAuthoringDisconnect`/`suppressDialogsInFrame` 一样依赖
  真实 iframe + `Common.NotificationCenter`，只能靠 chrome-devtools MCP 实测）
- Service Worker/manifest/`_headers` 内容通过直接 diff `public/` 与
  `public-v9/` 下对应文件确认；`_headers` 的 Cache-Control 头本身依赖 Cloudflare
  Pages 的边缘行为，本地 preview server 不解析这个文件，需要真实部署后再核实一遍

## 上线前仍需做的事

1. `MAX_RUNTIME_ITEMS = 2000` 是估算值，没有真实会话数据支撑，上线后应该用
   Cloudflare Pages 的真实访问模式回头校准（太小会重演阻塞项 1 的问题，太大有
   浏览器存储配额压力）
2. `public-v9/_headers` 里 `Cache-Control` 头是否真的按预期在 Cloudflare Pages
   生效，需要一次真实部署后核实（本地 preview server 不解析这个文件）

以上都不涉及编辑器核心链路，且都不是本轮已修复问题的回归风险，可以在 v9 正式
上线后按优先级排期，不必阻塞发布。
