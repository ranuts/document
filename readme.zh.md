# 在线文档编辑器

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
    <img src="https://img.shields.io/badge/在线-edit.chaxus.com-brightgreen" alt="在线站点">
  </a>
</p>

<p align="center">
  <a href="readme.md">English</a> |
  <b>简体中文</b> |
  <a href="readme.ja.md">日本語</a> |
  <a href="readme.ko.md">한국어</a> |
  <a href="readme.de.md">Deutsch</a> |
  <a href="readme.es.md">Español</a> |
  <a href="readme.pt.md">Português</a> |
  <a href="readme.fa.md">فارسی</a>
</p>

在浏览器标签页里打开和编辑 Word、Excel、PPT 文件。没有服务器：OnlyOffice 引擎和它的
WASM 转换器都跑在访问者自己的设备上，文档不会被上传，也不需要注册账号。

**线上地址：[edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ 主要特性

- 🔒 **不上传任何文件** — 转换、编辑、导出全部发生在这个标签页里
- 📝 **是编辑，不是预览** — DOCX、XLSX、PPTX、CSV，另支持 ODF、RTF、TXT 与旧版二进制格式；PDF 可打开并批注
- 💾 **直接存回你自己的文件** — 选一次文件，之后每次保存都写回它（Chromium 系；其它浏览器仍是下载）
- 🕓 **误关标签页也不会丢** — 编辑内容自动保存进你自己的浏览器，保留 7 天，随时可手动删除（[说明](#-数据只留在你的设备上)）
- 📴 **可离线使用** — 可安装为 PWA，首次访问之后无需联网
- 🌍 **多语言** — 站点界面 8 种语言，编辑器界面 45 种
- 🧩 **可嵌入** — 完整的 iframe postMessage API
- 🤖 **面向 Agent** — 提供 WebMCP 工具，浏览器内的 AI Agent 可直接打开、转换、读取文档
- 🚀 **随处部署** — 纯静态产物，放在任意 Web 服务器后面即可

---

## 🚀 快速开始

**直接使用：**[edit.chaxus.com](https://edit.chaxus.com/)，无需安装。

**用 Docker 自建：**

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

**从源码运行：**

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install
pnpm run dev
```

---

## 📄 支持的格式

| 类型 | 可编辑           | 也能打开                    |
| ---- | ---------------- | --------------------------- |
| 文档 | `.docx`          | `.doc` `.odt` `.rtf` `.txt` |
| 表格 | `.xlsx` `.csv`   | `.xls` `.ods`               |
| 演示 | `.pptx`          | `.ppt` `.odp`               |
| PDF  | 批注、填写、导出 | `.pdf`                      |

以上都可以导出为 PDF。CSV 存回时保持原编码（打开时会依次嗅探 UTF-8、GB18030、Latin-1）。

---

## 🔗 路由与 URL 参数

| 路由                  | 说明                                     |
| --------------------- | ---------------------------------------- |
| `/`                   | 落地页。不打开文档就不会加载编辑器代码。 |
| `/editor`             | 编辑器。                                 |
| `/history`            | 本机浏览器当前保存的文档（见下）。       |
| `/help`、`/changelog` | 由 `content/` 下的 markdown 生成。       |

`/editor` 的参数：

| 参数           | 说明                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| `src=<url>`    | 从 URL 打开文档（该 URL 需允许 CORS）                                    |
| `file=<url>`   | 同上，旧写法；两者同时存在时以它为准                                     |
| `new=docx`     | 新建空白文档（`docx`、`xlsx`、`pptx`）                                   |
| `saved=<id>`   | 打开本机保存的某一篇——编辑器会把自己的 id 写在这里，因此刷新会回到同一篇 |
| `readonly=1`   | 只读打开：禁用编辑与导出                                                 |
| `embed=1`      | 嵌入模式，由宿主页面通过 postMessage 驱动                                |
| `locale=zh-CN` | 界面语言                                                                 |

---

## 🔐 数据只留在你的设备上

文档不会被发送到任何地方。在浏览器支持的情况下，保存会直接写回你选定的那个文件，
文档因此留在你自己的文件系统里，而不是下载目录里。浏览器本身还会保留两样东西，
且都可以由你删除：

- **你编辑过的文档副本**：编辑过程中，编辑器会把文档保存进这个浏览器（IndexedDB），
  刷新、误关标签页、浏览器崩溃都不会让工作白做，重新打开编辑器会提示你接着编辑。
  这些副本是为了让你接着做没做完的事，不是备份——想长期保留请导出到电脑。
- **七天后自动删除**：每篇文档在你最后一次编辑或打开的七天后自动删除，不需要你做任何事。

[`/history`](https://edit.chaxus.com/history) 列出当前保存了哪些文档，每一行都能删除，
也可以一次全部删除，还能直接关掉自动保存。在那里删除立即生效。共用电脑上，先看这一页。

---

## 🧩 通过 iframe 嵌入

嵌入编辑器并用 postMessage 驱动。常见分工是：你的系统负责鉴权与存储，iframe 只负责编辑。

```html
<iframe
  id="documentEditor"
  src="https://your-deployment/editor?embed=1"
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
  if (e.data?.type === 'document:opened') console.log('可以编辑了');
  if (e.data?.type === 'document:saved') uploadFile(e.data.payload.file);
});
```

嵌入模式下不会写入本地历史——那份文档属于宿主页面。

→ **[完整 API 文档](docs/embed-api.zh.md)** — 全部消息类型、来源白名单、只读模式与保存流程。

也可以作为组件使用：本项目为
[@ranui/preview](https://www.npmjs.com/package/@ranui/preview)
提供文档预览能力（[组件文档](https://chaxus.github.io/ran/src/ranui/preview/)）。

---

## 🤖 浏览器 AI Agent（WebMCP）

在支持该能力的浏览器上，页面会注册一组工具，浏览器内的 Agent 可以直接调用，而不必去"看"和"点"
界面：`open_document_url`、`open_document_buffer`、`create_document`、`save_document`、
`get_document_text`、`set_readonly`、`get_document_state`。文档同样不会离开设备——由浏览器
自己抓取和转换。浏览器没有这套 API 时整体无操作，对普通用户零影响。

---

## 🚀 部署

纯静态产物——没有运行时，没有数据库。

```bash
pnpm build   # 产物在 dist/
```

### 静态托管（Cloudflare Pages、Nginx、Vercel、Netlify……）

上传 `dist/` 即可。`public/_headers` 里写着本站期望的缓存契约（带哈希的资源永久缓存、
service worker 永不缓存）；不支持该文件的托管也能跑，只是会多做校验。

Nginx 需要把 `index.html` 作为未知路由的兜底：

```nginx
location / {
  root /var/www/document;
  try_files $uri $uri/ /index.html;
}
```

### GitHub Pages

`.github/workflows/pages-build-site.yml` 会在推送到 `main` 时构建并部署。
在仓库设置里启用 Pages，来源选 **GitHub Actions**。

### Docker

```bash
# 基础用法
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest

# 带 HTTPS 与基础认证
docker run -d --name document -p 443:443 \
  -v /path/to/certs:/ssl \
  -e SERVER_BASIC_AUTH='user:$2y$...' \
  -e SERVER_HTTP2_TLS=true \
  -e SERVER_HTTP2_TLS_CERT=/ssl/cert.pem \
  -e SERVER_HTTP2_TLS_KEY=/ssl/key.pem \
  ghcr.io/ranuts/document:latest
```

`SERVER_BASIC_AUTH` 接受 BCrypt 哈希；shell 里需要把 `$` 写成 `$$` 转义。
镜像自身的缓存策略在 `sws.toml`。

---

## 🔤 字体

随附的 OnlyOffice 构建把字体库放在 `public/fonts/`，由
`public/sdkjs/common/AllFonts.js` 建立索引。字体按需拉取——一篇文档只会下载它真正用到的那些。

→ **[字体管理指南](docs/fonts.zh.md)** — 索引字体目录的线格式、各处注册表，
以及如何用 `bin/font-catalog.mjs` 添加字体。

---

## 🛠 开发

```bash
pnpm install --frozen-lockfile
pnpm run dev            # 开发服务器
pnpm run build          # 生产构建（bin/build.sh）
pnpm run lint           # oxlint + tsc + docker 配置检查
pnpm run test           # 单元测试（Vitest）
pnpm run test:e2e       # 端到端测试（Playwright，真实编辑器 + 真实 WASM）
```

端到端测试跑的是真实编辑器和真实转换器，不是 mock，覆盖文档往返、嵌入协议与恢复流程。
`docs/explorations/` 记录了每一处不显然的设计为什么是现在这样——改编辑器集成之前值得先读。

---

## 📚 基于这些项目

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) 与 [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice 编辑器本体
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — WASM 文档转换器
- [ranui / ranuts](https://github.com/chaxus/ran) — 本站使用的设计体系与工具库
- [se-office](https://github.com/Qihoo360/se-office)、[onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — 无文档服务器运行 OnlyOffice 的先行方案

## 🤝 贡献

欢迎提 Issue 和 PR。`main` 受保护：请在分支上开发并提 PR，CI 会跑 lint、单元测试，
以及三套端到端测试（开发服务器、Cloudflare Pages 语义、生产 Docker 镜像）。

## 📄 许可证

[AGPL-3.0](LICENSE)
