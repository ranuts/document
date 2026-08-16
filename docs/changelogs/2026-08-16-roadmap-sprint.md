# Changelog — 路线图冲刺日（站点结构 / 内容 / 多语言 / 性能 / WebMCP）

日期：2026-08-16 · 分支：`main`（PR-only，6 项必选检查）· 参与：两个并行
Claude 会话（本文作者负责路线图第 3～12 项与内容线；另一会话负责 v9 回归战役、
CI 门禁、PDF 打开修复、ranui 对齐）。

给新开会话看的一页纸：**这一天做了什么、东西在哪、流程怎么变了、还欠什么。**
路线图本体见 [下一阶段规划](../superpowers/plans/2026-08-15-next-phase-roadmap.md)
（执行顺序表已逐项打勾），逐项细节见 `docs/explorations/2026-08-16-*.md`。

## 一句话结论

路线图"原执行顺序"14 项里，**除 2（发 v9 release，等战役通过）、13（外链发稿，
用户主导）、14（agent-collab，大周期）外全部落地**；站点从"一页三用"变成
`/` 静态落地 + `/editor` 编辑器，帮助中心与更新日志上线，编辑器跟随访客语言与
站点主题，浏览器 agent 可经 WebMCP 调用。同日协作流程从"直推 main"切换到
"PR → CF Pages 预览 → 冒烟门禁 → auto-merge"，两个会话改用独立 git worktree。

## 落地清单（按 PR 合入顺序）

| PR   | 内容                                                                                                                                  | 记录                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 直推 | `/open/pdf` 落地页（en+zh）+ `landing-pages.test.ts` 契约；zh CTA 误指空白 Word 修正                                                  | explorations/2026-08-16-pdf-landing-and-landing-contract.md        |
| 直推 | vendor 树 `X-Robots-Tag: noindex`（web-apps / sdkjs / fonts）                                                                         | 同上附录                                                           |
| 直推 | embed-demo 重做到 ranui 设计体系（E2E 契约不变）                                                                                      | explorations/2026-08-16-embed-demo-ranui-restyle.md                |
| 直推 | 编辑器跟随站点深色/亮色（`lib/editor-theme.ts`）                                                                                      | explorations/2026-08-16-editor-follows-site-theme.md               |
| #116 | markdown→HTML 生成器 `bin/build-pages.mjs`（locale × page）+ `/help` `/help/embed-api` `/changelog`（en+zh）+ 帮助内容新写            | explorations/2026-08-16-markdown-pages-generator-help-changelog.md |
| #120 | 首页去掉渲染阻塞的 api.js（线上 LCP 774 ms 中占 479 ms）；线上性能基线入档                                                            | explorations/2026-08-16-perf-baseline-and-api-loader.md            |
| #123 | 右下角 Menu 加 light/dark/system 切换                                                                                                 | explorations/2026-08-16-fab-menu-theme-switch.md                   |
| #124 | embed 落地页只读/预览一节 + FAQ                                                                                                       | （方向一 3）                                                       |
| #128 | 生成页改为**构建期渲染、不入库**（vite 插件），消除并发合并的 changelog.html 漂移                                                     | 同 #116 文档"第一版曾入库"段                                       |
| #122 | 编辑器 UI 跟随访客语言：45 个 vendor 语言包全透传（`resolveEditorLocale`）                                                            | explorations/2026-08-16-editor-ui-locale-passthrough.md            |
| #125 | CSV 乱码说明 + 修正"导入步骤可选编码"的过期说法                                                                                       | （方向一 2）                                                       |
| #130 | **路由拆分**：`/` 静态落地（无编辑器 bundle）、`/editor` 编辑器（editor.html）、旧深链/iframe 内联重定向；全套 E2E 71 passed          | explorations/2026-08-16-route-split.md                             |
| #131 | app-smoke 竞态断言修复（占位符被 DocsAPI iframe 替换）                                                                                | —                                                                  |
| #127 | 意图触发预取（hover/focus 打开/新建 → 预取 loader/app.js/sdk-all；Save-Data/2G 跳过；`lib/prefetch.ts` + 静态 `landing-prefetch.js`） | explorations/2026-08-16-intent-prefetch.md                         |
| #129 | WebMCP 薄适配 `lib/web-mcp.ts`（5 个工具，双位置特性检测，无 API 静默降级）                                                           | explorations/2026-08-16-webmcp-adapter.md                          |

另一会话同日：PDF 真正能打开（`localOpenFromBinary` + `openDocument`）、
pdf-roundtrip / comments / docx tracked-changes 等 E2E、CI 预览冒烟门禁、
e2e-pages 串行 + wrangler 重启守护、ranui/ranuts 上游对齐夜检。

## 评估结论（用户当天两问）

- **多语言**：站点壳 i18n 实际只有 en/zh-CN（"9 语言"说法不实，已改）；vendor
  编辑器自带 45 个语言包但**无波斯语**。分三层：① 编辑器 UI 透传（已做）；②
  壳 ≈40 词条补 ja/es/pt/ko/de/fa；③ 多语言落地页靠生成器批量生成（fa 需 RTL
  验收）。写在路线图"方向八"。
- **深色/亮色**：站点层早已支持；编辑器层不跟随 → 已补（挂载 + 实时 + FAB
  入口）；文档画布深色刻意不跟随。

## 流程变化（对后续每个会话都生效）

1. main 受保护：PR-only、6 项必选检查（Lint / E2E / E2E Pages semantics /
   E2E Docker / Preview smoke / Cloudflare Pages）、线性历史、auto-merge。
   `strict up-to-date` 已关（否则每合一个其余全变 BEHIND）——代价是并发
   合并的语义冲突靠合后 CI 兜底。
2. 两个会话各用独立 worktree（`.claude/worktrees/<name>`），只走 topic 分支。
3. 生成页（/help /changelog）不入库；改了 CHANGELOG.md 不用再手动重生成。
4. Semantic PR 检查要求 conventional 标题（`content(...)` 不合法，用 `docs(...)`；
   `gh pr create --fill` 会拿分支名当标题，要手写）。

## 线上基线（拆分前，供对比）

首页 LCP 774 ms（TTFB 205 / render delay 569）；`?new=docx` 冷打开 ≈16 s
（sdk-all.js 3 MB br 6.6 s + 14 个字体文件 6 s；字体仍 `cf-cache-status:
DYNAMIC`）。拆分 + api.js 按需 + 意图预取上线后待复测。

## 欠账 / 待用户

- Cloudflare 面板：`/fonts/*`、`*.wasm.gz` 的 Cache Rule（无扩展名路径边缘不
  缓存）；WebMCP origin trial token + `_headers` 下发；GSC / Bing 提交 sitemap。
- 硬刷新后复测那份 35 页 PPTX 的致命弹窗；#94 待报告人复测。
- 路线图剩余：2（v9 release）、13（外链发稿）、14（agent-collab）；方向八第
  2/3 层；CHANGELOG 中文版；`/fix/csv-garbled` 独立页看 GSC 再定。
