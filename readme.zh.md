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

**开源文档工作台，为你和 AI Agent 准备。**

在浏览器里打开、编辑、转换并保存 Word、Excel 和 PowerPoint，为 PDF 添加批注。基础文档处理在本地完成，无需注册或安装 Office。

支持可选 AI 助手（Experimental Beta）、WebMCP Agent 调用和 PWA 安装；已缓存的编辑器资源可离线使用，也可自行部署或嵌入应用。

**在线体验：[edit.chaxus.com](https://edit.chaxus.com/)**

---

## ✨ 主要特性

- **本地编辑与转换。** 文档处理在你的设备上完成，无需上传文档即可编辑和转换。
- **自由保存，继续工作。** 浏览器支持时可存回选定文件，也可下载导出；从当前浏览器恢复最近的编辑。
- **与 AI 协作（Experimental Beta）。** 起草和润色文字、处理表格数据、创建幻灯片，或询问当前 PDF 页面的内容；审阅后再应用修改。
- **让 Agent 调用文档工具。** 支持 [WebMCP](docs/reference.md#webmcp-agent-tools) 的浏览器中，AI Agent 可打开、转换、导出文档，读取文字文档正文。
- **安装为 PWA。** 像应用一样使用，已缓存的编辑器资源可离线复用。
- **自行部署与集成。** 可作为静态站点部署，也可通过 iframe API 嵌入你的应用。

## 🚀 快速开始

[新建文档](https://edit.chaxus.com/editor?new=docx&locale=zh-CN) · [新建表格](https://edit.chaxus.com/editor?new=xlsx&locale=zh-CN) · [新建演示](https://edit.chaxus.com/editor?new=pptx&locale=zh-CN)

也可以运行自己的版本：

```bash
docker run -d --name document -p 8080:80 ghcr.io/ranuts/document:latest
```

## 📄 支持的格式

| 类型 | 可编辑           | 也能打开                    |
| ---- | ---------------- | --------------------------- |
| 文档 | `.docx`          | `.doc` `.odt` `.rtf` `.txt` |
| 表格 | `.xlsx` `.csv`   | `.xls` `.ods`               |
| 演示 | `.pptx`          | `.ppt` `.odp`               |
| PDF  | 批注、填写、导出 | `.pdf`                      |

支持的文档可导出为 PDF。

还支持多语言界面、明暗主题和只读预览。

## 🔐 本地编辑与数据去向

恢复副本保存在当前浏览器，最后编辑或打开后保留 7 天，可在[已保存的文档](https://edit.chaxus.com/history)中删除。恢复副本不是备份，重要文件请及时导出。

使用外部 AI 服务时，请求所需内容会发送到该服务；本机模型在设备上处理。浏览器听写可能使用在线语音服务，嵌入模式下的导出由宿主应用处理。

浏览器 AI Agent 对文档工具返回内容的后续处理，由所用 Agent 决定。

## 文档与集成

[使用指南](https://edit.chaxus.com/zh-CN/help) · [自行部署、URL 参数与集成](docs/reference.md) · [嵌入 API](docs/embed-api.zh.md) · [字体管理](docs/fonts.zh.md)

离线使用需要已缓存的编辑器资源，未缓存的资源和远程文件仍需联网。

## AI 文档助手 (Experimental Beta)

起草和润色文字、处理表格数据、创建幻灯片，或询问当前 PDF 页面的内容。先审阅修改建议，再决定是否应用；需要时可撤销。

可选择本机模型或连接自己的 AI 服务；浏览器支持时可通过语音输入指令。

**Experimental Beta.** 默认关闭。回答和修改可能有误，请核对重要结果。

<details>
<summary>观看四段功能演示</summary>

| Word                                                                                                                                          | Excel                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [![起草、写入、摘要与撤销](docs/media/ai-demos/word-ai.jpg)](https://github.com/user-attachments/assets/8d1d6386-e33a-45f2-b968-b8695c8f7da9) | [![填充、求和、排序与撤销](docs/media/ai-demos/excel-ai.jpg)](https://github.com/user-attachments/assets/5bb253d7-3cc5-4f31-989e-0c88dcb1615c) |
| **起草、写入、摘要与撤销**                                                                                                                    | **填充、求和、排序与撤销**                                                                                                                     |
| PowerPoint                                                                                                                                    | PDF                                                                                                                                            |
| [![创建、复制与撤销](docs/media/ai-demos/pptx-ai.jpg)](https://github.com/user-attachments/assets/db3fc7a7-b54e-4147-a7ca-e7f16243618e)       | [![读取、问答与批注预览](docs/media/ai-demos/pdf-ai.jpg)](https://github.com/user-attachments/assets/f01c2da6-0669-4111-87c1-c4440f4a60e9)     |
| **创建、复制与撤销**                                                                                                                          | **读取、问答与批注预览**                                                                                                                       |

英文界面下的完整流程，按正常速度录制；本机 Qwen3 4B 模型已提前加载，响应时间随模型和设备而变化。

[视频、字幕和文字说明](docs/media/ai-demos/README.md)

PDF 助手支持当前页可选文字和页面便笺，不识别扫描图片中的文字，也不改写 PDF 正文。

</details>

## 🛠 开发

从源码运行：

```bash
git clone https://github.com/ranuts/document.git
cd document
pnpm install --frozen-lockfile
pnpm run dev
```

欢迎反馈和贡献： [Issues](https://github.com/ranuts/document/issues) · [Pull requests](https://github.com/ranuts/document/pulls)

## 📚 基于这些项目

- [sdkjs](https://github.com/ONLYOFFICE/sdkjs) 与 [web-apps](https://github.com/ONLYOFFICE/web-apps) — OnlyOffice 编辑器本体
- [onlyoffice-x2t-wasm](https://github.com/cryptpad/onlyoffice-x2t-wasm) — WASM 文档转换器
- [ranui / ranuts](https://github.com/chaxus/ran) — 本站使用的设计体系与工具库
- [se-office](https://github.com/Qihoo360/se-office)、[onlyoffice-web-local](https://github.com/sweetwisdom/onlyoffice-web-local) — 无文档服务器运行 OnlyOffice 的先行方案

## 📄 许可证

[AGPL-3.0](LICENSE) · [NOTICE](NOTICE)

<details>
<summary>上游声明与商标说明</summary>

本项目是 ONLYOFFICE 编辑器（sdkjs 与 web-apps，版权归 Ascensio System SIA）
的修改版本。界面采用中性功能名称，不展示产品 logo 或品牌宣传。版权、许可证、
修改说明及源码入口仍保留在编辑器的“关于”面板和 [NOTICE](NOTICE) 中。
第三方 GUI 素材和字体仍适用各自的许可证，移除产品标识不改变这些许可。

不展示产品 logo 的决定参考 FSF 对 AGPLv3 第 7 条的公开解释，不将其称为法院判决，
也不据此保证完全合规。上游立场与本项目的处理依据见 NOTICE。

ONLYOFFICE 是 Ascensio System SIA 的商标。本项目并非官方 ONLYOFFICE 产品，
与该公司无隶属关系，亦未获其赞助或背书。法律声明及源码引用中的名称仅用于标明
上游技术来源，不作为本项目品牌。

PWA 安装和浏览器标签页使用独立绘制的中性文档图标，不含上游 logo、商标或项目字母标识。

</details>
