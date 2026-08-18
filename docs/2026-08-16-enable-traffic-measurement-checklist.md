# 流量度量启用 Checklist —— Cloudflare Web Analytics + GSC / Bing

日期：2026-08-16 · 适用站点：edit.chaxus.com（Cloudflare Pages 部署）

## 背景（为什么需要这份清单）

2026-08-16 盘点结论：**站点目前没有任何流量数据**。

- 代码侧埋点（`lib/analytics.ts`，CF Web Analytics beacon）依赖构建时注入
  `VITE_CF_BEACON_TOKEN`；当前所有 workflow 与 CF Pages 构建环境都没有配该变量，
  线上首页 / `/editor` 的 HTML 里 `static.cloudflareinsights.com` 引用数为 0。
- GSC / Bing 站点已提交过（用户确认；路线图文档里"待用户"的说法已过时）。
  搜索侧数据在 GSC / Bing 面板可见，但不属于本仓库能查的范围。
- 现有可用的只有间接信号：GitHub ~1.9k stars、ranui/ranuts npm 月下载约 2.7k/1.7k。

即：SEO 内容矩阵（24 页双语落地页 + llms.txt）与搜索收录已就位，
**唯一没接通的是访问量埋点**。本清单重点解决这一步，GSC/Bing 部分转为"确认与复用"。

---

## 第一步：启用 Cloudflare Web Analytics（两条路线，选一条）

### 路线 A：Pages 项目面板一键开启（零代码，推荐先做）

1. 登录 Cloudflare 控制台 → 左侧 **Workers & Pages** → 点开 `edit.chaxus.com` 项目。
2. 在项目页找 **Web Analytics**（面板版本不同，位置可能在项目内 Analytics 卡片、
   或控制台顶部 **Analytics & Logs → Web Analytics** 的站点列表里）。
3. 开启后 CF 会在边缘自动注入 beacon：**无需改代码、无需重新部署**，
   约 1 分钟后开始计数。
4. 验证：浏览器打开 https://edit.chaxus.com/ 查看页面源码，应出现
   `static.cloudflareinsights.com/beacon.min.js`；或直接在 Web Analytics 面板
   看到本机访问记录。

### 路线 B：构建期内联 token（走现有代码路径）

适用场景：想要更细的行为数据、或希望完全由代码控制注入逻辑
（`lib/analytics.ts` 已处理 embed 场景不统计，见"注意事项"）。

1. Cloudflare 控制台 → **Analytics & Logs → Web Analytics → Add a site**，
   拿到 snippet 里的 `token`（形如一段 hex 字符串）。
2. token 是**公开的客户端值**（本来就要内联进页面 HTML），按普通变量处理即可，
   不要当 Secret。
3. Pages 项目 → **Settings → Environment variables** → Production 环境添加：

   ```
   变量名：VITE_CF_BEACON_TOKEN
   值：<上一步拿到的 token>
   ```

   保存后触发一次重新部署。

4. 验证：
   - `curl -s https://edit.chaxus.com/ | grep -c cloudflareinsights` → ≥ 1；
   - `curl -s "https://edit.chaxus.com/editor?embed=1" | grep -c cloudflareinsights` → 0
     （embed 场景不计入统计，是设计，不是丢数据）。

> 两条路线都开会造成双份计数，选一条即可。建议：A 起步，数据粒度不够再补 B。

---

## 第二步（已提交，转为确认与复用）：GSC + Bing

**状态：站点已提交（用户确认）。** 这一节只做确认与持续动作：

1. **GSC 面板确认**：打开 Google Search Console → 确认资源已验证、
   `https://edit.chaxus.com/sitemap.xml` 提交成功、收录页数 > 0、
   能看到搜索词 / 点击 / 曝光数据（约提交后 1–2 周数据才稳定）。
2. **Bing Webmaster Tools**：确认导入/验证状态（可从 GSC 一键导入）。
3. **持续动作**：每新增落地页（`/open/*`、`/convert/*`、新语言页），sitemap 由
   构建自动更新，在 GSC 里重新提交一次或等自动抓取即可。
4. **GSC 数据的用法**：GSC 与 Web Analytics 是互补的两块拼图——GSC 告诉你
   "哪些搜索词把人带来了"，Web Analytics 告诉你"来了之后做了什么"
   （是否进 `/editor`、是否停留）。两者对照才是完整漏斗。

