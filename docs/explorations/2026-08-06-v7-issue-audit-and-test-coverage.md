# v7 功能 + GitHub issue 全量审计，补测试，验证 v9 无回归

## 背景

在 `feat/v9-web-mode` 分支已经完成 Save/Download 修复（见
[2026-08-05-v9-web-mode-build-variant.md](2026-08-05-v9-web-mode-build-variant.md)）之后，
用户要求更进一步：系统性梳理 v7 已有功能和 GitHub 上全部 issue（截至 2026-08-06 共
43 个，open+closed），把能写单测的地方补上回归测试，并确认 v9 变体不会重新引入这些
问题。

## 方法

用一个 general-purpose agent 批量拉取全部 43 个 issue 的完整 body + 评论
（`gh issue view <n> --json title,state,labels,body,comments`），按能否测试分四类：

- **A. App 层逻辑 bug，jsdom/Vitest 可测**（不依赖真实 OnlyOffice 引擎）
- **B. OnlyOffice 引擎级 UI/渲染 bug，只能真浏览器验证**（光标位置、单元格渲染、
  动画播放这类）
- **C. 基础设施/文档/feature request，不在测试范围内**（Docker、WebDAV、RTL 等）
- **D. 已修复且已有回归测试**

分类结果人工核对了几条关键结论（agent 的分类基本准确，但对 #113 的"已通过 PR #115
修复"这条判断是错的，见下文）。

## 关键发现：#113 的官方修复实际未解决问题

Agent 报告里把 #113 归进"D. 已修复"，依据是这次会话早前提交的 `18bb045`/PR #115
（base64 编码绕开 ArrayBuffer 跨 postMessage 结构化克隆失真）。但去读 issue #113 最新
评论（2026-08-06 13:16，报告人 zjhtsgr 的验证报告）发现：**该修复没有解决真实 Qt
WebEngine 环境下的问题**。报告人在 api.js 加日志确认：数据在发到 `sendCommand` 之前
全部正确（Base64 长度符合预期），但 OnlyOffice 内部 iframe 解析 `buf` 时仍然报错
-85（识别成 pdf/djvu/xps/oxps 格式）。根因被重新定位到 **OnlyOffice SDK 内部**的
`postMessage` 接收/解析逻辑，不是 document 项目层面能修的。

**这与 v9 的关系**：v9 Web Mode 打开文档完全不走这条路径——`runWebModeOnAppReady`
直接拿到 iframe 的 `contentWindow`，同源调用 `api.asc_openDocumentFromBytes(bytes)`，
根本不经过 `sendCommand`/`postMessage`/结构化克隆。也就是说 #113 的根因（v7 的
`api.js` 内部 `postMessage` 解析 `buf` 时格式误判）在 v9 架构下**天然不存在**，因为
数据根本没有走 postMessage 这条边界。这不等于"v9 修复了 #113"（#113 报的是 v7 embed
API 场景，v9 目前还没有对应的 embed 集成验证），但方向上是个积极信号，值得在后续
v9 embed 集成时重点验证。

## 新增测试

### `test/unit/document-converter.test.ts`（新文件，15 个用例）

覆盖 `packages/converter/src/document-converter.ts`（`X2TConverter`）此前完全没有
测试文件的几块纯逻辑，全部绕开真实 x2t WASM 启动（用 `(instance as any)` 访问
TS-private 方法，或 stub `initialize()`/`x2tModule`）：

- `sanitizeFileName`：非法字符/控制字符/不安全字符清理、空输入兜底 `file.bin`、
  200 字符截断
- `convertCsvToXlsx`（**issue #33 / #13** "CSV 能否打开/编辑"）：UTF-8 BOM 剥离、
  无 BOM 时正常解码、`.csv`→`.xlsx` 文件名替换、SheetJS 报错时包裹成可操作的提示
- `convertDocument` 遇到空 CSV 时抛 "CSV file is empty"（**#33/#13**）
- `getDocumentType`：确认 `csv` 扩展名被识别为受支持的 `cell` 类型（回答
  "csv 文件能加载吗"），未知扩展名抛 "Unsupported file format"
- `executeConversion` 的错误码提示映射（**issue #49** "conversion fails"）：
  code 88（.doc 二进制格式/加密/损坏）、55（DRM）、未知 code 不带提示后缀、
  code 0 不抛错

### `test/unit/embed-api.test.ts`（+1 用例）

之前只测了 `document:save` 的失败路径（`toHaveBeenCalledWith` 断言 error 消息），
没测成功路径。补了一个用例断言 `document:saved` 消息携带 `file`/`fileName`/
`mimeType`/`size` 字段（**issue #4** "保存文件到服务器"——父页面依赖这个 payload
自己上传文件，这是官方给的推荐做法）。

### `test/unit/i18n.test.ts`（+2 用例，1 个 `it.each` x4）

