# v9 分支整体 simplify review：删冗余、归一重复实现、清理过时注释

日期：2026-08-13
分支：feat/v9-web-mode
状态：**完成**。按 reuse / simplification / efficiency / altitude 四个角度
review 了分支相对 main 的全部代码改动（public-v9 vendor 除外），应用 6 类
修复；302 单测、覆盖率阈值、lint、format、v7 + v9 两套 E2E 全绿。
（并行审查子代理连续两轮被 API 529 打挂，最终改为内联逐角度人工过 diff。）

## 已修复

1. **保存到磁盘逻辑去重（最大项，净删 ~90 行）**：`lib/onlyoffice-editor.ts`
   的 `saveFileLocally` 与 `packages/converter` 私有的
   `saveWithFileSystemAPI` + `downloadFile` 是同一件事的两份实现。合并为
   converter 包导出的 `saveFileToDisk(data, fileName, mimeType?)`（File
   System Access API + anchor 兜底 + 成功 toast，取消静默返回、失败抛出），
   v7 的 `convertBinToDocumentAndDownload` 与 v9 的 `routeSavedFile`
   共用一份。
2. **文档 MIME 表归一**：lib 与 converter 各持一份几乎相同的文档 MIME 映射。
   规范表落到 `@ranuts/shared/document-utils` 的 `getDocumentMimeType()`，
   lib 的 `getSavedFileMimeType` 变为委托（保留导出，单测不变），converter
   的私有副本删除。注意 shared 原有的 `getMimeTypeFromExtension` 是图片向
   的（兜底 image/png），职责不同，未合并。
3. **过时注释清理**：`documentContentReady` 一段还在讲已删除的旧 Web Mode
   （asc_openDocumentFromBytes / `za` / `P_g`）、`waitForDocumentContentReady`
   引用已删除的 `runWebModeOnAppReady`、`OO_VARIANT` 头注释与
   `requestSaveDocument` 内注释描述旧机制——全部改写为当前架构的事实。
4. **轮询提前停止**：`prepareEditorIframe` 改为返回"三项处理是否已全部就位"，
   `onAppReady` 的 200ms 重试 interval 一旦就位立即 clear（原先固定空转
   15 秒）；`requestSaveDocument` v9 重试循环捕获所属请求，请求 settle
   （流已到或超时）后立即停止（原先可能在请求结束后仍然重试触发导出）。
5. **toast 断言去重**：`(window as unknown as { message?... }).message?.error?.(...)`
   重复三处，提取为 `notifyOperationFailed(error)`。
6. **测试适配**：`@ranuts/shared/document-utils` 的 mock 改为
   `importOriginal` 部分 mock（新导出自动透传）。

## 审查后决定不动的（记录理由）

- **onlyoffice-editor.ts 拆分 v7/v9 两个模块**：v9 集成段约 300 行与 v7 共享
  `embeddedSaveRequest` / ready-gate / 保存路由等模块状态，硬拆需要导出内部
  状态或引入 context 对象，churn 大于收益；当前 ~1000 行、分段清晰，暂缓。
  上线切换、v7 退役时再拆。
- **CSV 特例分散三处**（打开转 XLSX / 保存流转回 CSV / 导出请求映射）：三处
  注释已互相引用并指向同一根因（编辑器吃不下裸 CSV、CSV 导出弹分隔符对话
  框）；真正收敛需要一个 per-document session 抽象，超出本轮范围。
- **converter 的 canvas 流参数路径（8196/hasEditorBinSignature/noBase64）**：
  v9 保存已不再经过页面级 x2t，此路径当前实际不可达，但它是有单测、有文档
  的防御性基础设施（bin 转换 API 的一部分），删除的风险大于维护成本。
- **E2E 用例内重复的 workbook 构造代码**：每个用例在独立的浏览器 evaluate
  里构造 fixture，共享需要 exposeFunction/initScript，损失用例自包含性；
  测试代码以清晰为先，保留。

## 验证

- 302 单测通过；覆盖率 43%/46%/46%（阈值 34/25/35，删掉的是未测行，阈值
  余量更大）。
- lint:ts、format:check 通过。
- `pnpm run test:e2e`（v7，10 用例）与 `pnpm run test:e2e:v9`（4 用例）
  全部通过。
