# GitHub Pages 跳转器 → edit.chaxus.com(带参数,准备件,暂不激活)

> 2026-07-05

## 背景

document 迁到 `edit.chaxus.com`(Cloudflare Pages)后,旧地址 `ranuts.github.io/document/*` 要保持可用并把 SEO 权重转过去。github.io 是 GitHub 域名,只能**客户端跳转**(JS `location.replace` + canonical,Google 视同 301)。

## 关键先决:document 已经 base 无关(ran 的根路径化对它是 no-op)

核实后发现 document 与 ran 不同,**不需要**「base `/document/` → `/`」的代码工:

- `vite.config.ts` base = `'./'`(相对,资源不带前缀)
- `getBasePath()` 是**运行时**从 `window.location.pathname` 判断:`/document/` 开头→`/document/`,否则→`/`。在 `edit.chaxus.com` 根域上 pathname=`/` → 自动返回 `/`
- `manifest.json`:`start_url:"./"` + 图标相对路径,无绝对 `/document/`
- SW 注册:`register('./sw.js')` 相对 → scope 随部署路径自适应

→ 迁到根域后 wasm/字体/manifest/SW 全自动适配,**代码零改动**。(planning 决策 6 里"必做代码工"整条勾销。)

## 跳转器实现

`redirect/index.html` + `redirect/404.html`(内容一致,GitHub Pages 对未匹配路径回 404.html)。核心 JS:

```js
var base = 'https://edit.chaxus.com';
var path = location.pathname.replace(/^\/document/, '') || '/';
var link = document.querySelector('link[rel=canonical]');
if (link) link.href = base + path + location.search;
location.replace(base + path + location.search + location.hash);
```

**为什么必须带参数**:编辑器靠 `?embed=` / `?embedded=` / `?agent=1` / `?url=` / `?embedOrigin=` 驱动,query 丢了 embed/agent 全废。所以保留「去 `/document` 前缀的 path + `location.search` + `location.hash`」。canonical 也按目标路径动态设;无 JS 时用静态 `meta refresh` 兜底到根(静态无法算 path,小站够用)。

## workflow 改造

`.github/workflows/pages-build-site.yml`:去掉 pnpm/node/install/build,只 `upload-pages-artifact` 发布 `./redirect` 目录。触发分支从 `release/v0.0.4` 改为 **`main`**(CF 现从 main 部署 app,GH Pages 也统一到 main);加 `workflow_dispatch` 便于 CF 上线后手动触发首发。注意 `release/v0.0.4` 仍是 v7 维护线,只是 CI 不再依赖它、分支保留。

## 验证

- **6 个用例(node)**:路径剥离 + query + hash 组合,目标 URL 全部正确
- **真浏览器(Playwright)**:拦截 `ranuts.github.io/document/*` 返回跳转器,捕获实际跳转目标 —— `?embed=1` / `?agent=1&url=...` / 深层路径 `?embedOrigin=...#sec` 全部正确剥离前缀并保留 query

## ⚠️ 激活时机(不可提前)

**本 PR 是准备件,CF 新站 `edit.chaxus.com` 确认上线前不可合并/激活。** 否则会把用户导去尚不存在的站。顺序(照 ran 踩坑):

1. 先上 `edit.chaxus.com`(CF `*.pages.dev` 验证 OK)
2. 合并本 PR → workflow 改为发跳转器(**不能直接删 workflow**,否则 GH Pages 冻结旧站 → 重复内容打架)
3. `workflow_dispatch` 手动触发首发,验证 `ranuts.github.io/document/` → 302/JS 跳 `edit.chaxus.com`
4. GSC 地址变更 / sitemap / 外链

**触发分支已统一到 `main`**(原 `release/v0.0.4`):CF 现从 main 部署 app,GH Pages 也随之 main-based → 合并本 PR 到 main 即激活。`release/v0.0.4` 仍是 v7 维护线,分支保留,只是 CI 不再依赖它。
