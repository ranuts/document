# Changelog — 字体版权与多语言回退（一页纸）

日期：2026-08-22 · 分支：main（PR 制）· 相关 PR：#168 → #170（revert #174）→ #178 → **#184（本轮，已合并）**

给新开会话看的一页纸：**现在什么状态、规则是什么、别再试什么、数字在哪、还差谁一步。**
逐步细节见 [替换是怎么做成的](../explorations/2026-08-22-font-substitution-solved.md)，
体系文档见 [docs/fonts.md](../fonts.md) 与 [docs/font-licenses.md](../font-licenses.md)。

## 一句话结论

**79 个专有字体（171 MB）已从 catalog 移除，全部由开源字体承接，文档里写着"宋体" /
"Arial" 照常解析。** `public/fonts/` 327 MB → 184 MB。线上已部署并实测通过。
**唯一未完成的一步在仓库外**：Cloudflare 面板做一次 Purge Cache（见文末）。

## 规则（这是全部要点）

> **位置 P 上那个文件里写的 family 名，必须属于某个指向 P 的 `__fonts_infos` 行。**

引擎排版时读的是**加载文件里**的 `m_pFaceInfo.family_name`，再拿它过一遍匹配器
（`sdk-all.js` 的 `StringShaper.Shape`）。名字指到别的条目上，就会"用 A 排版、用 B
画字形"，整页 glyph 错位。原始 vendor catalog 的 267 个被引用位置全部满足这条。

配套两条，缺一条就是同一种错位或空白：

1. **新增 family = 位置 + `__fonts_infos` 行 + `g_fonts_selection_bin` 记录**，三样齐全。
2. **CJK 字体必须是 TrueType（glyf）**，不能是 CFF（`OTTO`）——编辑器渲染正常，
   但 x2t 往 PDF 里一个字形都嵌不进去，导出的中文全是空白。

## 别再试这些（负面知识）

| 想法                                                  | 为什么不行                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 把替代字体的**文件名**写进专有字体的位置（PR #170）   | 破坏上面那条规则，`Hello` 渲染成 `Fcjjm`，线上一小时后被 revert                                    |
| 认为"一个位置就是一个字体身份，不能共享"（#178 结论） | 不成立。多行指向同一位置完全正常，只要该位置的文件名属于其中一行                                   |
| 认为 `__fonts_ranges` 第三个数是运行时下标            | 不是。sdkjs 与 PDF 引擎两处消费者都按 `infos[triple[2]][0]` 读，就是 `__fonts_infos` 行号          |
| 认为 `g_fonts_selection_bin` 不可写、必须整体重建     | 阅读器就在 `sdk-all.js` 里；`bin/lib/selection-bin.mjs` 双向实现，逐字节往返，188 个文件记录可复现 |
| 删掉专有 family 名（而不是替换）                      | `sdk-all.js` 硬编码 Arial / Calibri / SimSun / Tahoma / Batang / MS Mincho，删掉直接白屏           |
| 用 pan-CJK 的 Noto Sans/Serif **CJK** SC              | CFF 轮廓，导出 PDF 中文空白（见上）                                                                |
| 只用 `Hello` 验证                                     | 基本 ASCII 的 glyph 顺序在多数拉丁字体里恰好一致，坏了也看不出来。测试文本必须跨过 U+A0            |

## 数字

| 项                     | 值                                                                              |
| ---------------------- | ------------------------------------------------------------------------------- |
| 删除                   | 79 个文件 / 171.2 MB（华文、方正、中易、长城、Stone、微软、Monotype）           |
| 新增                   | 15 个文件 / 28.6 MB（SIL OFL 1.1）                                              |
| `public/fonts/`        | 327 MB → 184 MB                                                                 |
| catalog 位置 / family  | 267 → 282 / 193 → 202                                                           |
| selection 记录         | 273 → 288                                                                       |
| 回退 range             | 3075 → 2984                                                                     |
| 中文 family 得到真粗体 | 48 个                                                                           |
| 中文文档首次下载       | 宋体一路 3.6 MB（压缩 2.1）、黑体一路 9.9 MB（压缩 5.9，同时是所有 CJK 的回退） |

## 怎么跑、怎么验

```bash
node bin/font-license-sweep.mjs --check    # 只报告方案
node bin/font-license-sweep.mjs            # 执行（源字体在 vendor-fonts/，不入库）
npx vitest run test/unit/font-catalog-licensing.test.ts test/unit/font-selection-bin.test.ts
npx playwright test test/e2e/font-substitution.spec.ts test/e2e/pdf-cjk-export.spec.ts
E2E_BASE_URL=https://edit.chaxus.com npx playwright test test/e2e/font-substitution.spec.ts  # 打线上
```

四层用例都做过反向验证（去掉修复即变红），阈值与实测值写在探索文档里。
**视觉 E2E 结构上看不见字体错误**（它比的是"原始 vs 存回"，两侧同样的错字体），
所以字体改动一律要看真实渲染，且用 `pluginMethod_PasteHtml` 灌文字（键盘会丢字符）。

## 上线后实测（2026-08-22，部署完成后）

```
/fonts/017?cb=随机   404              ← SimSun，源站已无
/fonts/016?cb=随机   404              ← 微软雅黑，源站已无
/fonts/267?cb=随机   200  10,423,464  ← Noto Sans SC（新）
/fonts/269?cb=随机   200   3,764,940  ← Noto Serif SC（新）
/fonts/017（不带 cb）200   4,077,068  age=329273  ← 旧 SimSun 的缓存副本仍在发
```

线上跑 `font-substitution` + `pdf-cjk-export`：6 条全过（逐像素差 0.000%～0.044%，
PDF 墨迹 1.04%）。Production smoke、Docker 镜像构建均绿。

## 还差一步（仓库里做不到）

**在 Cloudflare 面板执行一次 Purge Cache。** `_headers` 给 `/fonts/*` 的是一年
`immutable`，这在"文件名即内容"时是对的，但**删除**打破了那个前提：被删的名字不会
再有新内容去覆盖缓存副本。清掉之前，那批专有字体仍可按旧 URL 从本站取到（新的
`AllFonts.js` 已不再引用，正常使用不会请求到）。清完后 `/fonts/017`（不带
cache-buster）也应变成 404。

下次批量移除 vendor 资源时，把这一步一并计划进去。
