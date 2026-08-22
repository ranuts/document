---
title: 在你的网站里嵌入文档编辑器 —— iframe + postMessage API
description: 用一个 iframe 加 postMessage API，把 DOCX、XLSX、PPTX、CSV 编辑器嵌入你的 Web 应用。鉴权与文件都留在你的应用里——编辑器看不到你的 token。开源（AGPL-3.0）、可自托管、可白标。
eyebrow: 开发者 · 嵌入
h1: 把文档编辑器嵌入你的 Web 应用
lead: 用一个 iframe 加 **postMessage** API，把 **DOCX、XLSX、PPTX、CSV** 编辑器加进你的产品。鉴权、文件访问和上传都留在你的应用里——编辑器只负责编辑，永远看不到用户的 token。
cta: 打开在线 demo →
ctaHref: /embed-demo.html
ogDescription: 用一个 iframe 把 DOCX/XLSX/PPTX/CSV 编辑器嵌入你的应用。鉴权留在你的应用里，编辑器看不到 token。开源、可自托管。
breadcrumb: 嵌入文档编辑器
howTo: 如何在网站里嵌入文档编辑器
appDescription: 可嵌入的 DOCX/XLSX/PPTX/CSV 编辑器：用一个 iframe 嵌入任意 Web 应用，用 postMessage API 驱动。鉴权与文件访问都留在父应用里。
---

编辑器完全在浏览器里用 OnlyOffice WebAssembly 引擎运行，文档在客户端渲染和编辑——你不需要部署文档服务器。推荐模式保持清晰边界： **父应用负责鉴权、拉取与保存；iframe 只负责编辑。**token、cookie 和业务 API 都留在你的应用里。

## 一个 iframe 就能接入

然后用 `postMessage` 和它通信。每条命令带一个 `id` 用来匹配回复，编辑器的每个事件都是 `document:*` 消息：

## 你能得到什么

- 一个 iframe + 一套小巧的 **postMessage** 命令/响应 API——无需安装 SDK
- 从 **URL、File 或 ArrayBuffer** 打开（都由你的应用用自己的凭据拉取）
- 保存回 **XLSX、DOCX、PPTX 或 CSV**，以 `File` 返回给你的应用上传
- 只读模式、按消息锁定 origin（`embedOrigin`）、状态查询
- 无需部署文档服务器——编辑 100% 是客户端 WebAssembly
- 开源（AGPL-3.0）、可自托管——在你自己的域名下嵌入

## 工作原理

1. 加入指向 `/editor?embed=1` 的 iframe，按布局设尺寸。
2. 等 `document:ready` 事件，再发送 `document:open-url`、`open-file` 或 `open-buffer`。
3. 用户就地编辑；除非你的应用主动发送，文件不会离开浏览器。
4. 发送 `document:save`，编辑器通过 `document:saved` 返回编辑后的文件，由你的应用用自己的鉴权上传。

## 只读与预览模式

需要"只看不改"（预览器、审阅环节、已归档记录）时，在打开命令里传 `readonly: true`；随时可以用 `document:set-readonly` 切换——不重新加载，文档停在用户原来的位置。只读期间禁止编辑， `document:save` 返回 `document:error`；`document:get-state` 会报告当前的 `readonly` 状态。

## 常见问题

### 怎么嵌入这个文档编辑器？

加入一个指向 `/editor?embed=1` 的 iframe，再用 postMessage API 驱动它打开与保存文档。可运行 demo 在 [/embed-demo.html](/embed-demo.html)。

### 编辑器会看到我用户的鉴权 token 吗？

不会。鉴权、文件拉取和上传都留在你的应用里——你的应用用自己的凭据拉取文件、把二进制传给编辑器，token 和 cookie 永远不会进入 iframe。

### 嵌入的编辑器支持哪些文件格式？

DOCX、XLSX、PPTX 和 CSV，用 OnlyOffice WebAssembly 引擎在客户端编辑。保存命令可导出为 XLSX、DOCX、PPTX 或 CSV。

### 可以自托管或白标使用吗？

可以。它以 AGPL-3.0 开源、是纯静态文件，你可以自托管一份、在自己的域名下嵌入。

### 怎么限制哪个站点能和编辑器通信？

在 iframe URL 上加 `embedOrigin` 把消息锁定到指定 origin，并在你自己的消息处理里校验 `event.origin`。

### 能只读展示文档，或者过一会儿再锁定吗？

能。打开时传 `readonly: true`，或随时发送 `document:set-readonly`——它直接切换正在运行的编辑器、不重新加载，锁定期间保存会被拒绝。
