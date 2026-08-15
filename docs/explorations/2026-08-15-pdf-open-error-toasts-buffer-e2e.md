# PDF 打开接入、错误码 toast、docx buffer E2E

日期：2026-08-15
分支：feat/v9-web-mode

## 背景

同类方案研究（见
[2026-08-14-peer-static-sdk-integration-study.md](2026-08-14-peer-static-sdk-integration-study.md)）
收尾后的第三轮落地：把 v9 最后一个待办（PDF 打开）清零，并补上两个由
issue 复盘推出的改进。

## 1. PDF 打开（v9 待办清零）

**改动量出乎意料地小。** 排查发现 vendor 的 `web-apps/apps/api/documents/
api.js` 的 `getAppPath` 本身就按 `config.document.fileType === 'pdf'`
把编辑器路由到 pdfeditor（appMap 里 `'pdf': 'pdfeditor'`），vendor 的
pdfeditor 与 sdkjs/pdf 资产齐全。页面侧缺的只有三处：

- `packages/shared/src/document-types.ts`：`DocumentType` 联合加 `'pdf'`；
- `packages/shared/src/document-utils.ts`：`DOCUMENT_TYPE_MAP` 加
  `pdf: 'pdf'`、`getDocumentType` 加 pdf 分支；
- `lib/document.ts`：文件选择 accept 列表加 `.pdf`。

打开走既有 blob URL 链路，保存与其他格式共用 `onlyoffice-file-stream`
通道（该 handler 本就扩展名无关），无需任何新逻辑。

**E2E**：页内构造合法最小单页 PDF（真实计算 xref 偏移，严格解析器也能
接受）→ `document:open-buffer` 打开 → 断言 Playwright frames 里真实出现
`/pdfeditor/` iframe（防"静默回落到 word 编辑器"）→ `document:get-state`
`hasDocument: true`。

## 2. 编辑器错误码用户可见提示

复盘 #113 的报障过程：用户只能截图一个 `-85`，页面上没有任何可自助排查
的信息（`onError` 只 `console.error`）。现在 `onError` 会用 ranui message
弹 toast：`editorErrorToast` + 错误码 + 引擎的 errorDescription；对 -85
（内容与扩展名不一致，#113 同类）附专门提示 `editorErrorFormatMismatch`。
i18n 中英两套词条各加两键。

## 3. docx open-buffer E2E（#113 的直接守护）

此前 E2E 只覆盖 xlsx 的 open-buffer，而 #113 恰恰是 docx。借同类方案
"零依赖手写 ZIP fixture"的思路，在页面 evaluate 里手拼最小 OOXML docx
（自实现 CRC32 + stored 模式 local/central header + EOCD，三个 part：
[Content_Types].xml、_rels/.rels、word/document.xml）→ open-buffer 打开
→ `targetExt: 'DOCX'` 保存 → 断言返回文件名、PK 魔数与体积。仓库依旧
不放任何二进制 fixture。

## 验证

- oxlint + tsc、prettier 全过；
- 单测 298 全绿（`DOCUMENT_TYPE_MAP` 快照测试随 pdf 条目更新）；
- E2E 17 全绿（新增 docx buffer 往返、PDF 打开两条，全部真实编辑器）。

## 关联文档更新

- CLAUDE.md：项目概述格式列表加 pdf；v9 章节"待办"清零，新增 PDF 打开、
  错误提示两条说明；E2E 回归清单加两行。
