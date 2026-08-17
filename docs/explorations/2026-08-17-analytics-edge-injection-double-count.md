# 埋点是边缘注入的，embed 排除因此失效（2026-08-17）

起因：流量度量 checklist（`docs/2026-08-16-enable-traffic-measurement-checklist.md`）
里两条待办——"curl 首页看不到 beacon"、"首日 924 次访问疑似爬虫"——顺手核了一下，
结论比预想的重要。

## 实测事实

| 检查                                        | 结果                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| `curl https://edit.chaxus.com/` 里的 beacon | **0**（`/editor`、`/editor?embed=1` 同样 0）               |
| 真实浏览器打开同一批 URL                    | **有** `static.cloudflareinsights.com/beacon.min.js/v451…` |
| `VITE_CF_BEACON_TOKEN`                      | 未配置 → `lib/analytics.ts` 整段是死代码                   |

即：**beacon 来自 Cloudflare 面板的边缘注入（checklist 里的路线 A），不是我们的
代码**。curl 看不到只是 CF 对非浏览器 UA 不注入，面板有数据不矛盾。

进一步验证边缘注入的两个后果：

1. `/editor?embed=1`：`body.embed-mode` 为真，**beacon 照样加载**。边缘注入发生在
   我们的 JS 之前，根本不知道 embed 语义 → `lib/analytics.ts` 顶部写了 8 个月的
   "嵌入场景不统计"承诺**当前并不成立**，外部站点嵌我们的 iframe 会被算成我们的流量。
2. 打开一次 `/embed-demo`：顶层页 1 次 + 内嵌 `./editor?embed=1` 1 次 = **同一次访问
   触发两次 beacon**。checklist 里 `/embed-demo` 占 745/924（80.6%）这个异常占比，
   至少有一部分是这么来的（爬虫抓一次也计两次）。

## 代码侧做了什么

不能替用户改 CF 面板，但可以把 checklist 里那句人工提醒——"两条路线都开会造成
双份计数"——变成代码自己保证的不变量：

- 新增 `hasBeacon()`：按 `src*=cloudflareinsights` 或 `data-cf-beacon` 属性检测页面上
  是否已有 beacon（边缘注入两种形态都覆盖）。
- `initAnalytics()` 增加第三个熔断条件：已有 beacon 就不再注入第二个。
  于是无论用户走路线 A、路线 B 还是两条都开，**页面上永远只有一个 beacon**。
- `test/unit/analytics.test.ts`（8 条，此前这个文件完全没有测试）：无 token 不发请求、
  有 token 注入且带正确 `data-cf-beacon`、四种 embed 参数一律不注入、
  已有边缘 beacon 时不追加。

## 决定：维持零配置（2026-08-17 用户定）

保留 Cloudflare 面板的边缘注入，**不**配 `VITE_CF_BEACON_TOKEN`。即接受
"嵌入方的访客也算进来"这个代价，换取零配置、零构建依赖。代码侧的 embed 排除
分支因此处于休眠状态——它仍然保留且有测试，因为（a）自托管者/fork 配了 token
就会生效，（b）将来若改主意，切换只是面板开关 + 一个环境变量。

**读数规则（后续任何人看流量面板都按这个来）**：

| 现象                         | 怎么解释                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `/editor?embed=…` 的 PV      | 是**嵌入方站点**的访客，不是本站访客；算"embed API 被使用"的指标，别并进站点流量 |
| `/embed-demo` 的 PV          | 同一次真实访问计 **2 次**（页面 + 内嵌 iframe），横向比较时按 ÷2 折算            |
| 首页 `/` 与 `/editor` 的 PV  | 这两个才是站点自身流量；`/editor` 占比是"动词型工具"的转化率指标                 |
| PV 与 CWV/INP 样本数差异巨大 | 爬虫加载页面但不交互——以 CWV 样本、带 Referer 入口数为准，别信 PV 总量           |

## 备选路线（若将来改主意）

- **想让"嵌入不统计"重新成立** → 关掉 Pages 面板的 Web Analytics 自动注入，改配
  `VITE_CF_BEACON_TOKEN` 环境变量走路线 B。代码路径已存在且现在有测试保护。
- **想维持零配置** → 保留边缘注入，但读数时要知道：`/editor?embed=` 的量属于嵌入方
  的访客，`/embed-demo` 的量要按 ×2 折算。KPI 建议按 checklist 里那条"用不可伪造
  信号"执行（CWV 样本数、带 Referer 入口数、`/editor` 转化占比）。

两条路线现在都不会双计——差别只在**要不要把嵌入方的访客算进来**。
