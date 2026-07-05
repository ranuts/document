# 埋点分析:选 Cloudflare Web Analytics 而非 Google Analytics

日期：2026-07-05
分支：`fix/sw-freshness`

## 决策

项目核心卖点是"本地处理、无需服务器、保护隐私"。Google Analytics 与此**直接冲突**：
注入 Google 追踪脚本、设 cookie、把用户行为发给 Google，且在欧盟需 cookie 同意横幅
（界面支持德/法/西/葡等语言 = 有欧洲用户）。故**不用 GA**。

改用 **Cloudflare Web Analytics**：无 cookie、无需同意横幅（GDPR 友好）、免费、一段
beacon script 即可，最不破坏隐私定位。

## 实现

新增 [lib/analytics.ts](../../lib/analytics.ts)，在 [index.ts](../../index.ts) 的
`initEmbedApi()` 之后调用 `initAnalytics()`。两道加载条件：

1. **配了 token 才加载**：token 从 `import.meta.env.VITE_CF_BEACON_TOKEN` 读取。未设置 →
   直接 return，且 Vite/Rolldown 会把整段 beacon 代码 **tree-shake 移除**（默认部署 = 零
   Cloudflare 引用、零外部请求）。token 是公开的客户端值，构建期内联安全。
2. **仅顶层页面加载**：`window.parent !== window` 或 `?embed=/?embedded=` 时不加载——
   别人把编辑器嵌进 iframe 时，不该把宿主页面的访客算进我们的统计。

类型：新增 [vite-env.d.ts](../../vite-env.d.ts) 声明 `VITE_CF_BEACON_TOKEN`。

## 如何启用

1. Cloudflare Dashboard → Web Analytics → Add a site（`ranuts.github.io/document/`）→ 拿到
   snippet 里的 `token`。
2. 本地：项目根 `.env.local` 写 `VITE_CF_BEACON_TOKEN=xxxx`。
3. CI（`pages-build-site.yml`）：Build step 已注入
   `env: VITE_CF_BEACON_TOKEN: ${{ vars.VITE_CF_BEACON_TOKEN }}`（本次改动已完成）。**只需**在
   仓库 Settings → Secrets and variables → Actions → **Variables** 加 `VITE_CF_BEACON_TOKEN`
   （公开值，用 Variable 即可，无需 Secret）。

未做以上任何一步 → 站点行为不变（无埋点，且 beacon 代码被 tree-shake 移除）。

## 验证（chrome-devtools + 构建产物）

| 构建 | 预期 | 实测 |
| --- | --- | --- |
| 无 token（默认） | 不注入 | ✅ bundle 里零 `cloudflareinsights` 引用（死代码消除） |
| 有 token · 顶层 | 注入 beacon | ✅ `data-cf-beacon={"token":...}` 正确 |
| 有 token · `?embed=1` | 不注入 | ✅ beacon 缺席，`embed-mode` class 存在 |

`lint:ts` ✅ / prettier ✅ / `build` ✅。
