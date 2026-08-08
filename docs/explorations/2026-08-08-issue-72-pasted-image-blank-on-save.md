# Issue #72：粘贴/插入的图片保存后是空白占位符

## 背景

用户要求检查 GitHub issue 并继续修复。仓库里最新的 issue #113（`document:open-buffer`
打不开 docx，见下方"顺带排查：#113 的 base64 修复实际有效，问题在 Qt WebEngine 侧"）
排查到一半发现缺一个 Qt WebEngine 环境没法继续验证，遂搁置，转向另一个同样是"图片"
相关但**在普通 Chrome 里就能从代码层面确认根因**的 issue：#72。

reporter 的最新留言（维护者之前误判为 CORS 问题后的补充说明）：

> 截图粘贴后，显示正常；但是保存下载的文件中，图片是空白的只有占位

这条描述的是剪贴板截图（本地 Blob，不是跨域 URL），跟维护者之前"CORS 限制"的回复
对不上——CORS 只会影响远程 URL 图片，截图粘贴走的是完全不同的代码路径。

## 结论

根因确认，已修复：**粘贴/插入的图片在"打开中的文档"里只以内存 Blob URL 的形式存在，
x2t（负责把编辑器内部 `.bin` 格式转换成最终 docx/xlsx/pptx 的 WASM 转换器）运行在
沙盒虚拟文件系统里，完全没有能力访问浏览器的 Blob URL Store，保存时自然找不到真实
字节，输出空白占位图。**

## 排查过程

- `lib/onlyoffice-editor.ts` 的 `handleWriteFile`（处理粘贴图片的 SDK `writeFile`
  事件）把图片字节包成 `Blob` → `createObjectURL()` 得到一个 `blob:` URL → 存进模块级
  `media` 映射表 → 通过 `asc_setImageUrls`/`asc_writeFileCallback` 回传给 SDK，用于
  **实时编辑视图里的显示**。这一步本身没问题，也解释了为什么"显示正常"。
- 保存方向（`packages/converter/src/document-converter.ts` 的
  `convertBinToDocument`）直接把编辑器吐出来的 `.bin` 写进 x2t 的虚拟文件系统
  （`FS.writeFile`）就跑转换，**全程没有一行代码读取过 `media` 映射表，也没有把任何
  URL 对应的字节写回 `/working/media/` 目录**。
- 反向确认："打开"方向反而有对称的读取逻辑——`readMediaFiles()`
  在文档转换完成后 `FS.readdir('/working/media/')`，把 x2t 解压 docx/xlsx/pptx 时
  自动产生的媒体文件读出来做成 blob URL 供实时编辑用。保存方向本该有个对称的"写入"
  步骤，但完全缺失。
- `lib/converter.ts` 导出的 `convertBinToDocument`/`convertBinToDocumentAndDownload`
  签名只有 `(bin, fileName, targetExt)`，`onlyoffice-editor.ts` 里的 `media` 映射表
  从未被传进去过——从函数签名这一层就能看出这条链路根本不通，不需要跑真实环境就能
  确认。

## 修复

- `packages/converter/src/document-converter.ts`：新增私有方法 `writeMediaFiles(media)`，
  对 `media` 映射表里的每个 `[相对路径, URL]`，`fetch(url)` 取字节后写入
  `/working/${相对路径}`（`/working/media/` 目录已经在 `WORKING_DIRS` 里预先创建好，
  不需要额外 `mkdir`）。`convertBinToDocument` 在写 `.bin` 文件、跑转换之前先调用它；
  `convertBinToDocumentAndDownload` 透传 `media` 参数。单个 URL fetch 失败只警告、
  跳过，不阻塞其余图片或抛出异常。
- `lib/converter.ts`：导出的 `convertBinToDocument`/`convertBinToDocumentAndDownload`
  包装函数新增可选 `media?: Record<string, string>` 参数并透传给 `X2TConverter`。
