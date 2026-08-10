# Issue #113 复盘：上一次修复（18bb045）本身是错的——bin 不能再包一层 base64

日期：2026-08-11
分支：fix/issue-113-embed-buffer-base64（PR #115）
涉及：`lib/onlyoffice-editor.ts`、`test/unit/onlyoffice-editor.test.ts`

## 背景

18bb045（PR #115）尝试修复 #113：把 `asc_openDocument` 的 `binData` 从原始
ArrayBuffer 改成 `btoa` 后的 base64 字符串再发送，理由是"字符串跨 postMessage
不失真，且 empty_bin.ts 的新建文档路径传的就是字符串且一直正常"。测试者
（zjhtsgr）在 PySide6 / Qt WebEngine 环境拉分支验证后报告依旧 -85，并推断
"根因在 OnlyOffice SDK 内部的 postMessage 解析，需 OnlyOffice 官方修复"。

本次用本地 dist + 真实 Chrome 把整条链路做了端到端验证，结论：**测试者
"修复无效"的结果是对的，但根因推断是错的——问题出在 18bb045 自己身上**。

## 实测发现（决定性证据）

1. **x2t v7.5 输出的 Editor.bin 本身就是文本容器**。构造最小 docx 走完整
   embed 链路后，从 x2t 的 Emscripten FS 里取出 `/working/*.docx.bin`：
   内容以 `DOCY;v5;761;BACA...` 开头——ASCII 头 + base64 负载，与
   `lib/empty_bin.ts` 模板格式**完全一致**。

2. **sdkjs 对字符串 buf 只做字面签名嗅探，不做 base64 解码**。vendored
   `public/sdkjs/word/sdk-all-min.js` 中的检测逻辑（去混淆后）：

   ```js
   switch (typeof t == 'string' ? t.slice(0, 4) : AscCommon.a2a(t, 4)) {
     case 'DOCY': ...
     case 'XLSY': ...
     case 'PPTY': ...
   }
   ```

   这就是"新建文档字符串路径一直正常"的真正原因：模板字符串以 `DOCY;`
   开头。18bb045 把 bin 整体 `btoa` 后得到 `RE9DWTt2...`，`slice(0,4)`
   变成 `RE9D`，嗅探失败。

3. **18bb045 在普通 Chrome 里也是坏的**：embed base64 打开文档永久卡在
   "Loading document"，静默无报错（`asc_openDocument` 已送达内部 iframe，
   但引擎认不出 buf 格式后不弹错）。之前只有单测（断言"buf 是 base64
   字符串"——断言了错误的期望格式），没有过浏览器级验证，所以漏掉了。
   Qt WebEngine 下表现为 -85，Chrome 下表现为静默挂起，症状不同、根因相同。

4. **正确做法当场验证通过**：对同一个编辑器实例直接
   `sendCommand({command:'asc_openDocument', data:{buf: <bin 按 latin1 逐字节转的字符串>}})`
   （即保留 `DOCY;v5;...` 原文），文档立即打开渲染。

5. 顺带确认：线上 edit.chaxus.com 的 bundle（`assets/index-7XKO2PIq.js`）
   截至 2026-08-10 仍是修复前代码（`data:{buf:r}` 直发），18bb045 从未部署。

## 修复

`lib/onlyoffice-editor.ts`：`toBase64()` 改为 `toBinaryString()`——同样的分块
`String.fromCharCode`，但**去掉 `btoa`**，把 bin 字节按 latin1 无损映射为
字符串（U+0000–U+00FF，postMessage 克隆无损，任何宿主环境下都不会像
ArrayBuffer 那样失真）。v5 bin 容器本身是纯 ASCII，latin1 只是保险。

`test/unit/onlyoffice-editor.test.ts`：修正 #113 用例的断言——buf 必须以
`DOCY;v5;` 开头（即 bin 原文），并加一个 0xFF 高位字节验证 latin1 往返无损；
删除错误的 `atob` 解码断言。

## 验证

- `pnpm run test`：20 文件 263 用例全过
- `pnpm run lint:ts` + `pnpm run format:check` 全过（期间需
  `pnpm --filter @ranuts/shared build` 重建 dist 类型——本机残留了别的分支
  构建的 `serviceCommand` 版声明导致 TS2717，与本次改动无关）
- **浏览器端到端**（本地 `vite preview` + Chrome）：`?embed=1` 页面
  postMessage `document:open-buffer`（base64 docx）→ x2t 转换 →
  `asc_openDocument`（`DOCY;` 字符串）→ `onDocumentReady` 触发、正文
  "Hello from issue 113 repro" 正常渲染；修复前同一路径永久卡
  "Loading document"

## 给测试者的定位建议（已写进 issue 回复）

在 `sendCommand` 处打印 `buf.slice(0, 8)` 一击定位：

| 前缀       | 含义                                                |
| ---------- | --------------------------------------------------- |
| `DOCY;v5;` | 数据格式正确（本次修复后的预期值）                  |
| `RE9DWT`   | 跑的是 18bb045 的坏修复，拉最新分支重测             |
| `UEsDB`    | 原始 docx 未经 x2t 转换，需查 x2t WASM 是否加载成功 |

另外测试者日志里 "onAppReady 被调用 4 次"，多半是宿主重复发送了 4 次
open 消息（每次都会销毁重建编辑器），与 -85 无关，但值得在宿主侧排查。

## 后续（同日）：场景复现 demo + e2e 回归测试

这次事故暴露两个缺口：没有贴近用户场景（Qt WebEngine）的本地复现手段、
embed open-buffer 全链路没有自动化回归。补齐如下：

1. **`demo/qt-webengine/`**（PySide6 宿主 demo）：QWebEngineView 加载本地
   preview，注入 base64 docx，回显页面 console 并 hook `sendCommand` 打印
   `asc_openDocument` 的 buf 前缀诊断。已在 PySide6 6.11.1 / macOS 实测：
   - **修复后代码**：`bufHead="DOCY;v5;"` → `onDocumentReady`，打开成功；
   - **18bb045 坏代码**（worktree 构建对照）：`bufHead="RE9DWTt2"` →
     **onError**（对应测试者的 -85）→ 超时不打开。

   由此确认：同一根因在 Qt WebEngine 表现为 -85 报错、在桌面 Chrome 表现
   为静默挂起，症状差异只是引擎错误上报路径不同，最后的疑点闭环。

2. **`test/e2e/embed-open-buffer.spec.ts`**：Playwright 用例走完整链路
   （postMessage base64 → x2t 转换 → `asc_openDocument` → `onDocumentReady`），
   并断言 buf 前缀必须是 `DOCY;v5;`——如果再出现格式回归，会立刻红而不是
   超时。fixture 为手工构造的 932 字节最小 docx
   （`test/e2e/fixtures/minimal.docx`）。本地全套 e2e 11 用例通过（新用例
   2.3s）。
