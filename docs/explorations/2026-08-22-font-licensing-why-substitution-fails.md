# 字体版权：为什么"换掉专有字体"在这套 vendor 上做不到

日期：2026-08-22
相关：`public/fonts/`、`public/sdkjs/common/AllFonts.js`、PR #170（已 revert）、#174（revert）
前篇：[171 MB 专有字体与多语言回退](2026-08-22-font-licensing-and-multilingual-fallback.md)

## 结论先写

vendor 的字体系统把 **family 名、glyph 索引、metrics、字符覆盖**绑成一个互相引用的整体，
分布在四份数据里（`__fonts_files` / `__fonts_infos` / `__fonts_ranges` /
`g_fonts_selection_bin`）。**任何只改其中一部分的替换都会坏**，而且坏法五花八门：
整页 glyph 错位、白屏、豆腐块。

79 个专有字体（171 MB）确实该换掉，但**不存在"小改一处"的做法**。要做成，只有三条路：

1. 完整重建这四份数据（含逆向 `g_fonts_selection_bin` 的二进制格式）；
2. 换一个本身不带专有字体的 vendor 构建；
3. patch vendor 代码里硬编码的字体名（`Arial` / `Calibri` / `SimSun` / `Tahoma` /
   `Batang` / `MS Mincho`）。

都不是顺手能做的，需要单独排期。**在那之前不要再尝试局部替换**——下面这张表是代价。

## 试过的五种做法，全部失败

每一条都在本地真实构建 + 真实浏览器里验证过（输入 `Hello ABC 你好世界` 看渲染）。

| 做法                                                                      | 结果                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 改 `__fonts_infos` 的索引，让 "Arial" 指向 Liberation Sans **已有的位置** | 全页 glyph 错位：输入 `Hello` 显示 `Fcjjm`，样式库显示"标题 E"，CJK 全空 |
| 改索引，指向**独占的新位置**（新槽位 + 新文件，不与任何 family 共享）     | 同样错位                                                                 |
| 把 family 的 face 设为 `-1`                                               | 编辑器起不来：白屏，工具栏灰掉                                           |
| 删掉**在用**字体（默认字体）的 family 行                                  | 同样白屏                                                                 |
| 保留索引不动，只换文件**字节**                                            | 基本 ASCII 看着正常，其余错位（见下）                                    |
| 清空 `g_fonts_selection_bin`                                              | 全部字符变豆腐块                                                         |

唯一安全的操作是**删掉没有任何东西引用的 family 行**——但专有字体恰恰都在被引用。

## 关键发现一：引擎按 family 名绑定 glyph 索引

"换字节"最初看起来可行——只换 Arial 的四个 face，`Hello ABC 你好世界` 渲染完全正确。
但那是假象：**测试文本恰好全在基本 ASCII（U+20–7E），而那一段的 glyph 顺序碰巧一致**。

逐码位比对 21 对替换的 cmap，**没有一对是全一致的**：

```
Arial -> Liberation Sans     检查 939 码位，不一致 844   首例 U+A0  3 -> 98
Times -> Liberation Serif    检查1068 码位，不一致 973   首例 U+A0  3 -> 98
Calibri -> Carlito           检查2939 码位，不一致 2939  首例 U+20  3 -> 2
```

Calibri 和 Carlito 连数字都不同（`1`: glyph 1005 vs 400），尽管两者是 metric-compatible
（字宽一致）。**metric 兼容不等于 glyph 顺序兼容**，而引擎依赖后者。

## 关键发现二：位置是身份，不能共享

`sdk-all.js` 构建字体表时：

```js
for (var x = 0; x < files.length; x++) y[x] = new FontFile(files[x]);
```

**`__fonts_files` 的每个位置都会得到一个独立的字体对象**。所以：

- 让两个 family 指向同一个位置 → 引擎认为是同一个字体，渲染取错 glyph；
- 让多个位置持有同一个文件名 → 引擎当成多个不同字体，各自排队下载（同时只加载 3 个）。
  首个 sweep 就是这样把同一个 16 MB 的 CJK 文件铺到 ~40 个位置上的。

`__fonts_infos` 的"多行共享一个位置"才是 vendor 说的 alias 机制——但那正是第一条禁止的。
两条合起来等于：**每个 family 必须有自己的位置和自己的文件**，于是 48 个中文 family
无法共用一份 CJK 字体。

## 关键发现三：`__fonts_ranges` 的目标是运行时索引

三元组的第三个数是引擎**构建出来的**数组的下标，不是 `__fonts_infos` 的下标。构建时会
跳过 `ASCW3` 那一行（第 11 行，被重定向到一个内嵌兜底字体），所以第 11 行之后的每个
family，运行时下标比源数组小 1。

用 `findIndex()` 写进去的值会指向**后一个** family。这个 off-by-one 真实存在，已在
`bin/font-license-sweep.mjs` 里用 `runtimeRowOf()` 修正——但它**不是**渲染错位的原因
（单独修掉之后照样错位）。

## 关键发现四：硬编码的字体名

`sdk-all.js` 的 `FontPickerByCharacter` 里有一张按语言的默认字体表：

```
默认      DefaultFont = "Arial"
Arabic    "Tahoma"
Korean    "Batang"
Japan     "MS Mincho"
Chinese   "SimSun"
```

主题的默认字体是 `GenerateDefaultTheme(rb, "Calibri")`。

删掉这些名字之后，`GetFontInfo(name)` 返回 `undefined`，紧接着的
`k[p].NeedStyles = 15` 抛 `TypeError: Cannot set properties of undefined`，编辑器停在
骨架屏。这就是"删掉在用字体会白屏"的机制。

## 关键发现五：`g_fonts_selection_bin` 不是可选的

它是 47 KB 的 base64 二进制，`onDocumentContentReady` 之后才被 `delete`。看名字像是
字体选择器的数据，实际是字体系统的核心索引：按 family 名携带 panose、metrics 和字符
覆盖范围。**清空它，所有字符都变豆腐块。**

结构（部分逆向）：记录数(4) + 每条 [长度(4) + 名字 + 本地化名 + 源路径 + panose(10) +
一组 metrics + 覆盖范围]。里面还留着打包机上的路径（`/usr/share/fonts/fonts/FANGSONG.otf`
之类），说明它是构建期从宿主机字体生成的。

**要替换字体就必须同步重建它**，而这需要完整逆向该格式。

## 代价

第一次尝试（PR #170）合并后上线，线上出现全页 glyph 错位——输入 `Hello` 屏幕显示
`Fcjjm`，中文完全不渲染。由 #174 revert 止血。

**E2E 全绿却没拦住**，原因值得记下来：视觉回归用例比的是"原始文档 vs 存回再打开"，
两侧用同一套错误字体渲染，逐像素当然一致。套件里没有任何一条"输入文字再读回来"的用例。
补这条用例是后续工作的一部分。

## 下次做这件事的人

- **不要**再试局部替换，上面五种都验证过了。
- 先决定走哪条路（重建四份数据 / 换 vendor 构建 / patch 硬编码字体名）。
- 无论哪条，验证方式是**真实浏览器里输入文字看渲染**，不是跑 E2E——E2E 看不见这个问题。
- 验证文本必须**跨出基本 ASCII**：至少包含 U+A0 以上的拉丁字符、中文、中文标点。
  只用 `Hello` 会得到"一切正常"的假象。
- 相关工具仍在：`bin/font-catalog.mjs`（XOR 编解码）、
  `test/unit/font-language-coverage.test.ts` 的思路（拿真实语句逐字符查字形）。
