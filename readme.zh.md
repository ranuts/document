# OnlyOffice Web

🌐 **在线体验**: https://ranuts.github.io/document/

[English](readme.md) | [中文](readme.zh.md)

基于 OnlyOffice 的本地网页文档编辑器，让您直接在浏览器中编辑文档，无需服务器端处理，保护您的隐私安全。

## ✨ 主要特性

- 🔒 **隐私优先**: 所有文档处理都在浏览器本地进行，不上传到任何服务器
- 📝 **多格式支持**: 支持 DOCX、XLSX、PPTX 等多种文档格式
- ⚡ **实时编辑**: 提供流畅的实时文档编辑体验
- 🚀 **无需部署**: 纯前端实现，无需服务器端处理
- 🎯 **即开即用**: 打开网页即可开始编辑文档

## 🛠️ 技术架构

本项目基于以下核心技术构建：

- **OnlyOffice SDK**: 提供强大的文档编辑能力
- **WebAssembly**: 通过 x2t-wasm 实现文档格式转换
- **纯前端架构**: 所有功能都在浏览器中运行

## 📖 使用方法

### 基本使用

1. 访问 [在线编辑器](https://ranuts.github.io/document/)
2. 上传您的文档文件
3. 直接在浏览器中编辑
4. 下载编辑后的文档

### 作为组件库使用

本项目同时为 [@ranui/preview](https://www.npmjs.com/package/@ranui/preview) WebComponent 组件库提供文档预览组件的基础服务支持。

📚 **预览组件文档**: [https://chaxus.github.io/ran/src/ranui/preview/](https://chaxus.github.io/ran/src/ranui/preview/)

## 🚀 部署说明

- **自动部署**: 当代码推送到主分支时，项目会自动部署到 GitHub Pages
- **手动部署**: 您也可以将项目部署到任何静态网站托管服务

### docker run

```bash
docker run -d --name document -p 8080:8080 ghcr.io/ranui/document:latest
```

### docker compose

```yaml
services:
  document:
    image: ghcr.io/ranui/document:latest
    container_name: document
    ports:
      - 8080:8080
```

## 🔧 本地开发

```bash
# 克隆项目
git clone https://github.com/ranuts/document.git

# 进入项目目录
cd document

# 安装依赖
npm install
# 启动本地开发服务器
npm run dev
```

## 📚 参考资料

- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) - 基于 WebAssembly 的文档转换器
- [se-office](https://github.com/Qihoo360/se-office) - 安全文档编辑器
- [web-apps](https://github.com/ONLYOFFICE/web-apps) - OnlyOffice 网页应用
- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) - OnlyOffice JavaScript SDK
- [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) - 本地网页版 OnlyOffice 实现

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目！

## 📄 许可证

详情请参阅 [LICENSE](LICENSE) 文件。
