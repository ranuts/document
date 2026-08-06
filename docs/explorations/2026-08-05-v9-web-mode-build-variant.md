# v9 作为独立构建变体落地（Web Mode 复活）

日期：2026-08-05
分支：feat/v9-web-mode
涉及：`lib/onlyoffice-editor.ts`、`lib/converter.ts`、`lib/empty_bin-v9.ts`、
`lib/media-player.ts`、`vite.config.ts`、`bin/build.sh`、`package.json`、
`public-v9/**`、`types/editor.d.ts`、`packages/shared/src/document-types.ts`

## 背景

`docs/superpowers/plans/2026-06-28-monorepo-v7-v9-split.md` 规划的
`apps/web-v7` + `apps/web-v9` 双 app 共享 packages 方案，讨论后判定太重——
真要做要吞掉分叉分支合并、git 资源翻倍、Agent 接口适配这几个硬骨头。改成
更轻量的路线：**v9 作为现有单一 app 的一个构建变体**（`vite --mode v9`
切 `publicDir`/`outDir`），独立部署，不碰 v7 默认生产路径，不新建 `apps/`
目录。

## 技术路线：Web Mode，不是 Desktop Mock

v9.3.0 的离线加载有两条已知路径，都在 `feat/update`（旧的、已放弃的
apps/ + `@bybrowser` monorepo 尝试）分支的 exploration 文档里验证过：

- **Desktop Mock**（`upgrade/onlyoffice-9.3.0` 分支）：伪装 `window.AscDesktopEditor`，
  文档能渲染但工具栏永远空——`isDesktopApp=true` 时 SDK 假设工具栏由原生 UI
  提供，`createDelayedElements()` 根本不跑。已判定死路。
- **Web Mode**（这次采用的路线）：不伪装桌面版，伪造最小 Engine.IO 握手骗过
  SDK 的"已连服务器"检测，文档通过 `asc_openDocumentFromBytes` 同源直接注入。
  2026-06-19 的调试记录显示 Word/Excel/PPT 全部工具栏完整可用——这条路线
  技术上早就跑通了，只是后来转向双 app 规划后被搁置，从未真正遗弃过。

这次做的事：把 Web Mode 的实现从废弃分支里取出来，移植到现在（经过 6 周多
v7 迭代、刚做完 #113 修复）的 `lib/onlyoffice-editor.ts` 里，用一个
`OO_VARIANT` 常量做版本分支，而不是复制整个文件。

## 关键实现点

- **`OO_VARIANT`**：`import.meta.env.MODE === 'v9' ? 'v9' : 'v7'`，靠
  `vite --mode v9` 触发，不需要额外的自定义环境变量。
- **`editorSendCommand`**：v9 把 `sendCommand` 改名成了 `serviceCommand`；
  这个 wrapper 优先尝试 `serviceCommand`，没有则退回 `sendCommand`，两个版本
  用同一套调用点，不用逐处加判断。
- **`suppressDialogsInFrame`**：v9 Web Mode 没有真实协同服务器，"Connection
  is lost" 类对话框每次都会弹，走的是 `Common.UI.alert` 不是 `.warning`。
  按消息文本匹配抑制，**这是 locale 相关的**——目前只覆盖了英文和 zh-CN
  （实测踩到的那句"使用文档时出错"），其他语言要用到时再补。
- **`runWebModeOnAppReady`**：`onAppReady` 里 280 行左右的移植逻辑，核心是：
  等 SDK 内部 `mainCtrl.appOptions`/`.document` 就绪 → 伪造 license/权限响应
  （SDK 等的是一个不存在的服务器授权响应，2 秒超时后手动触发）→ patch
  `Shc/BRj`（Word）、`Mrc/rxk`（Cell）、`K8b/Fzj`（Slide）这几个混淆过的
  SDK 内部网关函数，让它们始终走"Web 路径"而不是被我们的 `AscDesktopEditor`
  polyfill 误导去走"Desktop 路径"（后者会丢弃文档字节，不喂给 WASM）→
  `asc_openDocumentFromBytes` 注入 → 处理 word/cell/slide 三种编辑器各自不同
  的 "openedAt gate"（没有真实服务器的 auth 响应，SDK 会卡在 100% 加载但不
  触发 `asc_onDocumentContentReady`）。这些函数名是这份具体 SDK 构建的混淆
  符号，换一个 x2t/sdkjs 版本大概率对不上，不要脱离验证过的资源版本改这段。
- **`lib/converter.ts`**：v9 的 open 路径整个跳过 x2t——`asc_openDocumentFromBytes`
  是 SDK 自带的 OOXML 导入器，直接喂原始文件字节即可，喂 x2t 转换出的
  `.bin` 格式反而是错的。x2t 仍然用于保存/导出（`convertBinToDocument*`
  不受影响）。
