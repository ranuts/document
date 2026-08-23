---
title: 免费的 OnlyOffice 在线版——浏览器直接用，不装服务器
description: 免费在线使用 OnlyOffice 编辑器，不用部署 Document Server，也不用注册。编辑器以 WebAssembly 在你的浏览器里运行，DOCX、XLSX、PPTX 文件不会被上传。开源、可自托管，与 Ascensio System SIA 无隶属关系。
eyebrow: OnlyOffice 引擎 · 无需服务器
h1: 在线免费用 OnlyOffice 编辑器——不用架服务器
lead: 本站把 OnlyOffice 的文档、表格、演示文稿编辑器整个编译成 WebAssembly，跑在你的浏览器里。不用部署 Document Server，不用注册账号，也没有上传——你打开的文件始终留在自己的设备上。
cta: 打开编辑器 →
ctaHref: /zh-CN/
ogDescription: OnlyOffice 编辑器在浏览器本地运行。不用 Document Server、不用注册、不上传。免费开源。
breadcrumb: OnlyOffice 在线版
appDescription: 把 OnlyOffice 编辑器编译成 WebAssembly，在浏览器本地运行，不需要 Document Server，也不上传文件。
---

OnlyOffice 通常是要装的：编辑器只是前端，背后是 ONLYOFFICE Docs（Document Server）在做转换和存储，而那台机器得你自己跑起来、并且一直跑着。对团队来说这个形态是对的。但如果你只是想打开别人发来的一个 `.docx`，这套机器就太重了。

本站是另一种形态。同一套编辑器、同一个 `x2t` 转换引擎，被编译成 WebAssembly 加载进页面——你的浏览器就是那台文档服务器。所以没有上传、不用账号，断网之后也照样能用。

本站是 OnlyOffice 编辑器的修改版本，以同样的 AGPL-3.0 协议发布。它不是官方 OnlyOffice 产品，与 Ascensio System SIA 没有隶属关系，也未获其背书。

## 你能得到什么

- **真正的编辑器**——OnlyOffice 的文档、表格、演示文稿与 PDF 编辑器本体，不是阅读器，也不是另写一套。
- **真正的转换引擎**——`x2t`，与 ONLYOFFICE Docs 用的是同一个，编译成了 WebAssembly。可读 DOCX、XLSX、PPTX、ODT、ODS、ODP、CSV、PDF；可存回 DOCX、XLSX、PPTX、PDF、TXT、HTML、CSV。
- **不用服务器、不用账号、不上传**——文件从你的磁盘读进标签页，再写回磁盘。
- **可离线**——可安装为 PWA，第一次访问之后引擎就在本地缓存里，断网也能打开。
- **开源**——AGPL-3.0，产物是一堆静态文件，你可以部署在任何 Web 服务器上自己用。

## 和 ONLYOFFICE Docs 有什么不同

把这一节说清楚，比堆功能表有用：

- **没有协作。** 实时协同编辑、多人在线状态这些需要一台服务器居中转发的东西，这里都没有。它是单人编辑器。
- **没有连接器。** Nextcloud / ownCloud / SharePoint 那些集成属于 ONLYOFFICE Docs。本站只从磁盘、URL，或者嵌入它的父页面拿文件。
- **没有运维。** 没有东西要配置、备份、升级，也没有东西要防护——因为服务端根本没有你的文档副本。
- **干活的是你的浏览器。** 大文档消耗的是你自己的内存而不是服务器的。引擎启动时要向浏览器申请几百 MB，笔记本没问题，老手机可能吃力。
- **除此之外是同一个引擎**，所以字体、表格、公式、修订和排版在往返之后的表现，和 OnlyOffice 本身一致。

## 怎么用

1. 打开编辑器——没有注册页，也不用授权码。
2. 从设备里挑一个 DOCX、XLSX、PPTX、ODT、CSV 或 PDF 文件，或者直接新建一个空白文档。
3. 开始编辑。打开、转换、渲染都在这个标签页里完成。
4. 存回磁盘，或者导出成 PDF、TXT、HTML、CSV。

## 常见问题

### 这是官方的 OnlyOffice 吗？

不是。这是一个独立的开源项目，基于以 AGPL-3.0 发布的 OnlyOffice 编辑器构建。它与 Ascensio System SIA 没有隶属关系，也未获其背书；OnlyOffice 是该公司的商标。官方产品请访问 onlyoffice.com。

### 真的免费吗？

真的，而且没有需要付费解锁的高级版。源码在 GitHub 上以 AGPL-3.0 发布，站点本身就是一堆静态文件，你可以自己部署。

### 需要先装 ONLYOFFICE Docs 或 Document Server 吗？

不需要。本来由 Document Server 运行的那个转换引擎，被编译成 WebAssembly 跑在你的浏览器里。没有东西要安装，也没有东西需要常驻。

### 我的文件会被上传吗？

不会。文件从你的设备读入、在标签页里处理。你可以在打开和保存文档时看浏览器的网络面板来核实，也可以直接读源码。

### 能多人一起编辑同一个文档吗？

不能。协同编辑需要一台双方都连着的服务器，而这正是本站刻意不要的东西。需要协作的话，ONLYOFFICE Docs 才是对的产品。

### 用的是哪个版本？

OnlyOffice 9.3，配 9.4 版的 `x2t` 转换器。确切版本以及我们对上游构建做过的每一处改动，都写在仓库的 NOTICE 文件里。

### 可以嵌进我自己的系统吗？

可以——它通过 `postMessage` 提供一套 iframe API；而且是 AGPL-3.0，你也可以把整个站点部署到自己的域名下。
