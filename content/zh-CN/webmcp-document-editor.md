---
title: 'WebMCP 文档编辑器 — 浏览器 AI 助手可直接调用'
description: '浏览器代理可通过 WebMCP 工具在本地打开、读取、转换和导出文档；后续数据共享由代理决定。'
eyebrow: 面向浏览器助手 · WebMCP
h1: 一个浏览器助手真正用得了的文档编辑器
lead: 这个编辑器注册了 **WebMCP** 工具，浏览器里的 AI 助手可以直接调用它们来打开、读取、转换和导出文档——而不必去猜和点一个为人设计的界面。
cta: 打开编辑器 →
ctaHref: /zh-CN/
ogDescription: '浏览器代理可通过 WebMCP 工具在本地打开、读取、转换和导出文档；后续数据共享由代理决定。'
breadcrumb: webmcp-document-editor
howTo: 如何让浏览器 AI 助手处理你的文档
appDescription: '浏览器代理可通过 WebMCP 工具在本地打开、读取、转换和导出文档；后续数据共享由代理决定。'
---

## 如何操作

1. 使用提供 WebMCP API 的浏览器（Chrome，处于 origin trial 阶段）。
2. 把**编辑器**作为普通标签页打开——工具只在顶层页面注册。
3. 让浏览器的 AI 助手打开、读取、转换或导出文档。
4. WebMCP 工具在本地编辑和转换，但浏览器代理可以获取文档文本或导出文件，并可能发送给自己的 AI 服务。处理机密内容前，请确认代理的数据策略。

大多数网页应用对 AI 助手来说是不透明的。它看到的是一堆按钮，只能猜哪个是转换，然后祈祷点对了。WebMCP——W3C Web Machine Learning 社区组的提案——让网页把自己能做的事直接声明成带类型输入的、可调用的结构化工具，从而绕开这一整套猜测。这个编辑器声明了七个。

open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state. WebMCP 工具在本地编辑和转换，但浏览器代理可以获取文档文本或导出文件，并可能发送给自己的 AI 服务。处理机密内容前，请确认代理的数据策略。

默认关闭 · 仅此浏览器. [使用说明](/zh-CN/ai-document-assistant). 嵌入宿主可以接收导出文件，并按自己的策略上传。

有两条限制是刻意的。工具只在编辑器作为顶层页面时注册——跨域 iframe 需要嵌入方页面授予 `allow="tools"`，这与嵌入的使用方式冲突，所以嵌入场景请改用 postMessage API 驱动。另外全文读取仅对文字文档可用；表格和演示文稿在当前引擎上没有这个接口，因此工具会明确说明，而不是返回一个可能被助手当成「文件是空的」的空结果。

## 常见问题

### WebMCP 是什么？

W3C Web Machine Learning 社区组的一项提案，让网页注册结构化工具供浏览器内的 AI 助手直接调用，而不必让助手去理解和点击用户界面。

### 这个编辑器注册了哪些工具？

七个：open_document_url, open_document_buffer, create_document, save_document, get_document_text, set_readonly, get_document_state。覆盖从 URL 或字节打开、新建文档、导出或转换、读取正文、切换只读，以及报告当前状态。

### 哪些浏览器支持？

WebMCP 目前在 Chrome 的 origin trial 中可用。Firefox 和 Safari 尚未表态。浏览器没有该 API 时，什么也不会注册、什么也不会变。

### 助手处理时我的文档会被上传吗？

WebMCP 工具在本地编辑和转换，但浏览器代理可以获取文档文本或导出文件，并可能发送给自己的 AI 服务。处理机密内容前，请确认代理的数据策略。

### 助手能读取我文档的内容吗？

文字文档可以，get_document_text 会返回正文，助手不必导出就能回答问题。表格和演示文稿在当前引擎上没有全文读取，工具会如实说明，而不是返回一个空结果。

### 编辑器被嵌入到别的网站时也能用吗？

按设计不能。工具只在顶层页面注册。嵌入场景请改用 postMessage 的 Embed API 驱动。

### 助手能把文件转成 PDF 吗？

能。save_document 接受目标格式，所以助手可以打开 DOCX、XLSX 或 PPTX 并导出 PDF，全程在设备上完成。

### 需要账号或 API Key 吗？

调用 WebMCP 工具不需要账号或 API 密钥。核心的打开、编辑和格式转换在浏览器本地运行，不要求上传文档。 默认关闭 · 仅此浏览器. [使用说明](/zh-CN/ai-document-assistant). 嵌入宿主可以接收导出文件，并按自己的策略上传。