- **`lib/empty_bin-v9.ts`**：v9 新建文档需要**原始 OOXML**空模板（docx/xlsx/pptx
  各一份 base64），跟 v7 的 `g_sEmpty_bin`（x2t 内部 `.bin` 格式）不是一回事，
  两者不能混用。
- **`public-v9/onlyoffice-iframe-patch.js`**：客户端 XHR 拦截，纯静态、不需要
  服务端。新增的 Engine.IO 握手 mock（协议字节已经在 `feat/update` 的
  `onlyoffice-engineio-handshake.ts` 里逆向清楚，这次是把它从 **Vite dev-server
  中间件**移植成**浏览器内 XHR 拦截**——前者只在 `vite dev`/`preview` 生效，
  从没在真正的静态生产环境跑通过，这是真正的新工作，不是照抄）。

## 踩的坑（构建工具 + 资源）

- **x2t.js 里 `new URL(mySrc)` 崩溃**：v9 这份 x2t.js 的 pre-js 代码假设
  加载它的 `<script>` 标签 `src` 属性是绝对 URL，但我们这边给的是相对路径，
  `new URL()` 单参数形式直接抛 `Invalid URL`。改成 `new URL(mySrc, document.baseURI)`
  两参数形式解决，没有动 x2t.js 其余逻辑。
- **`x2t.wasm.gz` 缺失，且不能简单改名充数**：从 `feat/update` 复制过来的
  资源只有 `x2t.wasm`（原始）没有 `.gz`，而 `packages/converter` 固定去
  fetch `.gz` 路径。第一次尝试直接把 `x2t.wasm` 复制改名成 `x2t.wasm.gz`，
  结果本地开发服务器按扩展名自动加了 `Content-Encoding: gzip` 响应头，
  但内容根本不是 gzip，浏览器解码失败（`ERR_CONTENT_DECODING_FAILED`）。
  改成真的 `gzip -9` 压缩后解决，副作用是体积从 36MB 降到 9.6MB。
- **Service Worker 缓存导致"修复了但还是报旧错"**：改完 x2t.js 之后重新
  reload 页面还是报同一个 `Invalid URL` 错误，反复确认代码没问题——后来
  发现是 PWA Service Worker 把旧版本 `x2t.js` 缓存住了，DevTools 的
  "reload ignoreCache" 只清浏览器 HTTP 缓存，不会清 SW 自己的 Cache Storage。
  手动 `unregister()` + 清 `caches` 才刷新。以后改 `public-v9/` 下任何被
  SW 缓存的文件，记得这一步。
- **`document_editor_service_worker.js` 注册失败**：SDK 自己会尝试注册这个
  service worker（大概是给 Desktop/Document Server 场景用的协同功能），
  文件不存在时走 SPA fallback 返回 `index.html`，MIME 类型不对导致注册报错
  （不是致命错误，但控制台一直报红）。放一个空 stub 文件解决。
- **`.oxlintrc.json` / `.prettierignore` 没排除 `public-v9/`**：跟 `public/`
  一样大的 vendored 资源树，oxlint 扫描直接超时（120s），prettier 更狠接
  直接栈溢出崩溃（V8 stack overflow，多 MB 的压缩 JS 单行文件超出它的解析
  能力）。两边都加了排除。
- **`.gitignore` 里 `dist` 不是前缀匹配**：`dist-v9/` 构建产物一开始没被忽略，
  gitignore 的裸 `dist` 只精确匹配这个名字，补了一条 `dist-v9`。

## 已验证（chrome-devtools MCP 实测，两轮）

**第一轮**（新建文档 + 生产构建）：

- `pnpm run dev:v9`：新建 Word、Excel 都能打开，工具栏完整（对照
  Desktop Mock 时代"工具栏永远空白"的失败模式，这是最关键的回归验证）、
  `isEdit: true`、能输入光标可见、无阻塞对话框（zh-CN 和 en 都测过）
- `pnpm run build:v9` → `pnpm run preview:v9`：生产构建同样验证通过，
  确认客户端 Engine.IO 握手拦截在真·静态环境下也生效（不只是 dev 模式）

**第二轮**（"把功能都验证一遍"，逐项补全上一轮标记为"未验证"的项）：

- **New PowerPoint**：第一次测试直接卡死在"正在载入演示文稿"，控制台里是
  `sdk-all-min.js` 内部一个未捕获的 Promise rejection（`K8b`/`Fzj` 网关
  patch 触发路径）。根因是 `lib/empty_bin-v9.ts` 的 pptx 模板缺 SDK 加载器
  依赖的部分（`preprocessPptx` 打了补丁但没补全），改成 fetch
  `sdkjs/slide/themes/src/01_blank.pptx`（一份真实完整的空白演示文稿，跟
  `feat/update` 原实现一致）后解决——**这是真 bug，已修**（见下方修复列表）。
