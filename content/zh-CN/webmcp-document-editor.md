---
title: WebMCP 文档编辑器 — 浏览器 AI 助手可直接调用
description: 一个注册了 WebMCP 工具的文档编辑器，浏览器里的 AI 助手可以直接调用它们来打开、读取、转换和导出 DOCX、XLSX、PPTX 和 PDF。全部在你的设备上运行。
eyebrow: 面向浏览器助手 · WebMCP
h1: 一个浏览器助手真正用得了的文档编辑器
lead: 这个编辑器注册了 **WebMCP** 工具，浏览器里的 AI 助手可以直接调用它们来打开、读取、转换和导出文档——而不必去猜和点一个为人设计的界面。
cta: 打开编辑器 →
ctaHref: /zh-CN/
ogDescription: 浏览器 AI 助手可以通过 WebMCP 工具在这里打开、读取、转换和导出文档。本地运行，不上传。
breadcrumb: webmcp-document-editor
howTo: 如何让浏览器 AI 助手处理你的文档
appDescription: 一个向浏览器内 AI 助手暴露 WebMCP 工具的浏览器文档编辑器，全部处理在本地设备完成。
---

## 如何操作

1. 使用提供 WebMCP API 的浏览器（Chrome，处于 origin trial 阶段）。
2. 把**编辑器**作为普通标签页打开——工具只在顶层页面注册。
3. 让浏览器的 AI 助手打开、读取、转换或导出文档。
4. 助手直接调用工具；处理在你的设备上完成，文件不会被上传。

大多数网页应用对 AI 助手来说是不透明的。它看到的是一堆按钮，只能猜哪个是转换，然后祈祷点对了。WebMCP——W3C Web Machine Learning 社区组的提案——让网页把自己能做的事直接声明成带类型输入的、可调用的结构化工具，从而绕开这一整套猜测。这个编辑器声明了七个。

这些工具是 open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state。它们不是另一套实现：调用的就是按钮调用的那套本地代码，也是 iframe 嵌入 API 驱动的那套。所以助手拿到的能力和人完全一致，保证也一致——转换引擎是跑在你标签页里的 WebAssembly，文件不会离开设备。

正是这个性质，才让「把文档交给助手」在这里是合理的。通常把文档交给助手，就等于交给了助手背后的那台服务器。而在这里，助手只负责编排，文档留在原地：从磁盘读进标签页，在标签页里转换，再写回本地。一个为了回答问题而读取合同正文的助手，从头到尾没有把这份合同上传到任何地方。

有两条限制是刻意的。工具只在编辑器作为顶层页面时注册——跨域 iframe 需要嵌入方页面授予 `allow="tools"`，这与嵌入的使用方式冲突，所以嵌入场景请改用 postMessage API 驱动。另外全文读取仅对文字文档可用；表格和演示文稿在当前引擎上没有这个接口，因此工具会明确说明，而不是返回一个可能被助手当成「文件是空的」的空结果。

## 常见问题

### WebMCP 是什么？

W3C Web Machine Learning 社区组的一项提案，让网页注册结构化工具供浏览器内的 AI 助手直接调用，而不必让助手去理解和点击用户界面。

### 这个编辑器注册了哪些工具？

七个：open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state。覆盖从 URL 或字节打开、新建文档、导出或转换、读取正文、切换只读，以及报告当前状态。

### 哪些浏览器支持？

WebMCP 目前在 Chrome 的 origin trial 中可用。Firefox 和 Safari 尚未表态。浏览器没有该 API 时，什么也不会注册、什么也不会变。

### 助手处理时我的文档会被上传吗？

不会。这些工具调用的就是界面调用的那套本地代码——转换引擎是跑在你浏览器标签页里的 WebAssembly，文件不会离开你的设备。

### 助手能读取我文档的内容吗？

文字文档可以，get_document_text 会返回正文，助手不必导出就能回答问题。表格和演示文稿在当前引擎上没有全文读取，工具会如实说明，而不是返回一个空结果。

### 编辑器被嵌入到别的网站时也能用吗？

按设计不能。工具只在顶层页面注册。嵌入场景请改用 postMessage 的 Embed API 驱动。

### 助手能把文件转成 PDF 吗？

能。save_document 接受目标格式，所以助手可以打开 DOCX、XLSX 或 PPTX 并导出 PDF，全程在设备上完成。

### 需要账号或 API Key 吗？

都不需要。编辑器本身不需要账号，它也不会自己调用任何 AI 服务——推理由你浏览器的助手完成，这个页面只负责暴露工具。