- `lib/onlyoffice-editor.ts`：`setConverterCallbacks` 的回调类型统一成
  `ConvertBinFn`（新增 `media` 形参）；`handleSaveDocument` 里两处调用
  （`embeddedSaveRequest` 分支的 `convertBinToDocumentFn`、本地下载分支的
  `convertBinToDocumentAndDownloadFn`）都把模块级 `media` 对象传进去。

这条修复同时覆盖两种触发方式——剪贴板粘贴截图、以及"Insert → Image → From Local
File"本地插入——因为两者在这个项目的架构里都统一走 SDK 的 `writeFile` 事件
（`handleWriteFile` 里的注释和函数命名都明确写了"mainly for handling pasted
images"，但没有区分来源）。

## 验证

- **静态/单元测试**：`test/unit/document-converter.test.ts` 新增
  `writeMediaFiles (private)` 一组用例（4 条）：无 `media` 时不触碰 FS；正常 fetch
  并按 `media/<file>` 路径写入；key 不带 `media/` 前缀时自动补上；单个 URL fetch
  失败时跳过该条、不影响其余条目也不抛异常。`packages/converter` 重新 `tsc` 构建后，
  `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage` 全绿
  （292 个单测）。
- **真实浏览器端到端验证：未完成**，如实记录。用 chrome-devtools MCP 反复尝试在
  v7 的 dev server（两次）和生产构建 `preview` 服务器上完整走一遍"New Word → Insert
  Image → Save → 检查输出 zip 里的图片字节"，但编辑器 iframe 在这三次环境里全部
  卡在一个常驻的"Loading document"遮罩上、工具栏按钮呈 disabled 状态，没能通过
  UI 自动化把图片实际插入到文档模型里（清过 Service Worker/缓存、换过全新
  dev/preview 服务器都没解决）。这个"卡加载"现象与本次改动无关——同一遮罩在本次
  会话更早排查 v9 `P_g` 问题时也持续出现，但当时已经用其他方式证实文档其实是可用
  、可保存的（`document:saved` 正常返回真实文件），说明它更像是这个自动化测试环境
  下的一个展示层问题，而不是真的卡死；只是这次没能找到绕过它、把图片真正"画"进
  文档模型（而不只是模拟 `writeFile` 消息本身）的自动化路径。
- **未验证的风险点**：`writeMediaFiles` 依赖 `fetch()` 能正确读取 `blob:` URL——
  这在标准浏览器里是有效行为（Blob URL Store 按源存储，同源都能 fetch），单测里也
  验证了函数本身的逻辑，但没有真实场景下"编辑器吐出的 `.bin` 是否真的按
  `media/<file>` 这个相对路径引用图片"这一假设的端到端确认（这个约定是从
  `readMediaFiles()`/`handleWriteFile` 两处写法反推出来的，理论上自洽，但没有实测
  兜底）。

## 后续

如果部署后用户反馈这条修复没有生效，下一步应该优先补上真实浏览器里的端到端验证
（可能需要先解决这个"Loading document"卡住工具栏的问题，或者找到不依赖工具栏点击、
直接调用 SDK 插入图片 API 的路径），而不是继续在这条假设链上往下猜。

## 顺带排查：#113 的 base64 修复实际有效，问题在 Qt WebEngine 侧

这次顺带也确认了一个之前遗留的疑点：`document:open-buffer` 报错 -85 的官方修复
（PR #115，`asc_openDocument` 的 `buf` 改传 base64 字符串）在真实 Chrome
里用同样的 embed API 路径**实测正常**，没有复现 -85。曾经怀疑是
`sdk-all-min.js` 里 `AscCommon.Mwg()` 格式检测函数把 base64 字符串当字节数组逐位
比对导致误判——用同源 iframe 访问 + 包一层 spy 的手法直接 patch 了 `Mwg`，
结果证明整个 `asc_openDocument` 打开流程里**这个函数根本没被调用过**，说明之前的
推测（"Mwg 检测失败默认归类成 pdf 从而报错"）大概率不是这条消息实际走的代码路径。
目前判断问题确实在 Qt WebEngine 环境本身（可能是其 postMessage/结构化克隆对长
字符串的处理有别于标准 Chromium），已跟用户对齐先搁置这条 issue，不在本文档
展开进一步分析。
