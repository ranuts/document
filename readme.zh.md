# OnlyOffice Web

🌐 **在线体验**: https://ranuts.github.io/document/

[English](readme.md) | [中文](readme.zh.md)

基于 OnlyOffice 的本地网页文档编辑器，让您直接在浏览器中编辑文档，无需服务器端处理，保护您的隐私安全。

## ✨ 主要特性

- 🔒 **隐私优先**: 所有文档处理都在浏览器本地进行，不上传到任何服务器
- 📝 **多格式支持**: 支持 DOCX、XLSX、PPTX、CSV 等多种文档格式
- ⚡ **实时编辑**: 提供流畅的实时文档编辑体验
- 🚀 **无需部署**: 纯前端实现，无需服务器端处理
- 🎯 **即开即用**: 打开网页即可开始编辑文档
- 🌐 **URL 打开**: 通过 URL 参数直接从远程地址加载文档
- 🌍 **多语言支持**: 支持多种语言（英文、中文），轻松切换界面语言

## 📖 使用方法

### 基本使用

1. 访问 [在线编辑器](https://ranuts.github.io/document/)
2. 上传您的文档文件或从 URL 打开文档
3. 直接在浏览器中编辑
4. 下载编辑后的文档

### URL 参数

| 参数 | 说明 | 值/类型 | 优先级 |
|------|------|--------|--------|
| `locale` | 设置界面语言 | `en`, `zh` | - |
| `src` | 从 URL 打开文档（推荐） | URL 字符串 | 低 |
| `file` | 从 URL 打开文档（向后兼容） | URL 字符串 | 高 |

**示例：**

```bash
# 设置语言
?locale=zh

# 从 URL 打开文档
?src=https://example.com/document.docx

# 组合使用
?locale=zh&src=https://example.com/doc.docx
```

**注意**: 当同时提供 `file` 和 `src` 参数时，`file` 参数优先。远程 URL 必须支持 CORS。

### 作为组件库使用

本项目为 [@ranui/preview](https://www.npmjs.com/package/@ranui/preview) WebComponent 组件库提供文档预览组件的基础服务支持。

📚 **预览组件文档**: [https://chaxus.github.io/ran/src/ranui/preview/](https://chaxus.github.io/ran/src/ranui/preview/)

## 🛠️ 技术架构

- **OnlyOffice SDK**: 提供强大的文档编辑能力
- **WebAssembly**: 通过 x2t-wasm 实现文档格式转换
- **纯前端架构**: 所有功能都在浏览器中运行

## 🚀 部署说明

### Docker

```bash
# docker run
docker run -d --name document -p 8080:8080 ghcr.io/ranui/document:latest

# docker compose
services:
  document:
    image: ghcr.io/ranui/document:latest
    container_name: document
    ports:
      - 8080:8080
```

### 重要提示

- **CORS**: 使用 `src` 或 `file` 参数时，远程服务器必须支持 CORS
- **文件大小**: 大文件可能需要较长时间加载
- **支持格式**: DOCX、XLSX、PPTX、CSV、DOC、XLS、PPT、ODT、ODS、ODP、RTF、TXT 等多种格式

## 🔧 本地开发

```bash
git clone https://github.com/ranuts/document.git
cd document
npm install
npm run dev
```

## 🔤 字体管理

### 项目中的字体文件

本项目作为开源项目，为了符合开源许可要求，**不包含**受版权保护的字体文件，如 **Arial**、**Times New Roman**、**微软雅黑**、**宋体** 等 Windows 系统字体。这些字体的名称引用仍保留在配置文件中，以确保与现有文档的兼容性，但实际的字体文件已被移除，以符合开源许可要求。

### 添加字体

要为项目中已配置的字体（如 Arial、Times New Roman 等）添加字体文件，只需将字体文件放置在 `public/fonts/` 目录下，并重命名为对应的数字索引。该索引对应 `public/sdkjs/common/AllFonts.js` 文件中 `__fonts_files` 数组的索引位置。

**示例：添加 Arial 字体**

如果您想为项目添加 Arial 字体：

1. 查看 `AllFonts.js` 文件，找到 Arial 常规字体在 `__fonts_files` 数组中使用的索引是 `223`
2. 将您的 Arial 字体文件放置在 `public/fonts/` 目录下，并重命名为 `223`（无需扩展名）
3. 字体文件应位于 `public/fonts/223`
4. 当应用程序引用索引 `223` 时，会自动从 `public/fonts/223` 加载该字体文件

其他 Arial 字体变体同样处理：
- Arial 粗体使用索引 `226` → 将字体文件放置为 `public/fonts/226`
- Arial 斜体使用索引 `224` → 将字体文件放置为 `public/fonts/224`
- Arial 粗斜体使用索引 `225` → 将字体文件放置为 `public/fonts/225`

您可以通过查看 `AllFonts.js` 文件中的 `__fonts_infos` 数组来查找任何字体的索引，每个字体条目都指定了其常规、粗体、斜体和粗斜体变体的索引。

**注意**：请仅使用开源字体或您拥有合法使用许可的字体。在添加任何字体文件之前，请确保符合字体许可条款。

## 📚 参考资料

- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) - 基于 WebAssembly 的文档转换器
- [se-office](https://github.com/Qihoo360/se-office) - 安全文档编辑器
- [web-apps](https://github.com/ONLYOFFICE/web-apps) - OnlyOffice 网页应用
- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) - OnlyOffice JavaScript SDK

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

## 📄 许可证

详情请参阅 [LICENSE](LICENSE) 文件。
