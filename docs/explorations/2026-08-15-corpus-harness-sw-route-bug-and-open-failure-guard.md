# 语料战役第 2 天：跑道自身被 SW 击穿（第 1 天根因作废）+ 打开失败终于可见

日期：2026-08-15
前情：[第 1 天](2026-08-15-corpus-campaign-day1-chinese-filename-bug.md)判定
"非 ASCII 文件名 → 打开转换 -82 + 永久转圈"为 P0 根因（25/25 全灭）。
本轮按[测试覆盖策略](../superpowers/plans/2026-08-15-v9-test-coverage-strategy.md)
第 7 节动手：先建 L0 全局 fixture，再修文件名 P0。修之前先复现——结果
把第 1 天的结论整个推翻。

## 一、L0 fixture 落地（test/e2e/lib/l0.ts）

所有 E2E 自动获得：`asc_onError`（任意同源 frame 的任意 SDK 实例）、
厂商致命弹窗、frame 内 `unhandledrejection` / `error`、页面 pageerror、
非白名单 console.error → 任一非空即失败；测试需显式
`l0.expectAscError(id)` / `l0.allowFrameError(re)` / `l0.allowConsole(re)`
声明预期。`open-failure.spec.ts` 同时充当 fixture 自检（证明 hook 真的
观测到 SDK 错误与 frame 拒绝）。

第一次挂上 fixture 全套 18 条即刻全绿，于是用垃圾字节冒充 `.xlsx` 做
自检——**没抓到 `asc_onError`**，UI 永久转圈。追进去发现：厂商 Offline
控制器 `loadDocument` 里 `await AscCommon.x2t.convertToBin(...)` 无 catch，
打开转换失败是 **iframe 内的未处理 Promise 拒绝**（`Document conversion
failed: Conversion failed with code: 88`），既不进 `asc_onError`，Playwright
的 `pageerror` 也收不到 iframe 的拒绝。这就是缺陷 #3 的机制。fixture
据此补了 frame 级 `unhandledrejection` 捕获。

## 二、文件名假设复现失败 → 真相是跑道被 Service Worker 击穿

| 实验                                                                            | 结果                                                       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| SheetJS 合成工作簿 × {ASCII, 中文, 空格, 括号, emoji, `&%`} 文件名              | **全部 2.5～3.5s 加载成功**                                |
| 真实 `公司工作作息时间.xlsx`（208KB）用 ASCII 名 `schedule.xlsx`                | **失败**：`Aborted(missing function: _ZN10CHtmlFile2C1Ev)` |
| 同一文件中文名                                                                  | 同样失败，同一错误                                         |
| 同一文件重复 4 次                                                               | 2 成 2 败——**不确定性**                                    |
| Node 离线跑 x2t.wasm 导入同一文件                                               | 每次 73ms 成功                                             |
| 在 iframe 内包住 `_convertDocument` / `executeConversion` 看 x2t 实际收到的字节 | **20220 字节、以 `<!doctyp` 开头**——是 `dist/index.html`   |
| `test.use({ serviceWorkers: 'block' })` 后重跑                                  | 211027 字节、`PK` 头、2.6s 成功，稳定                      |

结论：corpus 跑道用 `page.route('**/__corpus__/doc')` 投递字节，而
**Playwright 的 route 拦截不了被 Service Worker 处理的请求**——SW 一旦
控制了 embed-demo 页面，`/__corpus__/doc` 就真的打到 vite preview，SPA
兜底返回 index.html，x2t 收到 HTML → 走 HTML 导入器 → 该函数在这份
wasm 里被裁掉（`CHtmlFile2`/`CFb2File`/`CHWPFile`/iWork/Markdown 全是
stub）→ abort。SW 是否已控制页面取决于时序，于是"偶尔成功"；第 1 天
的"改 ASCII 名 2.1s 成功"就是撞上了 SW 未控制的窗口，被误读为文件名
决定论。**25/25 全灭是跑道的锅，不是编辑器的锅。**

跑道修法：`page.setInputFiles('#fileInput', path)` + `document:open-file`
——走 demo 页真实文件输入，零网络、真实文件名、不需要 60MB base64
往返（另一并行会话独立复现了同一结论并临时改成 base64 投递；本版统一
为 setInputFiles）。

教训写进策略文档与 CLAUDE.md：**任何 E2E 里用 page.route 给被 SW 控制
的页面喂数据都不可靠**；要么走真实输入通道，要么显式
`serviceWorkers: 'block'`（但那会改变被测环境，corpus 不采用）。

## 三、缺陷 #3 修复：打开失败可见、遮罩终止、保存快速拒绝

`lib/onlyoffice-editor.ts` 新增 `installOpenFailureGuard(win)`（在
`prepareEditorIframe` 的 frame 循环里对每个编辑器 frame 装一次）：监听
frame 的 `unhandledrejection`，命中 `/Document conversion failed|Conversion
failed with code|X2T module/` 时——

