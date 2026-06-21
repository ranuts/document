# Issue 修复批次记录

**日期**：2026-06-22  
**关联 Issue**：#20、#28、#34、#49、#72

---

## #49 — .doc 文件转换失败（code 88）

**现象**：打开 `.doc` 文件时报 "Document conversion failed: conversion failed with code: 88"

**根因**：x2t WASM 返回错误码 88。该错误码在以下情况触发：
- `.doc` 文件（Office 97-2003 二进制格式）使用了不被支持的特性
- 文件加密/密码保护
- 文件已损坏

**修复**：在 `executeConversion()` 中为已知错误码添加人类可读的提示信息（v7 + v9）：
```typescript
const hints: Record<number, string> = {
  88: 'The file may be in an unsupported format (.doc binary format), password-protected, or corrupted. Try converting to .docx first.',
  55: 'DRM-protected or encrypted file cannot be opened.',
  1: 'Invalid or corrupted file.',
};
```

---

## #28 — 另存为 PDF 内容为空

**现象**：另存为 PDF 后，生成的文件有页面但没有文字内容（视觉上是空白）。

**根因**：`convertBinToDocument` 在 PDF 模式下添加了 `<m_sFontDir>/working/fonts/</m_sFontDir>` 参数，但 `/working/fonts/` 目录在 WASM 虚拟文件系统中是空的。x2t 在没有字体的情况下生成的 PDF 有结构（页面、段落框架）但文字不可见（使用了空字体替代）。

**修复**：在 PDF 转换前调用 `loadFontsForPdf()`（v7 + v9），该方法从 HTTP 端点获取基础字体并写入 WASM FS：
```typescript
// 首次 PDF 转换时从 /fonts/ 加载字体
const fontNames = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Regular.ttf'];
// 获取后写入 /working/fonts/，后续转换复用（fontsLoaded 标志位）
```

**效果**：拉丁字母文字可以正常显示。CJK 文字（中文、日文、韩文）在文档转 PDF 时仍可能显示为方块，因为 NotoSansSC 等 CJK 字体体积过大（10-17MB），暂不在每次 PDF 转换时加载。

---

## #34 — RTL 语言支持

**结论**：OnlyOffice 已原生支持 RTL（从右到左）语言，无需代码改动。

用户可通过 **格式（Format）→ 段落（Paragraph）→ 高级** 中启用 RTL 排版。已在 GitHub 评论中说明。

---

## #72 — 外部图片 URL 无法保存/显示

**现象**：
- 从网页复制带链接的图片，粘贴后保存时报错
- 插入在线 URL 图片不显示

**根因**：浏览器同源策略（CORS）限制。

v9 的 `AscDesktopEditor.DownloadFiles` polyfill 使用 `fetch(url, { mode: 'cors' })` 下载外部图片。当目标服务器没有设置 CORS 响应头时，请求被浏览器拒绝，返回 `result[url] = ''`（空键），SDK 无法获取图片数据嵌入文档。

**本质**：零服务器架构的固有限制。Document Server 部署可以通过服务端代理绕过 CORS。

**临时解决方案**：用户先下载图片到本地，再通过「插入图片 → 从本地文件」上传。已在 GitHub 评论中说明。

---

## 待后续跟进

| Issue | 状态 | 说明 |
|---|---|---|
| #64 Excel 右对齐不显示 | 待测试 | HiDPI 修复（#15）可能改善此问题 |
| #62 日期输入不显示 | 待测试 | 可能是 CJK 字体问题或 HiDPI 相关 |
| #20 SmartArts 形状 | 部分修复 | 404 已消除，实际渲染数据缺失 |
