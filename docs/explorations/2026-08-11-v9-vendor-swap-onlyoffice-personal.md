# v9 路线 A 落地：整体换用 OnlyofficePersonal vendor，删除 1207 行 patch 栈，三端打开/编辑/保存/转 PDF 全部验证通过

日期：2026-08-11
分支：feat/v9-web-mode
状态：**迁移完成并现场验证**。旧 v9 方案（混淆符号 patch 栈）整体删除；
新方案全部走公开 DocEditor 配置 + 文件流消息。lint / 302 个单测 /
coverage（45%，远超 34% 阈值）/ `build:v9` / `build`（v7）全部通过。
有一个**部署阻塞项**（x2t.wasm 40MB 超 CF Pages 单文件限制）见文末。

## 背景

前一篇（[2026-08-11-v9-pdf-export-root-cause-and-onlyoffice-personal.md](2026-08-11-v9-pdf-export-root-cause-and-onlyoffice-personal.md)）
定案：PDF 导出在旧 v9 sdkjs 底座上无解，用户拍板转"路线 A"——用
OnlyofficePersonal（fernfei，AGPL-3.0，OnlyOffice 9.3.0.133 编译产物）的
vendor 整体替换。本篇是实施记录。

## 资源替换

- 删除 `public-v9/{sdkjs,web-apps,fonts,wasm,font-map.json,onlyoffice-iframe-patch.js}`。
- 从 `/Users/ranzhouhang/Desktop/OnlyofficePersonal-9.3.0.133/9.3.0.133-*/vendor/`
  拷入 `sdkjs/`（185M，内含 9.4 版 x2t 40M）、`web-apps/`（141M，**裁掉了全部
  `apps/*/main/resources/help`，省 508M**）、`fonts/`（327M，按索引 000-266
  命名 + `AllFonts.js` 索引表，按需加载）。
- 现在 `public-v9` 共 655M / 2651 个文件（CF Pages 2 万文件上限内）。
- 关键结构约束：`web-apps` 与 `sdkjs` 必须是**兄弟目录**——x2t_helper 是
  web-apps 各编辑器 `app.js` 里 RequireJS 路径 `../../sdkjs/common/wasm/x2t/x2t_helper`
  引入的；api.js 从自身 script src 反推 base path，所以整体布局平移即可用。
- `public-v9/wasm/`（页面级 x2t）整体删除：新架构下打开和导出都发生在编辑器
  iframe 内部，页面层完全不需要 x2t。

## 代码改动（lib 集成层重写）

净效果：`lib/onlyoffice-editor.ts` 从 1720 行减到约 900 行。

**新增：**

1. `createPersonalEditorInstance()`（v9 专用编辑器创建）：走纯公开配置——
   `document.url` = 真实 blob URL（编辑器自己 fetch 并内部转换）、
   `document.key` 每次打开唯一（防编辑器缓存陈旧内容）、
   `documentType` 显式给出、`mode: readonly ? 'view' : 'edit'`、
   `events.onDownloadAs` 必须注册（哪怕空函数，api 层只有声明了它才执行
   downloadAs）。**新建文档不再需要任何空模板**：url 传 undefined，SDK 自建
   空白文档（`empty_bin-v9.ts` 因此删除；v7 的 `empty_bin.ts` 保留）。
2. **文件流保存通道**：页面设 `window.OO_FILE_STREAM_ONLY = true`，监听
   `onlyoffice-file-stream` 消息（x2t_helper 在编辑器 iframe 里劫持
   `downloadFile` 后 postMessage 给 parent，标志沿 parent 链查找）。收到后：
   有 embed 保存请求就 resolve File；embed 模式警告；否则
   `saveFileLocally()`（File System Access API / anchor 下载）。
3. `triggerPersonalDownloadAs()`：**api.js 的 `downloadAs(format)` 在这套
   构建里会静默丢弃请求**（他们自己的 demo 也有同样缺口，现场确认），所以
   `requestSaveDocument` 的 v9 路径改为直接对同源编辑器 iframe 调
   `api.asc_DownloadAs(new Asc.asc_CDownloadOptions(数字常量))`（常量来自
   `lib/file-types.ts` 的 `oAscFileType`）。
4. `lib/converter.ts`：v9 下 `loadScript`/`initX2T` 变 no-op（页面级 x2t
   已不存在，之前会因 404 中断打开流程）。

**删除（全部是旧底座的运行时 hack，git 历史里都在）：**

- `public-v9/onlyoffice-iframe-patch.js`（1207 行）——旧 web-apps 的
  index.html 引用它，新 vendor 天然解耦。