- **打开已上传的真实 docx**：通过 chrome-devtools 的 `upload_file` 传了一个
  4KB 的真实 docx，`asc_openDocumentFromBytes` 直接吃原始字节（没有走 x2t），
  工具栏完整、`文档加载完成`——确认"打开已有文件"这条路径（不只是"新建空白
  文档"）也是通的。
- **CoAuthoringDisconnect 导致 Save/Print 被隐藏**：测 PowerPoint 点"文件"
  菜单时第一次弹出了一个此前没见过的 zh-CN 对话框（"连接失败。您仍然可以
  查看文档...但无法下载或打印"），同时工具栏上保存/打印相关按钮全部变灰。
  读 `app.js` 源码确认根因：假的 Engine.IO 握手没有实现真正的 ping/pong
  保活，SDK 过一段时间就判定协同连接断开，触发
  `asc_onCoAuthoringDisconnect`/`Common.NotificationCenter` 的
  `"api:disconnect"` 事件，两条路径都会隐藏下载/打印按钮——**这是真 bug，
  已修**（见下方）。
- **Save / "下载为" 实际不产生文件——确认是真问题，不是测试假象**：
  绕过所有 UI 点击（工具栏按钮点击、`window.editor.downloadAs()` 直接调用、
  甚至直接调 iframe 内部的 `mainCtrl.onDownloadAs()`），全部会静默"成功"但
  不触发我们的 `handleSaveDocument`。用 monkey-patch 确认 `AscDesktopEditor.
LocalFileSave` 真的被调用了——顺着 `asc_DownloadAs`→`asc_Save`(`.oja`)→
  `window.DesktopOfflineAppDocumentStartSave`→`AscDesktopEditor.LocalFileSave`
  这条链路读源码，发现 v9 的 `asc_Save` 内部**无条件**走这条"桌面本地保存"
  路径（不像打开文档的 `Shc/BRj` 那样有一个"网页路径"可以强制切过去）——这条
  路径是为真实桌面 App 设计的：native 层写文件，浏览器端的 `LocalFileSave`
  参数里根本不包含文档字节，只有"另存为/文件名"这类选项。也就是说，v9 Web
  Mode 目前**没有等价于"打开文档"的、能把保存后的字节交还给页面的路径**。
  文字输入本身也验证不了（`type_text`/`press_key` 无法让内容落进 iframe 里
  那个真实存在、且确认已 focus 的隐藏 `<textarea id="area_id">`，这部分是
  chrome-devtools 自动化的已知局限，跟这次改动无关），但 Save 这个问题已经
  绕过了所有 UI 层面的不确定性，是可以在真人操作下同样复现的架构性缺口。

## 本轮修复（2026-08-06）

1. `lib/onlyoffice-editor.ts`：pptx 新建文档改成 fetch 真实的
   `01_blank.pptx` 模板（`.docx`/`.xlsx` 仍用 `empty_bin-v9.ts` 的 base64）。
2. `lib/onlyoffice-editor.ts`：新增 `suppressCoAuthoringDisconnect()`，
   patch `Common.NotificationCenter.trigger` 吞掉 `'api:disconnect'`；
   把 `mainCtrl.appOptions.canDownload`/`canPrint` 用
   `Object.defineProperty` 钉死为 `true`，防止 `setMode({isDisconnected:
true})` 之后又被悄悄改回 `false`（`onDownloadAs` 在 `canDownload` 为
   false 时会静默走 `Gateway.reportError`，没有任何控制台输出，非常容易被
   误判成"点击没生效"）。
3. `suppressDialogsInFrame` 的匹配列表补了第二条 zh-CN 字符串
   （"连接失败"），跟第一条（"使用文档时出错"）是同一个
   `CoAuthoringDisconnect` 事件的两种不同措辞。
