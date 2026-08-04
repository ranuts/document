# Issue #113：document:open-buffer 在 Qt WebEngine 下报 -85 格式不匹配

日期：2026-08-04
分支：main
涉及：`lib/onlyoffice-editor.ts`、`lib/embed-api.ts`、`packages/shared/src/document-types.ts`、
`types/editor.d.ts`、`test/unit/onlyoffice-editor.test.ts`、`test/unit/embed-api.test.ts`

## 问题（GitHub issue #113）

在 Qt WebEngine (PySide6) 里通过 `document:open-buffer` 传 Base64 编码的 docx，
OnlyOffice 报错码 -85："文件内容对应于 pdf/djvu/xps/oxps 之一，但扩展名是 docx"。
提交者自己加了调试日志，观察到 `onAppReady` 里 `binData` 的 `typeof` 是
`"object"`，怀疑 ArrayBuffer 在传递过程中退化成了普通对象；反复改了
`onlyoffice-editor.ts`/`embed-api.ts`/`converter.ts` 但没修复成功。

## 分析

`typeof` 是 `"object"`本身不能说明问题——ArrayBuffer、Uint8Array 的 `typeof`
在 JS 里都是 `"object"`，这条诊断是误导。真正有信息量的是错误文案本身：
OnlyOffice 内部按 `_rels/.rels` 特征区分 pdf/djvu/xps/oxps 家族，docx 和
xps/oxps 一样是 ZIP/OPC 容器，只有当引擎收到的 `buf` **不是** x2t 转换产物、
而是原始 docx 的 ZIP 字节时，才会走到这条误判分支。

顺着 `window.editor.sendCommand({command:'asc_openDocument', data:{buf}})`
往下追到 vendored 的 `public/web-apps/apps/api/documents/api.js`：

```js
function i(e, o) {
  e && e.postMessage && t.JSON && (o.data?.event && (o = JSON.stringify(o)), e.postMessage(o, '*'));
}
```

`sendCommand` 把整个命令对象交给内部编辑器 iframe 的 `postMessage`，走浏览器
原生结构化克隆（不满足 `o.data.event` 时不会被 `JSON.stringify`）。这依赖宿主
环境对 `ArrayBuffer`/`TypedArray` 的结构化克隆实现是正确的——这正是内嵌
WebView（Qt WebEngine、以及类似的原生壳/WebChannel 桥接场景）历史上容易出问题
的地方。

关键佐证：项目里"新建空白文档"这条路径（`lib/empty_bin.ts` 的
`g_sEmpty_bin['.docx']` 等）存的就是 Base64 **字符串**，同样直接塞进
`data: { buf }` 发给 `asc_openDocument`，而这条路径一直工作正常。说明
OnlyOffice 引擎本身就接受 `buf` 是 Base64 字符串——字符串在任何环境下
`postMessage`/结构化克隆都不会失真，天然绕开了 ArrayBuffer 跨边界失真的整
类问题。

## 修复

1. **`lib/onlyoffice-editor.ts`**：`onAppReady` 里发送 `asc_openDocument`
   前，把 `binData`（Uint8Array/ArrayBuffer）统一转成 Base64 字符串再发送
   （已是字符串的"新建文档"分支保持不变），复用项目里已验证可行的路径。
   分块 `String.fromCharCode` 避免大文档时对 `...bytes` 展开撑爆调用栈。
   顺带效果：如果 `binData` 不是合法的二进制类型（比如未来 x2t 返回了奇怪
   的对象），`toUint8Array()` 会立刻抛出清晰的错误，而不是让 OnlyOffice
   报出难以定位的 -85。
2. **`lib/embed-api.ts`**：`document:open-buffer` 之前完全不支持 Base64
   字符串 payload——`payload.data` 是字符串时会直接落入
   `throw new Error('document:open requires ...')`。这是任何只能通过
   JSON 跨语言边界传数据的宿主（Qt WebEngine 的 `runJavaScript`、Electron
   IPC 等）唯一可行的传输方式，现在补上 `atob` 解码（含 `data:...;base64,`
   前缀的兼容）。
3. 类型层面把 `Window.editor.sendCommand` 的 `buf` 从 `ArrayBuffer` 放宽成
   `ArrayBuffer | string`（`packages/shared/src/document-types.ts` 与
   legacy 的 `types/editor.d.ts` 两处都要改，二者做 declaration merging，
   必须完全一致否则 TS2717）。`@ranuts/shared` 的类型是从 `dist/` 消费的，
   改完 `src` 记得 `pnpm --filter @ranuts/shared build` 重新生成 `.d.ts`。

## 局限性说明

没有 Qt WebEngine 环境可以直接复现，这个修复是基于代码走读 + vendored
OnlyOffice SDK 的静态分析定位的最可能根因（ArrayBuffer 结构化克隆跨内部
iframe 边界失真），而不是端到端复现验证过的。已请提交者在他们的实际环境里
验证。如果问题依旧存在，下一步要看 Qt WebEngine 是否对
`window.postMessage` 做了额外拦截/包装（例如注入了自定义的
`qwebchannel.js` 桥接逻辑），那就不是这个仓库能单方面修的了。

## 验证

- `pnpm run lint:ts`（oxlint + tsc）、`pnpm run format:check` 全过
- `pnpm run test`：20 个文件 263 个单测全过，新增 4 个用例覆盖
  Base64 payload 解码（含 data URL 前缀）与 `asc_openDocument` 收到的
  `buf` 确实是 Base64 字符串（含"新建文档"字符串分支保持不变的回归用例）