- lib 里 6 个 iframe patch 函数（对话框抑制、断连抑制、主题崩溃守卫、
  页眉序列化守卫、下载设置对话框旁路）+ `runWebModeOnAppReady`（约 400 行，
  含 `Shc/BRj/mTi/DOj/Ncj` 等全部混淆符号 hook）+
  `patchDownloadOptionsFileTypeCapture`/`extractRequestedDownloadFormat`
  （构造函数包装那套，新架构不再需要）+ `handleSaveDocument` 的 v9
  ArrayBuffer 分支。
- `lib/media-player.ts`、`lib/empty_bin-v9.ts`（仅被删除代码引用）。
- `sw.js` DEPLOY_COUPLED 与 `_headers` 里的 patch 条目。
- 对应单测（构造函数捕获 5 组、ArrayBuffer 事件形状 1 个）。

## 现场验证（chrome-devtools MCP，dev:v9）

| 场景                                                        | 结果                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `?new=xlsx` 新建                                            | 编辑器完整渲染，控制台仅 5 条消息（旧方案是满屏 patch 日志）                        |
| 输入 + 存 XLSX                                              | `file stream received: New_Document.xlsx (7967 bytes)`                              |
| **xlsx → PDF**                                              | **`file stream received: New_Document.pdf (4982 bytes)`——旧底座的功能级阻塞项解决** |
| `?new=docx` + 存 DOCX                                       | 25788 bytes 流                                                                      |
| **docx → PDF**                                              | **8943 bytes PDF 流**                                                               |
| `?new=pptx` + 存 PPTX                                       | 33715 bytes 流                                                                      |
| 打开真实文件（`?file=` 绝对 URL，sheetjs-upload-test.xlsx） | 标题、A1/B1 内容逐字正确                                                            |

## 已知问题 / 遗留

1. ~~部署阻塞：x2t.wasm 40MB 超 CF Pages 25MB 限制~~ **已解决（2026-08-12）**：
   `x2t_helper.js` 新增 `prepareWasmBinary()`——加载 x2t.js 前 fetch
   `x2t.wasm.gz`（9.4MB），按魔数判断是否需要 `DecompressionStream('gzip')`
   解压（兼容 Content-Encoding 已解压的服务器），预置到
   `window.Module.wasmBinary`，Emscripten 检测到后跳过自己的 wasm fetch。
   裸 `x2t.wasm` 已从仓库删除，`public-v9` 与 `dist-v9` 均无超限文件。
   现场验证：gz-only 路径下 xlsx→PDF 导出流照常产出（4982 字节）。
2. PPT 打开时 `sdkjs/slide/themes//themes.js` 404（双斜杠）——OnlyofficePersonal
   自己的 demo 也有（其控制台同样报 themes.json 解析失败），不阻塞编辑与保
   存；幻灯片主题库可能受限，待查它 demo 的 `assets/office-config.js` 是否有
   规避配置。
3. PDF 打开（`openDocument({buffer})` + `localOpenFromBinary`）尚未接——新
   vendor 支持 PDF 编辑器，是新增能力，后续接入。
4. embed 模式下 `requestSaveDocument` → 文件流 resolve 的链路已实现但未做
   端到端验证（e2e 的 open-buffer 用例跑的是 v7）。
5. `setReadonlyMode` 的运行时切换（`processRightsChange` serviceCommand）在
   新构建上未验证；打开时的 readonly（`mode:'view'`）已走配置。
6. ~~既有 bug：`?file=` 相对 URL 丢文件名~~ **已修复（2026-08-12）**：
   `lib/document.ts` 的 `openDocumentFromUrl` 改为
   `new URL(url, window.location.href)` 解析，相对 URL 保留真实文件名。
   现场验证：`?file=/sheetjs-upload-test.xlsx` 正确以
   `sheetjs-upload-test.xlsx` / `xlsx` 打开，不再弹 fileType 校验 alert。
7. 三端"编辑→保存→重新打开"的完整往返、插图、打印预览等深度回归尚未在新
   底座上重跑——旧底座上修过的 15+ 个 bug 大多因 patch 栈删除而不再适用，
   但需要一轮系统回归确认新底座没有自己的坑。

## 与 v7 的关系

v7 完全未动：`public/` 原样，`createEditorInstance` 的 v7 分支、
`handleSaveDocument`（onSave 对象形状）、页面级 x2t 转换链路全部保留，
302 个单测全过（默认 v7 模式），`pnpm run build` 通过。
