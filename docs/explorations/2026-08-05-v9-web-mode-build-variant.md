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

## 已验证（chrome-devtools MCP 实测）

- `pnpm run dev:v9`：新建 Word、Excel 都能打开，工具栏完整（对照
  Desktop Mock 时代"工具栏永远空白"的失败模式，这是最关键的回归验证）、
  `isEdit: true`、能输入光标可见、无阻塞对话框（zh-CN 和 en 都测过）
- `pnpm run build:v9` → `pnpm run preview:v9`：生产构建同样验证通过，
  确认客户端 Engine.IO 握手拦截在真·静态环境下也生效（不只是 dev 模式）

## 已知遗留问题（不阻塞，但要知道）

1. **`systemThemeSupported` 抛 `TypeError: Cannot read properties of undefined
(reading 'theme')`**：文档加载完成后必现，日志里是 catch 住的
   `changesError`，不影响工具栏/编辑/文档加载，但值得后续查一下根因
   （大概率是我们的 `AscDesktopEditor` polyfill 缺了某个主题相关字段）。
2. **PPTX 这次没有重新手动验证**：`K8b/Fzj` 那条 patch 路径结构上和
   Word/Excel 一致，但没有实测确认。
3. **自动化测试里点 Save 按钮没有观察到 `handleSaveDocument` 触发**：
   不确定是真的功能缺口还是 chrome-devtools 自动化点击/焦点路由到 canvas
   编辑器内部时的已知局限（前面测试打字输入也遇到类似问题）。单元测试层面
   `handleSaveDocument` 的双 event 形状分支逻辑已经覆盖，但完整的
   保存→下载链路建议找人工实测一次。
4. **WebSocket 升级尝试**：握手响应里 `upgrades: []` 应该阻止 SDK 尝试升级
   到 WebSocket，但控制台还是看到一次 `ws://` 连接失败（错误被吞掉，不影响
   功能）。协议层面没有完全按预期工作，暂不影响使用。
5. **对话框消息匹配仅覆盖 en / zh-CN**：`suppressDialogsInFrame` 靠字符串
   匹配，其他 7 种支持语言（i18n.ts 里的语言列表）没有验证，用到时会看到
   未抑制的错误弹窗，需要补对应译文到匹配列表。

## 验证方式

- `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage` 全绿，
  267 个单测（含本轮新增的 5 个：`editorSendCommand` 优先级、v7 默认配置不
  泄漏 v9 字段、`handleSaveDocument` 双 event 形状）
- `pnpm run dev:v9` + `pnpm run build:v9` + `pnpm run preview:v9` 均通过
  chrome-devtools MCP 实测（见上）