1. `markDocumentOpenFailed(msg)`：置 `documentOpenError`，唤醒
   `waitForDocumentContentReady` 的等待者；`requestSaveDocument` 入口
   与异步触发路径都检查它，立刻以 `The document failed to open: ...`
   拒绝（原来要等满 60s 超时）。
2. `api.sendEvent('asc_onError', ConvertationOpenError(-82), Critical)`：
   走 SDK 自己的错误链——厂商弹 "An error has occurred while opening the
   file." 对话框，`Common.Gateway.reportError` 触发宿主 `onError` → 我们
   的 ranui toast（-82 新增提示文案 `editorErrorOpenFailed`，中英）。
3. `api.sendEvent('asc_onEndAction', BlockInteraction, Open)`：结束
   "Loading spreadsheet" 遮罩。

回归用例 `test/e2e/open-failure.spec.ts`：垃圾字节 `.xlsx` → 断言厂商
对话框文案、`.asc-loadmask` 为 0、`document:save` < 10s 拒绝且含
"failed to open"、fixture 收到 -82 与 frame 拒绝。全套 E2E 20/20。

## 四、附带发现：伪装成 xls/xlsx 的 HTML 文件会撞同一个 abort

x2t.wasm 缺 `CHtmlFile2`，意味着**真实世界里非常常见的"HTML 表格另存为
.xls"**（国内各类系统导出）在 v9 里必然打开失败。现在至少能看到错误了
（本轮修复），但正确做法是在 `packages/converter` 嗅探到 HTML 内容时用
SheetJS 解析 HTML 表格转 XLSX 再进编辑器（与 CSV 同一套路）。列入缺陷
清单 #5，下一步做。

## 战役缺陷清单（更新）

| #   | 缺陷                                                | 级别 | 状态                                      |
| --- | --------------------------------------------------- | ---- | ----------------------------------------- |
| 1   | ~~非 ASCII 文件名 → -82 + 永久转圈~~                | —    | **作废**：跑道 bug（SW 击穿 page.route）  |
| 2   | 特定 CSV 被 SheetJS 误判为 HTML                     | P1   | 待修                                      |
| 3   | 打开失败遮罩不终止、无可见错误、保存等满 60s        | P1   | **已修**（installOpenFailureGuard + E2E） |
| 4   | 用户报告的 PPT 编辑致命弹窗                         | P0?  | 未复现，等 SW 清理后反馈；语料重跑中      |
| 5   | HTML 伪装的 .xls/.xlsx → x2t abort（缺 CHtmlFile2） | P1   | 新增，方向：converter 嗅探 + SheetJS      |
| 6   | Save 按钮常灰（coauthoring autosave 假提交）        | P0   | **已修**（并行会话，守卫 5，ca20ac5）     |

## 五、跑道修好后的第一轮全量：打开全部通过，保存全部"超时"——又是跑道

修好投递后重跑：**每个文件都能打开（6～10s）并编辑**，用户报告的那份
35 页 EMP deck 打开、双击标题输入文字均无致命弹窗（P0 #4 未复现，与
"用户浏览器 SW 缓存了图片管线修复前的旧构建"假设一致）。但 save 步骤
全部 `save timed out (180s)`，无 `asc_onError`、无弹窗。

单独调试 EMP deck 的保存：

| 触发方式                                                            | 结果                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------- |
| `document:save`（无 targetExt，embed 默认 XLSX）                    | `convertFromBin` PPTY→xlsx，x2t 错误码 88，embed 45s 超时 |
| `document:save({ targetExt: 'PPTX' })`                              | **792ms 成功，6.6MB 产物**，31 个媒体齐全                 |
| corpus 直接 `asc_DownloadAs(PPTX)`（只等 `isDocumentLoadComplete`） | 静默丢弃 → 180s 超时                                      |

三个结论：

1. **corpus 保存超时是跑道 bug**：`asc_DownloadAs` 在 `isLoadFullApi`
   为 false 时被 SDK 静默丢弃（主路径 `triggerPersonalDownloadAs` 早已
   同时等两个标志），大 deck 的 full API 加载滞后于文档加载完成。跑道
   改为两个标志都等。
2. **embed `document:save` 默认 XLSX 是真缺陷**：对 docx/pptx 裸调
   `document:save` 必然 88 + 超时。改为默认当前文档自身格式
   （`lib/embed-api.ts`），文档同步；回归用例
   `test/e2e/embed-save-default.spec.ts`（页外 `test/e2e/lib/ooxml.ts`
   生成 docx——动作库/合成语料的第一块）。