`packages/shared/src/i18n.ts` 的 `I18n` 是模块加载时构造的单例，语言检测优先级是
`URL locale` → cookie → localStorage → `navigator.language` → `en`，但此前没有任何
测试验证 URL 参数分支（**issue #37/#32** "UI 默认中文/无法切换英文"）。用
`vi.resetModules()` + 动态 import 在每个用例里拿到全新单例，验证 `?locale=zh`/
`zh-CN`/`en`/`en-US` 均正确覆盖已保存的 localStorage 偏好，以及无 URL 参数时正确回退到
localStorage。

### 未写测试、决策原因

- **issue #48**（签名 URL 的 `sign=` 参数丢失）：涉及 `index.ts` 顶层脚本副作用代码
  和外部依赖 `ranuts/utils` 的 `getAllQueryString()`，issue 本身也是"needs
  reproduced"状态、维护者从未确认根因，为一个未确认的 bug 写规格测试风险大于收益，
  跳过。
- **Bucket B（OnlyOffice 引擎级 UI bug）大多数条目**：光标位置（#92/#12/#30）、
  富文本渲染（#64/#62/#28）、动画/GIF 播放（#94）、图标模糊（#15）这类问题的复现
  依赖真实键盘输入或高保真视觉比对，chrome-devtools MCP 自动化打不进 iframe 内真实
  聚焦的 `<textarea>`（已知局限，[2026-08-05
  文档](2026-08-05-v9-web-mode-build-variant.md)记录过），逐条搭建复现环境的成本
  超出本轮范围，未逐一验证。

## v9 实测验证（chrome-devtools MCP，`pnpm run dev:v9`）

### 多 sheet 渲染（issue #31 "打开 EXCEL 时只显示一个 sheet"）—— v9 不复现

用项目自带的 `public-v9/libs/sheetjs/xlsx.full.min.js`（在 Node `vm` 沙箱里跑通，
构造一个真实的 3-sheet xlsx 二进制），通过页面真实的"Open a file"上传入口（不是
直接调 API 注入）让它走完整的 `x2t` 转换 + `createEditorInstance` + `onAppReady`
流程。结果：三个 sheet 标签（Alpha/Beta/Gamma）全部正确渲染，点击切换标签内容也
正确更新（A1 分别显示 "sheet one"/"sheet two"）。**结论：#31 在 v9 的"打开已有多
sheet 文件"路径下不复现。**

踩坑记录：最初尝试用 `api.asc_openDocumentFromBytes()` 直接对一个已经渲染完成的
编辑器实例二次注入新文档来省去构造真实上传的麻烦，结果内部状态
（`asc_getWorksheetsCount()`）变成 3，但 UI 层完全没刷新（还是显示旧文档的单个
"Sheet1"、单元格也是空的）。这不是 #31 的复现，而是 `asc_openDocumentFromBytes`
本身只设计给"编辑器刚创建、第一次加载"这一次性场景用，不支持对运行中的编辑器做
"热替换文档"——之后如果要测别的"已打开文档"类 issue，必须走真实的文件上传或全新
页面加载，不能偷懒用二次注入。

### Save/DownloadAs 路由修复回归确认

本轮开始前先确认了上一轮（见 2026-08-05 文档）遗留的 Save/DownloadAs 架构性缺口的
最终修复：v9 的 `asc_Save`/`asc_DownloadAs` 统一重定向到每个引擎独立的"离线保存
触发器"（word `Ncj`、cell `DOj`、slide `mTi`），选择哪个触发器改成按 `fileType`
显式映射（而不是"哪个存在就用哪个"——因为三个引擎共享同一份 `sdk-all-min.js`，
`Ncj` 在 cell 的 api 对象上也存在但语义不同、调用是静默 no-op）。Word/Excel/PPT
三种文档通过真实 `downloadAs()` 调用链均稳定复现"拿到真实序列化字节"，已提交
`bdcaf49`。

## 验证方式

- `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage` 全绿，
  288 个单测（本轮新增 21 个：`document-converter.test.ts` 15 个 + `embed-api.test.ts`
  1 个 + `i18n.test.ts` 5 个）
- `pnpm run dev:v9` chrome-devtools MCP 实测：多 sheet xlsx 完整打开+切换验证通过

## 已知遗留

- `vitest.config.ts` 的 coverage `include` 列表仍写着 `lib/document-utils.ts`、
  `lib/i18n.ts` 这两个已经不存在的旧路径（这两个文件早就搬到
  `packages/shared/src/` 了），本轮新增的 `document-converter.test.ts` 覆盖率也
  不会被统计进报告（`packages/converter/src/**` 不在 include 里）。属于配置漂移，
  不影响测试本身是否通过，未在本轮修复（不在这次任务范围内，需要用户确认是否要
  一并清理）。
- Bucket B 中光标位置、富文本渲染、动画类 issue 仍未逐条在 v9 做真实浏览器验证，
  原因见上文"未写测试"小节。