4. **保存/下载不产生文件——已修复**（原第二轮末尾记录的架构性缺口）。读
   `sdk-all-min.js` 源码确认：`asc_DownloadAs`(`.iZd`，仅 cell 有这个独立
   入口)/`asc_Save`(`.oja` word/slide、`.xxa` cell)最终都走
   `DesktopOfflineAppDocumentStartSave` → `AscDesktopEditor.LocalFileSave`，
   这条链路是给真实桌面壳"原生写盘"用的，浏览器端的 `LocalFileSave` 桩函数
   参数里根本不含文档字节，只有文件名/另存为选项——跟"打开文档"的
   `Shc/BRj`、`Mrc/rxk`、`K8b/Fzj` 不同，这里**没有**现成的"网页路径"可以
   直接切过去。但每个引擎另外各自暴露一个独立的"离线保存触发器"内部方法
   （word `Ncj`、cell `DOj`、slide `mTi`），在 `asc_isSupportFeature('ooxml')`
   为 true 时（这份构建里确认为 true）会直接序列化并触发
   `asc_onSaveDocument`，完全绕开上面那条断链——把 `oja`/`xxa`/`iZd` 和
   `asc_Save`/`asc_DownloadAs` 全部重定向到对应引擎的这个触发器即可。
   **踩的坑**：`sdk-all-min.js` 把三个引擎打包在一起，`Ncj`/`DOj`/`mTi` 并
   不互斥——cell 编辑器的 api 对象上 `Ncj`（word 的触发器名）同样存在且是
   函数，但调用它是静默 no-op（属于别的引擎，含义不同）。最初按"哪个存在
   就用哪个"(`a.Ncj ?? a.DOj ?? a.mTi`) 挑选，导致 Word 走 toolbar 保存按钮
   验证通过，但 Excel 的 `downloadAs()`/`asc_DownloadAs` 路径断续失败，一度
   误判成"函数引用缓存过早导致 stale"（换成运行时懒查找，问题表面消失了一
   部分，但不可靠）。真正原因是**选错了触发器**，不是时序问题——改成按
   `runWebModeOnAppReady` 已知的 `fileType` 显式映射
   （docx→`Ncj`、xlsx/xls/csv→`DOj`、pptx/ppt→`mTi`）后，Word/Excel/PPT
   三种文档通过真实 `downloadAs()` 调用（不是直接调 `Ncj`/`DOj`/`mTi`）全部
   稳定复现"进 `handleSaveDocument`、拿到真实序列化字节"。

## 已知遗留问题

**不阻塞，但要知道：**

1. **`systemThemeSupported` 抛 `TypeError: Cannot read properties of undefined
(reading 'theme')`**：文档加载完成后必现，日志里是 catch 住的
   `changesError`。根因已定位：`Common.Controllers.Desktop.isActive()`
   因为 `window.AscDesktopEditor` 存在而返回 true，走进只有真实桌面壳才会
   填充的 `r.theme` 读取逻辑。不影响工具栏/编辑/文档加载，暂不处理。
2. **WebSocket 升级尝试**：握手响应里 `upgrades: []` 应该阻止 SDK 尝试升级
   到 WebSocket，但控制台还是看到一次 `ws://` 连接失败（错误被吞掉）。这很
   可能正是 CoAuthoringDisconnect 最终触发的诱因（没有真正的 ping/pong 保活）
   ——已经用"抑制副作用"绕过了表现症状，但没有从根上解决协议层面的问题。
3. **对话框消息匹配仅覆盖 en / zh-CN**：`suppressDialogsInFrame` 靠字符串
   匹配，其他 7 种支持语言（i18n.ts 里的语言列表）没有验证，用到时会看到
   未抑制的错误弹窗，需要补对应译文到匹配列表。
4. **文字输入未在自动化测试中验证**：确认是 chrome-devtools MCP 的已知
   局限（真实存在且已 focus 的 iframe 内 `<textarea>` 收不到 dispatch 的
   按键），不是产品代码问题，需要人工在真实浏览器里点几下确认。同理，
   Save 修复目前也只在 `downloadAs()`/toolbar 按钮点击层面验证过，"编辑内
   容后保存、内容确实落盘"这个端到端闭环仍需人工在真实浏览器里点几下确认。
5. **x2t 转换/写盘之后的收尾链路未验证**：`handleSaveDocument` 拿到字节
   之后走的 `saveWithFileSystemAPI`（`packages/converter/src/
document-converter.ts`）依赖 `showSaveFilePicker()`，这是原生 OS 对话框，
   chrome-devtools/CDP 自动化无法交互，测试到"字节已生成"这一步即止。这段
   代码 v7/v9 完全共用、这次改动完全没碰，判断不是 v9 特有问题，不在本次
   范围内继续深挖。

## 验证方式

- `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage` 全绿，
  267 个单测（含前一轮新增的 5 个：`editorSendCommand` 优先级、v7 默认配置
  不泄漏 v9 字段、`handleSaveDocument` 双 event 形状）
- `pnpm run dev:v9` chrome-devtools MCP 实测（本轮）：Word/Excel/PPT 三种
  新建文档，均通过 `window.editor.downloadAs(ext)`（真实调用链，不是直接
  调 `Ncj`/`DOj`/`mTi`）触发 `handleSaveDocument`，拿到非零长度的真实序列化
  字节（Word 34451 字节、Excel 3658 字节、PPT 28303 字节）；Word 额外通过
  真实点击 toolbar"保存"按钮复测过一遍，行为一致
- 上一轮（新建 Word/Excel/PPT、打开已有 docx、CoAuthoringDisconnect 场景、
  生产构建 `build:v9`+`preview:v9`）验证结论仍然有效，本轮未重跑
