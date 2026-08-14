# v9 x2t 转 PDF 错误码 80 根因定案 + 第三方离线包对比分析：同格式保存已绕开 x2t，PDF 导出需换 sdkjs 底座（路线 A）

日期：2026-08-11
分支：feat/v9-web-mode
状态：**错误码 80 的根因已完全查清（三层原因，逐层实证）**；同格式保存修复并
现场验证通过（不再经过 x2t）；文档转 PDF 在当前 sdkjs 底座上**确认无法仅靠
converter 侧修复**，需要按"路线 A"更换 vendor（见结论）。

## 背景

用户提供了本地解压的第三方 OnlyOffice 9.3.0.133 离线静态包
（含 9.4 版 x2t.wasm，AGPL-3.0，下称"离线包"），
要求分析它与当前分支的差异、找出可借鉴的点，
并推进"升级 v9 直接替换 v7"。用户选定路线："先 B 验证再转 A"——先把关键修复
移植进现有 public-v9 验证错误码 80，再决定是否整体换底座。

## 第三方离线包的核心发现（对比分析结论）

1. **它的 9.3 构建原生支持无服务器离线模式**。`_downloadAsFromLocal`、
   `openDocumentFromBinary` 都是编译产物自带；整个 1.1GB vendor 里只有
   **一个** 自研文件 `vendor/sdkjs/common/wasm/x2t/x2t_helper.js`（劫持
   `x2t.downloadFile` 抛文件流 + `OO_FILE_STREAM_ONLY` 沿 parent 链查找）。
   不需要我们这套 Engine.IO mock、断连抑制、忙碌计数器看门狗、10+ 混淆符号
   patch（`public-v9/onlyoffice-iframe-patch.js` 1207 行）。
2. **关键构建差异**：它的 `sdkjs/cell/sdk-all-min.js` 里有 `convertFromBin`
   调用（本地转换路径已编译进 SDK，出口是 `AscCommon.x2t`）；**我们的
   public-v9 sdkjs 完全没有**（grep 0 命中）——这就是当前分支被迫用混淆符号
   hack 才能拿到保存数据的根本原因。
3. 其它可借鉴点：新建 docx/xlsx/pptx 不需要模板（`document.url` 传
   undefined）；`document.key = id + updatedAt` 防缓存；PDF 用
   `openDocument({buffer})` 二进制直开；brotli 预压缩（x2t.wasm 40M→6.6M）；
   `spreadsheeteditor/main/resources/help` 占 364MB 可裁剪；postMessage 协议
   与我们 embed-api.ts 概念一一对应。

## 错误码 80 的三层根因（逐层实证过程）

### 第一层：v9 保存给我们的根本不是编辑器 bin，而是完整的 OOXML zip

转换失败后从 WASM FS 里读回 `/working/New_Document.bin` 的头部：
`50 4b 03 04 ...  _rels/.rels` —— **PK zip 头**。v9 的离线保存触发器
（`mTi`/`DOj`/`Ncj`）输出的是引擎自带 OOXML 导出器生成的**成品 xlsx 文件**
（7 个 zip 条目，完整合法）。此前"存为原格式能用"纯属巧合——x2t 拿到 zip
硬转同格式碰巧成功。

**修复**：`packages/converter/src/document-converter.ts` 新增
`isZipContainer()` 嗅探 PK 头。同格式保存直接原样返回字节（**完全不经过
x2t**，消灭了这条路径上的全部转换风险）；转 CSV 直接把 zip 当 xlsx 喂
SheetJS；跨格式转换按真实扩展名写入（`/working/doc.xlsx` 而不是
`/working/doc.bin`）让 x2t 从扩展名推断方向。现场验证：存 XLSX 一步直达
`showSaveFilePicker`，控制台零转换日志。

### 第二层：canvas 渲染流需要三个显式参数（从 x2t_helper.js 抄来的方案）

离线包的 `x2t_helper.js` L836-847 注释明确写着：打印/导出 PDF
时编辑器传给 x2t 的是**渲染指令流**，没有 DOCY/XLSY/PPTY/VSDY 签名，必须：

- `<m_nFormatFrom>8196</m_nFormatFrom>`（AVS_OFFICESTUDIO_FILE_CANVAS_PDF）
- `<m_nFormatTo>513</m_nFormatTo>`（转 PDF 时始终显式声明，否则报
  "Couldn't recognize conversion direction" → 错误码 88）
- `<m_bIsNoBase64>true</m_bIsNoBase64>`（渲染流是裸二进制；我们原来写死
  `false` 是 v7 文本 bin——`XLSY;v...;base64`——的约定）

