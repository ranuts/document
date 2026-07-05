# OnlyOffice Web

<p align="center">
  <a href="https://github.com/ranuts/document/actions/workflows/ci.yml">
    <img src="https://github.com/ranuts/document/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://github.com/ranuts/document/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/ranuts/document" alt="授权许可">
  </a>
  <a href="https://github.com/ranuts/document/releases">
    <img src="https://img.shields.io/github/v/release/ranuts/document" alt="版本">
  </a>
  <a href="https://edit.chaxus.com/">
    <img src="https://img.shields.io/badge/在线-体验-brightgreen" alt="在线体验">
  </a>
</p>

<p align="center">
  <a href="readme.md">English</a> | <b>中文</b>
</p>

基于 OnlyOffice 的隐私优先浏览器文档编辑器。直接在浏览器中编辑 DOCX、XLSX、PPTX、CSV 文件——无需服务器、无需上传、无需注册账号。

---

## ✨ 主要特性

- 🔒 **隐私优先** — 所有处理在本地完成，不上传任何数据
- 📝 **多格式支持** — DOCX、XLSX、PPTX、CSV 等
- 🚀 **无需服务器** — 纯前端实现，可部署到任意静态托管
- 🌐 **URL 打开** — 通过 `?src=` 或 `?file=` 参数直接加载远程文档
- 📦 **PWA 支持** — 可安装，支持离线使用
- 🌍 **多语言** — 中文、英文及更多语言
- 🧩 **可嵌入** — 完整的 postMessage API 支持 iframe 集成

---

## 🚀 快速开始

**在线体验：** [edit.chaxus.com](https://edit.chaxus.com/)

**Docker 运行：**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**本地开发：**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📖 使用方法

### 打开文档

1. 点击上传按钮选择本地文件，或
2. 通过 URL 参数传入：`?src=https://example.com/document.docx`

> 远程 URL 需支持 CORS。

### URL 参数

| 参数     | 说明                        | 优先级 |
| -------- | --------------------------- | ------ |
| `src`    | 从 URL 打开文档（推荐）     | 低     |
| `file`   | 从 URL 打开文档（向后兼容） | 高     |
| `locale` | 设置界面语言（`en`、`zh`）  | —      |

同时提供 `src` 和 `file` 时，`file` 优先。

### 离线使用（PWA）

通过 HTTPS（或 localhost）访问编辑器，点击地址栏中的**安装**图标。安装后可在无网络环境下正常使用。

> Service Worker 在 `file://` 协议下无法工作，请使用本地服务器或已安装的 PWA。

### 作为组件库使用

本项目为 [@ranui/preview](https://www.npmjs.com/package/@ranui/preview) WebComponent 组件库提供文档预览能力。

📚 [预览组件文档](https://chaxus.github.io/ran/src/ranui/preview/)

---

## 🧩 iframe 嵌入

将编辑器嵌入到你的应用中，通过 postMessage 控制。推荐架构：父系统负责鉴权和文件上传，iframe 只负责编辑。

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/?embed=1"
  style="width: 100%; height: 720px; border: 0"
></iframe>
```

```js
// 打开文档
iframe.contentWindow.postMessage(
  { id: '1', type: 'document:open-url', payload: { url: 'https://example.com/doc.xlsx' } },
  'https://your-deployment',
);

// 监听结果
window.addEventListener('message', (e) => {
  if (e.data?.type === 'document:opened') console.log('可以开始编辑');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

→ **[完整 API 文档](docs/embed-api.zh.md)** — 所有消息类型、参数说明及示例，包含鉴权、只读模式、保存流程等。

---

## 🚀 部署

这是纯静态应用，构建一次即可部署到任意平台。

```bash
pnpm build   # 输出到 dist/
```

### GitHub Pages

推送到 `main` 分支后，内置工作流（`.github/workflows/pages-build-site.yml`）会自动构建并部署。在仓库 Settings → Pages 中将 Source 设置为 **GitHub Actions** 即可。

### 静态托管（Nginx、Vercel、Netlify、Cloudflare Pages 等）

将 `dist/` 目录上传到任意静态托管服务，无需服务端运行时。

Nginx 参考配置（将所有路由回退到 `index.html`）：

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### Docker

```bash
# 基础部署
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# 启用 HTTPS 和基础认证
docker run -d --name document -p 443:443 \
  -v /证书路径:/ssl \
  -e SERVER_BASIC_AUTH='用户名:BCrypt加密密码' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` 使用 BCrypt 加密密码，加密结果中的 `$` 需替换为 `$$` 进行转义。

---

## 🔤 字体

本项目不包含 Arial、Times New Roman、微软雅黑等受版权保护的字体文件，以符合开源许可要求。字体名称引用保留以确保文档兼容性。

→ **[字体管理指南](docs/fonts.zh.md)** — 如何按索引添加字体。

---

## 📚 参考资料

- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — 基于 WASM 的文档转换器
- [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice 网页应用
- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) — OnlyOffice JavaScript SDK
- [se-office](https://github.com/Qihoo360/se-office) — 安全文档编辑器
- [onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — 本地网页版 OnlyOffice

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[AGPL-3.0](LICENSE)