3. **`installOpenFailureGuard` 首版误判**：保存路径的 `convertFromBin`
   拒绝也匹配同一 pattern，被当成打开失败多发了一次 -82。改为按
   `documentContentReady` 区分——加载后的拒绝视为导出失败，只让挂起的
   `requestSaveDocument` 立即以 `Save conversion failed: ...` 拒绝
   （SDK 自己会发 `asc_onError -25`），不再伪造打开错误。

## 六、第二轮：保存仍全部超时——跑道的第三个 bug（跨 realm instanceof）+ L0 抓到 themes.js 缺失

等齐 `isLoadFullApi` 后重跑，保存依旧全部 180s 超时，而 `document:save`
明明 792ms 成功。差异只剩流监听：corpus 从 demo 页 `page.evaluate` 里给
**app 窗口**挂 `message` 监听并用 `d.buffer instanceof ArrayBuffer` 判型
——监听函数属于 demo 页 realm，事件数据结构化克隆进 app realm，跨 realm
`instanceof` 恒为 false，流被静默丢弃。x2t_helper 同时也把流 post 给
`window.top`（demo 页），改为在本窗口监听 + `Object.prototype.toString`
判型，EMP deck 立刻 `save=ok (592ms, 6494KB)`。

同一轮 L0 fixture 抓到每个 PPTX 都有一条 frame 错误
`Unexpected token '<'`：SDK `SetThemesPath` 加载 `sdkjs/slide/themes//themes.js`，
vendor 包里根本没有这个文件（上游构建步骤会生成 themes.js + `theme<N>/theme.bin`

- 缩略图，这份包只带了 `src/*.pptx`），SPA 兜底回 HTML → 脚本解析错误。
  主题库因此本来就是空的。最小修法：`public/sdkjs/slide/themes/themes.js`
  声明 `AscCommon.g_defaultThemes = []`，加载干净；真正的主题库要先离线
  生成 theme.bin，列为缺陷 #7（P2）。

## 跑道三连坑的共同教训

三个 bug（SW 击穿 page.route、未等 isLoadFullApi、跨 realm instanceof）
都把"成功"表现成"超时/永久转圈"，都被误读为编辑器缺陷，都在第 1 天
造成了错误的 P0 结论。**跑道自身必须先过 L0**：任何"全灭"结果先怀疑跑道
——用一份已知能开的文件做对照（本轮是 SheetJS 合成工作簿全绿 vs 真实
文件全灭，这个反差就是线索）。这条写进策略文档第 3 节。

## 战役缺陷清单（第 2 天收工版）

| #   | 缺陷                                                  | 级别 | 状态                                                          |
| --- | ----------------------------------------------------- | ---- | ------------------------------------------------------------- |
| 1   | ~~非 ASCII 文件名 → -82 + 永久转圈~~                  | —    | **作废**：跑道 bug（SW 击穿 page.route）                      |
| 2   | 特定 CSV 被 SheetJS 误判为 HTML                       | P1   | 本轮 addresses.csv 经 open-file 打开正常，需复核              |
| 3   | 打开失败遮罩不终止、无可见错误、保存等满 60s          | P1   | **已修**（installOpenFailureGuard + E2E）                     |
| 4   | 用户报告的 PPT 编辑致命弹窗                           | P0?  | **未复现**：EMP deck 打开/编辑/保存全通；仍等用户清 SW 后反馈 |
| 5   | HTML 伪装的 .xls/.xlsx → x2t abort（缺 CHtmlFile2）   | P1   | 待做：converter 嗅探 + SheetJS                                |
| 6   | Save 按钮常灰（coauthoring autosave 假提交）          | P0   | **已修**（并行会话，守卫 5，ca20ac5）                         |
| 7   | embed `document:save` 默认 XLSX，docx/pptx 裸保存必败 | P1   | **已修**（默认当前文档格式 + E2E）                            |
| 8   | PPTX 主题库为空（vendor 缺 themes.js/theme.bin）      | P2   | 加载错误已消除（空目录声明）；主题库待生成                    |

## 追记：真实语料全量第三轮——31/31 通过

跑道三坑修完 + themes.js 补齐后，`CORPUS_DIR=<本地语料>` 全量 31 个真实
文件（docx/doc/xlsx/pptx/csv，含 35 页 EMP deck、多份中文名 / 空格 /
括号 / 全角冒号文件名）：**31/31 打开（6～11s）+ 键盘编辑 + 保存往返
（产物合法 zip）+ L0 零发现**，全程 2.4 分钟（3 worker）。

这意味着截至今天，v9 在这份语料上没有一个"打不开 / 编辑崩 / 存不下"
的实例；用户实测的负面印象来源应重新聚焦到 (a) SW 缓存旧构建、
(b) Save 按钮常灰（已修）、(c) 尚未进语料的文档特性。下一步按策略文档
第 2 节引入公开语料扩面，并把 corpus 接入夜间 CI。
