# WebMCP 薄适配（2026-08-16）

路线图第 12 项 / 专节"WebMCP 评估与接入方案"第 1 步。

## 做了什么

`lib/web-mcp.ts`（全部 WebMCP 依赖收在这一个文件里，API 改形只动一处）：

- 特性检测 `document.modelContext ?? navigator.modelContext`（规范 2026-07
  从 navigator 迁到 document，两处都探），没有 → 直接返回，不引入 polyfill。
- 只在顶层窗口注册（`window.parent === window`）：跨域 iframe 需要父页
  `allow`，与 embed 场景冲突，首版不碰。
- 五个工具，直接调内部函数（不是 postMessage 自转发），与 embed-api 同一
  批语义：

  | 工具                   | 复用                                                  | 返回                                            |
  | ---------------------- | ----------------------------------------------------- | ----------------------------------------------- |
  | `open_document_url`    | `openDocumentFromUrl(url, name, {readonly})`          | `{ok, fileName, readonly}`                      |
  | `open_document_buffer` | base64 → `File` → `openLocalFile`（+ 只读）           | `{ok, fileName, size, readonly}`                |
  | `save_document`        | `requestSaveDocument(targetExt \|\| 同名格式)`        | `{fileName, mimeType, size, blobUrl, dataUrl?}` |
  | `set_readonly`         | `setReadonlyMode`                                     | `{ok, readonly}`                                |
  | `get_document_state`   | `getReadonlyMode` + `getDocmentObj` + `window.editor` | `{hasDocument, fileName, readonly}`             |

- 结果按 MCP 形状 `{content:[{type:'text', text: JSON}], isError?}`；
  `save_document` 不能回 `File`（要 JSON 可序列化）→ 回 blob URL，≤2 MB
  再附 data URL（agent 不一定读得到 blob:）。默认目标格式与 embed-api
  一致（doc→DOCX 等 legacy 映射）。
- `registerTool` 优先，没有则 `provideContext({tools})`；每个 execute 外包
  一层 try/catch，异常变 `isError` 结果而不是未处理 rejection。
- `index.ts` 在 `initEmbedApi()` 之后调 `initWebMcp()`。
- `public/llms.txt` 加一行工具目录（对 agent 的发现有用）。

## 验证

`test/unit/web-mcp.test.ts` 10 条：无 API 静默、document 优先于 navigator、
注册 5 个且幂等、provideContext 回退、iframe 内不注册、五个工具的输入
校验/转发/返回形状、抛错→isError。CI 的 Chromium 没有该 API，E2E 不覆盖
（与方案一致）。**尚未在带 flag 的 Chrome 上手测**——需要 Chrome 146+
开 `chrome://flags/#enable-webmcp`（或 origin trial token）后用浏览器内
agent 调一次；这是第 3 步，留给用户或下次带 flag 的会话。

## 待用户

- Origin trial 注册 edit.chaxus.com 的 token，`public/_headers` 下发
  `Origin-Trial:`（CF Pages 支持）；没有 token 时只有开 flag 的用户可见工具。

## 坑

- TypeScript 6 下 `new File([Uint8Array<ArrayBufferLike>])` 不合 `BlobPart`，
  解码时用 `new Uint8Array(new ArrayBuffer(n))` 得到 `Uint8Array<ArrayBuffer>`。