已全部移植：签名嗅探（`hasEditorBinSignature`）决定 8196 与 noBase64，
PDF 目标始终带 FormatTo 513。**实证**：把他们环境里生成的 17 字节 canvas 流
搬进我们页面、用我们 vendor 的新 x2t + 仅 3 个字体转换 → **code 0，产出
1936 字节 PDF**。参数方案和新 x2t.wasm 都没问题。

### 第三层（真正的墙）：这份 x2t.wasm 不支持"文档 → PDF"直转，而我们的 sdkjs 给不出 canvas 流

交叉实验矩阵（同一份 v9 产出的 xlsx / 同一批参数）：

| 实验                    | 环境                                        | 结果                            |
| ----------------------- | ------------------------------------------- | ------------------------------- |
| xlsx → XLSY bin         | 我们页面，新 x2t                            | **code 0**（输入 zip 完全有效） |
| xlsx → pdf              | 我们页面，新 x2t，3 字体                    | code 80                         |
| xlsx → pdf（+PDFA）     | 我们页面                                    | code 80                         |
| XLSY bin → pdf          | 我们页面                                    | code 80                         |
| **xlsx → pdf**          | **他们页面，验证可用的 x2t + 9 个引擎字体** | **code 80**                     |
| canvas 流 → pdf（8196） | 他们页面                                    | code 0（4982 字节 PDF）         |
| canvas 流 → pdf（8196） | **我们页面，新 x2t，3 字体**                | **code 0（1936 字节 PDF）**     |

结论：**这个系列的 x2t.wasm 构建只支持 canvas 渲染流 → PDF，不支持
docx/xlsx/pptx → PDF 直转**（连他们自己的环境都转不了）。他们的 PDF 导出
之所以能用，是因为他们的 sdkjs 构建走 `_downloadAsFromLocal` →
`AscCommon.x2t.convertFromBin`，由**编辑器**生成 canvas 渲染流再交给 x2t。
我们的 sdkjs 构建没有这条路径（第 2 节），离线保存 hack 只能给出 OOXML zip
——所以在当前底座上，converter 侧无论怎么改都到不了 PDF。

## 顺手修掉的问题

- `lib/onlyoffice-editor.ts` `handleSaveDocument`：本地保存分支补了
  try/catch + `message.error` 提示（用现有 `documentOperationFailed` i18n
  键），转换失败不再是无 UI 反馈的 uncaught rejection（上一篇探索文档点名
  的遗留项）。现场验证：File picker 冲突错误正确弹出提示。
- `executeConversion` 错误码提示表补了 80 的含义。
- x2t 已换成离线包的 9.4 构建（`public-v9/wasm/x2t/`，
  wasm 42MB / gz 9.9MB / br 7.8MB，仍在 CF Pages 25MB 单文件限制内），
  glue 接口兼容（同为全局 Module + `_main1` 导出，无 pthread）。注意：两边
  wasm 里的版本串都是写死的 `2.5.565.0`（core 陈年常量），不能用它判断版本。
- 新增单测 9 个（签名嗅探、8196/FormatTo/noBase64 参数、zip 直通、zip 跨
  格式），全量 317 个测试通过，lint/format 通过。

## 结论与下一步（转路线 A）

"先 B 验证"已出结论：**B 修好了同格式保存（顺带消灭一类风险），但 PDF 导出
在当前 sdkjs 底座上是死路**。下一步按用户已确认的路线转 A：

1. 用离线包的 vendor（web-apps + sdkjs + x2t_helper.js）整体
   替换 `public-v9/` 的对应部分（x2t 本次已换完）。
2. 换底座后现有 1207 行 iframe patch 与 10+ 混淆符号 hook 预期可大部分删除
   （对方只需要一个 x2t_helper.js）；`lib/onlyoffice-editor.ts` 的
   `handleSaveDocument` 改为消费 `onlyoffice-file-stream` 风格的字节流。
3. 附赠能力：PDF 编辑器（pdfeditor app）与 Visio 查看。
4. 许可证：AGPL-3.0（与 OnlyOffice 本体一致），保留版权声明即可。
5. 体积治理照抄它的文档：裁掉 `spreadsheeteditor/main/resources/help`
   （364MB）、brotli 预压缩、版本 hash 目录 immutable 缓存。

本次已验证的 converter 修复（zip 直通、8196 参数族）在换底座后依然有用：
前者服务同格式保存快路径，后者正是 x2t_helper 同款方案，可以在迁移时直接
对齐。
