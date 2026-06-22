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

**效果（2026-06-22 更新）**：拉丁字母和 CJK 文字均完整支持。后续在 `loadFontsForPdf()` 的 `fontNames` 数组中追加了 `NotoSansSC-Regular.ttf`，中日韩文字 PDF 导出一并修复（v7 + v9）。详见 `2026-06-22-production-cjk-and-pdf-fix.md`。

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

## 后续跟进（2026-06-22 更新）

| Issue | 状态 | 说明 |
|---|---|---|
| #64 Excel 右对齐不显示 | ✅ 已修复 | CJK 字体修复（`generateBundle` + v7/v9 font-map）覆盖此问题 |
| #62 日期输入不显示 | ✅ 已修复 | 同上，字体渲染一致性修复后解决 |
| #20 SmartArts 形状 | ✅ 已修复 | 从 v9 SmartArtData/*.bin 重建 SmartArts.bin（7.8MB，151 类型全覆盖）|