---

## 第三步：跑基线 + 发布事件

1. 埋点生效后，记下 **第 1 天 / 第 7 天** 的 PV、UV、来源占比作为基线。
2. 做一个发布事件（v9 release 公告 + 外链一稿：HN Show / 掘金 / V2EX 等），
   7 天后对比来源结构，判断哪个渠道有效——这是路线图"方向二 3"一直没启动的杠杆。
3. 重点观察的指标：
   - **PV / UV / 来源占比**（organic / direct / referral）；
   - **`/editor` 页占比**——这是"动词型"工具的转化点，只看首页流量没有意义；
   - 嵌入（embed）使用量：外部嵌我们的 iframe 不计入本统计（设计如此），
     需靠外部方数据或自己抽样，别在 Web Analytics 里找。

---

## 注意事项（本项目的隐私设计约束）

- **刻意不用 GA**：项目卖点是"本地处理、隐私优先"，CF Web Analytics 无 cookie、
  GDPR 友好，与卖点不冲突（见 `docs/explorations/2026-07-05-privacy-analytics-cloudflare.md`）。
- **embed 场景不统计**：`?embed=1` / iframe 嵌入时不注入 beacon，避免把宿主
  页面的访客算成我们的流量。这不是 bug。
- **token 是公开值**：放 CF Pages 环境变量 / CI Variables 即可，不要提交进仓库
  （仓库公开，提交即泄露到公网；好在它本来就不是密钥）。
- **排除自己**：Web Analytics 面板可排除自己的 IP / UA，避免把开发访问算进基线。
- **埋点代码现状**：`lib/analytics.ts` 已就绪，两条路线都不需要改代码；
  未配 token 时整段 beacon 会被 tree-shake 移除（零外部请求），这是默认保护。

---

## 验证清单（完成后逐项打勾）

- [x] 面板已能看到今日数据（2026-08-16 晚间接通，含 CWV RUM：LCP/INP/CLS）
- [ ] Web Analytics 面板能看到"今天"的数据（同上一项，确认持续计数）
- [x] GSC 已验证、sitemap 提交成功、收录页数 > 0（**已确认**，定期复查）
- [x] Bing Webmaster Tools 导入完成（**已确认**，定期复查）
- [ ] 记录了基线：启用前（无数据）+ 第 1 天 PV/UV/来源
- [ ] （可选复验）curl 首页 HTML 能看到 beacon——面板已出数据时此项以面板为准，
      curl 看不到通常只是边缘注入对机器人请求有差异，不阻塞

## 首日数据速览（2026-08-16 晚间接入后）

- **LCP**：P50 804ms（优秀），P75 2,128ms，P90 3,848ms，P99 9,464ms；
  Good 79% / NI 11% / Poor 10%——中位数健康，**长尾在慢网络 + 冷缓存**。
- **INP**：Good 93% / Poor 0%，最长样本（~360ms）都在编辑器 iframe 内部、count=1，噪声。
- **CLS**：Good 97%，有偏移的记录都在编辑器 iframe 内（文档加载期），页面本身近零。
- **首个行动**：CF 面板补 `/fonts/*` 与 `*.wasm.gz` 的 Cache Rule（Edge TTL 1 年），
  再按 URL 分组盯 `/editor` 冷打开是否就是 LCP 尾部的来源。

## 首日访问量（2026-08-16，Last 24h）

- **Total visits 924，但强烈疑似爬虫流量**：`/embed-demo` 占 745（80.6%）、
  Direct 883（95.6%）、美国 795（86%）、Chrome 桌面 885（95.8%）、
  Windows 860（93%）——同构到可疑；且 924 次访问与 CWV 的 INP 只有 5 个样本
  矛盾（爬虫加载页面但不交互）。"Exclude bots = Yes" 只拦认证爬虫，
  headless scraper 伪装 Chrome 桌面拦不住。
- **真实流量估计每天几十次**：带 Referer 的入口仅 41 次（chaxus.github.io 20 /
  github.com 14 / ran.chaxus.com 4 / ranuts.github.io 3）。
- **处理**：Download data 导出确认 UA；KPI 改用不可伪造信号（CWV 样本、
  带 Referer 入口数、`/editor` 转化占比、发布事件后的 Referer 增长）；
  跑满一周再下结论（单次爬取会归零）。
