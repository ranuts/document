# 路由体系加固：真 404、目录重定向、发现性与本地一致性

日期：2026-07-11
分支：feat/seo-landing-hero
涉及：`public/404.html`（新增）、`public/_redirects`（新增）、`public/_headers`
（新增）、`public/llms.txt`、`public/sitemap.xml`、`vite.config.ts`

## 背景

线上路由完全依赖 Cloudflare Pages 默认行为。实测发现：仓库没有 404.html
时 CF Pages 进入 SPA 回退模式，**任何不存在的 URL 都返回 200 + 应用首页**
（soft-404）——`/this-page-does-not-exist-xyz`、`/OPEN/DOCX`、甚至（部署
落后于分支期间的）`/zh-CN/` 全都 200。对搜索引擎，死链和拼写错误全被当作
有效页面。

## 改动

1. **`public/404.html`**：CF Pages 检测到该文件即退出 SPA 回退，未知路径
   返回真 404。应用没有任何客户端路由依赖回退（文档是本地文件，深链全走
   `/` 上的 query 参数），关闭无副作用。页面本身沿用这次重设计的品牌语言：
   "file-not-found.docx" 文档窗口 + 大号 404 + `network · 0 requests`
   状态条，双语文案（"你的文件当然也不在这里——它们从未离开过你的设备"），
   `noindex`。
2. **`public/_redirects`**：`/zh-CN → /zh-CN/ 308`，钉死无斜杠变体（关闭
   SPA 回退后这类 URL 会变成 404，显式重定向兜底）。
3. **`public/_headers`**：`/ranui-iife/*` 与 `/ran-tokens.css`（无 hash 的
   vendored 资产）设 `max-age=3600, stale-while-revalidate=86400`。
4. **发现性**：llms.txt 新增 Pages 段列出全部 8 个卫星页 + 中文版说明
   （AI 检索/引用入口）；sitemap 18 个 URL 补 `lastmod`。
5. **本地一致性**：vite `cleanUrlsDev` 插件升级为 `cleanUrls`——补目录
   URL 无斜杠时的 308 跳转（`/zh-CN` → `/zh-CN/`，与 CF 行为一致），并通过
   `configurePreviewServer` 让 `vite preview`（E2E 用）也获得干净 URL。

## 验证

- dev 实测：`/offline-document-editor` 200、`/zh-CN` 308→`/zh-CN/`、
  `/zh-CN/open/docx` 200、404 页亮/暗渲染正常（r-button 升级正常）
- format / lint:ts 通过

## 路由体系现状（备忘）

- 部署层：CF Pages 干净 URL + `.html`→308 + `_redirects`/`_headers`/404.html
- 内容层：MPA 静态（/ 应用+落地、8 英文卫星页、/zh-CN/ 全镜像、hreflang/
  canonical/sitemap/robots/llms.txt）
- 应用层：query 参数即路由（`?file`/`?src`/`?readonly`/`?embed`/
  `?locale&new`/`?agent`），无 history 路由；不引入 r-router（卫星页必须
  真静态，编辑器无可深链状态）
