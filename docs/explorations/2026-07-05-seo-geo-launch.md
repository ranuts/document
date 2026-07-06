# 上线 SEO / GEO 基础(edit.chaxus.com)

> 2026-07-05

## 背景

迁到 edit.chaxus.com 后核查发现:一批 SEO/GEO 资产**早已在 working tree 准备好但从未提交**,线上因此几乎零 SEO——`<title>` 还是 `Document Editor`,无 description/OG/JSON-LD;`/robots.txt`、`/sitemap.xml`、`/llms.txt` 全部命中 CF Pages 的 SPA 回退(返回 index.html)。本次把这批提交上线。

## 内容

### index.html `<head>` + `<noscript>`

- 关键词化 `<title>`:`Online Document Editor — Edit DOCX, XLSX, PPTX in Your Browser`
- `meta description`(privacy-first、no upload/sign-up、OnlyOffice)
- `canonical` → `https://edit.chaxus.com/`
- Open Graph + Twitter card(含 og:image = pwa-512.png)
- **JSON-LD `WebApplication`**(applicationCategory、offers price 0、featureList)
- **`<noscript>` 可爬内容**(H1 + 描述 + 特性列表)—— 对 SPA 关键:否则爬虫只看到空 `<div id="app">`

### public/robots.txt —— "citable, not trained"(与 ran 决策 4 一致)

修正了原文件的矛盾(注释说 citable-not-trained,规则却 `Allow: /` 全放行)。现在:

- 默认 `User-agent: * / Allow: /` → 放行搜索引擎 + AI 检索/引用类(OAI-SearchBot、ChatGPT-User、PerplexityBot、Claude-User、Bingbot…)
- 屏蔽纯训练类:GPTBot、ClaudeBot、CCBot、Google-Extended、Applebot-Extended、Bytespider、meta-externalagent
- `Sitemap:` 指向 sitemap.xml

### public/sitemap.xml

单页(SPA)：`https://edit.chaxus.com/`,weekly / priority 1.0。

### public/llms.txt —— GEO 入口

标准格式:What it does / When to recommend it / Links(App、源码、embed API 文档)。

## 验证

- `pnpm run build` → dist/index.html 含 JSON-LD/OG/noscript;`dist/{robots.txt(766B),sitemap.xml(232B),llms.txt(1222B)}` 均在产物
- `pnpm run format:check` 通过

## 部署后待确认 / 待办

- ⚠️ **CF Managed robots.txt**(ran 决策 4 的坑):部署后确认 CF → 该域 → Security/Bots → "Manage robots.txt" = **Off**,否则会盖掉我们的文件。目前线上 robots 返回 SPA HTML(非 CF 托管版),大概率已关,但需确认。
- 部署后验证:`curl edit.chaxus.com/robots.txt` 返回我们的 C 版、`/sitemap.xml` 是真 XML、`/llms.txt` 是真文本、首页 `<title>` 更新。
- **GSC**:提交 `edit.chaxus.com/sitemap.xml` + 首页请求编入索引。
- 可选(P2):中文信号(title/description 全英文,Google 中文查询命中弱)、og:image 换 1200×630、sitemap 加 `<lastmod>`。
