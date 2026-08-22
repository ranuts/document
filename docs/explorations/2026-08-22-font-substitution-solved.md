# 字体版权：79 个专有字体换掉了，以及前一篇为什么把它判成"做不到"

日期：2026-08-22
相关：`bin/font-license-sweep.mjs`、`bin/lib/sfnt.mjs`、`bin/lib/selection-bin.mjs`、
`public/sdkjs/common/AllFonts.js`、`public/fonts/`
前篇：[为什么"换掉专有字体"在这套 vendor 上做不到](2026-08-22-font-licensing-why-substitution-fails.md)（结论已被本文推翻）

## 结论先写

79 个专有字体（171 MB）已从 catalog 中删除，全部由开源字体承接，**文档里写着
"宋体" / "Arial" 的地方照常解析、照常渲染**。`public/fonts/` 从 327 MB 降到 184 MB。

前一篇给出的三条路（重建四份数据 / 换 vendor 构建 / patch 硬编码字体名）**一条都不需要**。
真正的规则只有一条，而且 vendor 自己的 catalog 就在遵守它：

> **位置 P 上那个文件里写的 family 名，必须属于某个指向 P 的 `__fonts_infos` 行。**

原始 catalog 的 267 个被引用位置**全部满足**这条（本轮写了个脚本逐个量的）。
PR #170 打破的就是它：它把替代字体的**文件名**写进了专有字体的位置，于是位置 75
（Arial 的行指着它）上放着一个自称 "Liberation Sans" 的文件，而 "Liberation Sans"
这个名字属于位置 65。引擎用位置 75 的字体排版、却把 "Liberation Sans" 解析到位置 65
去取字形——`Hello` 就成了 `Fcjjm`。

正确的做法只差一行：**不要改 `__fonts_files` 的文件名，改 `__fonts_infos` 的位置号**。
Arial 那一行直接指向 Liberation Sans 已经占着的位置（65 / 62 / 63 / 64），文件不动、
不复制、不改名，一个文件一个位置一次下载，名字与行仍然对得上。

## 前一篇的五条结论，逐条复核

每条都在本地真实构建 + 真实浏览器里重测过（Playwright 无头 Chromium，
文本一律跨过 U+A0：`Hello ABC — Worläöü ÀÉÎ ¡¿ 0123` 与 `你好，世界。中文测试`）。

| 前一篇的说法                                        | 实测                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 位置就是字体身份，两个 family 不能共用一个位置      | **不成立**。共用位置渲染完全正确——只要那个文件的 family 名属于某个指向该位置的行               |
| metric 兼容 ≠ glyph 顺序兼容，所以换字节必然错位    | 方向搞反了。引擎从**加载的那个文件**读 cmap，glyph 顺序天然自洽；错位来自"排版用 A、光栅用 B"  |
| `__fonts_ranges` 第三个数是运行时下标（跳过 ASCW3） | **不成立**。sdkjs 与 PDF 引擎两处消费者都是 `infos[triple[2]][0]`，就是 `__fonts_infos` 的行号 |
| `g_fonts_selection_bin` 格式没有文档、必须整体重建  | 阅读器就在 `sdk-all.js` 里（`CFontSelectFormat.fromStream`）。已完整解码并**逐字节往返**       |
| `sdk-all.js` 硬编码 Arial/Calibri/SimSun/Tahoma/…   | 属实，但不相干：本方案一个 family 名都没删                                                     |

唯一被证实的是最后一条，而它恰好说明**为什么替换比删除好**。

## 引擎到底怎么挑字体的

`sdk-all.js` 的 `StringShaper.Shape`（本仓 vendor 里在 `word/sdk-all.js` 第 1354 行）：

```js
var h = this.GetFontInfo(this.FontSlot),
  g = AscCommon.FontNameMap.GetId(this.FontId.m_pFaceInfo.family_name);
AscCommon.g_oTextMeasurer.SetFontInternal(this.FontId.m_pFaceInfo.family_name, MEASURE_FONTSIZE, h.Style);
AscFonts.HB_ShapeString(this, g, h.Style, this.FontId, …);
this.FontId.m_pFaceInfo.family_name !== h.Name && AscCommon.g_oTextMeasurer.SetFontInternal(h.Name, …);
```

`m_pFaceInfo.family_name` 是 **FreeType 从文件里读出来的名字**，不是 catalog 里的行名。
引擎拿它再过一遍匹配器。名字要是指到别的条目上，排版与光栅就分家了。

实测四种情形（都在 Arial 的位置上换字节，只改文件不改注册表）：

| 位置上放什么                                     | 结果                                 |
| ------------------------------------------------ | ------------------------------------ |
| 内部名 = `Liberation Sans`（catalog 里另有此族） | 错位：`Hello` → `Ebiil`              |
| 内部名 = `Arial`（改写 name 表）                 | 正确                                 |
| 内部名 = `Noto Sans Probe`（catalog 里没有）     | 正确（匹配器兜底回到同一个位置）     |
| 内部名 = `SimSun`（catalog 里另有此族）          | 正确——因为 SimSun 行指的就是这个位置 |

第一条与第四条的区别就是那条不变式。

## 第二个坑：新加的 family 必须进 `g_fonts_selection_bin`

按上面的规则改完，拉丁全对，**中文仍然全错**。原因是 CJK 走的是本轮**新增**的
`Noto Sans/Serif CJK SC` 两个 family，而它们在 `g_fonts_selection_bin` 里没有记录——
匹配器按名字找不到，于是解析到别的字体，又变成"排版用 A、光栅用 B"。

那个 47 KB base64 于是必须能写。它的阅读器就在 `sdk-all.js` 里，照着实现了
`bin/lib/selection-bin.mjs`：

- **decode → encode 逐字节还原**原始 blob（273 条记录）；
- 从字体自己的 OS/2 + head + post 重建一条记录，与 vendor 生成器写的那条
  **完全相同**——凡是能一一对应的 188 个 catalog 文件全部逐字段相等。

对上这 188 个的过程中定死了一个细节：metrics 缩放到 1000 em 用的是 **C 的整数除法
（截断）**，改成四舍五入会有三分之一的文件差 1。

有了这两条，追加记录就是安全操作。本轮只追加、不删除——被删掉那些字体的记录描述的是
**文档当年排版所依据的 metrics**，留着它们，"宋体"这个名字才继续匹配得上（只是落到
开源文件上）。

## 做了什么

`bin/font-license-sweep.mjs`（重写，`--check` 只报告不落盘）：

1. 读每个 catalog 文件自己的 name 表（nameID 0 / 13 / 14）判定版权，79 个专有；
2. 把 8 个开源 family 追加进 catalog（新位置 + 新行 + 新 selection 记录）；
3. 把专有 family 的**行**改指到替代字体已有的位置上（拉丁走 metric-compatible：
   Arial→Liberation Sans、Times→Liberation Serif、Courier→Liberation Mono、
   Calibri→Carlito；中文按字形分两组：宋/仿/楷 → Noto Serif SC，
   黑/雅黑/圆及装饰体 → Noto Sans SC）；
4. 顺手给 48 个中文 family 补上**真正的粗体**（它们在原 catalog 里只有 regular，
   粗体一直是渲染器涂出来的）；
5. 按语系重排 `__fonts_ranges`（切分重叠 run，不整段覆盖）；
6. 落盘前跑一遍上面那条不变式，任何一个被引用位置对不上就抛错、什么都不写；
7. 删掉 79 个专有文件。

### CJK 子集：两种切法，理由不同

Noto 全量是 16 MB（sans）/ 24 MB（serif），每篇中文文档都要付这个钱。用
`fontTools.varLib.instancer` 从可变字体取 400 / 700 两个静态实例，再用
`pyftsubset` 切（命令写在 docs/fonts.md）：

- **sans 切全量 CJK**（统一表意 + 扩展 A + 兼容 + 假名 + 注音 + 全角），9.9 MB。
  所有 CJK 回退区间都指向它，而**回退字体有缺字就是空白**——picker 查一次区间表就
  结束，不会再找第二个字体。第一版把 sans 也切成 GB2312，`繁體漢字` 直接出现空洞。
- **serif 切 GB2312 + 标点假名**，3.6 MB。它承接文档显式写出的宋/仿/楷，覆盖的是
  日常中文；缺的字落到上面那个 sans，而不是落到空白。

韩文**刻意不并进来**：谚文音节 11k 字，而 catalog 自带的 NanumGothic（OFL）本来就
在答这段区间。

## 验证

### 真实浏览器

`test/e2e/font-substitution.spec.ts`：同一段文本，先用被替换的名字（Arial / Times /
Calibri / SimSun / 微软雅黑）排一遍，再用背后真正的开源 family（Liberation Sans /
Liberation Serif / Carlito / Noto Serif SC / Noto Sans SC）排一遍，
**两次渲染必须逐像素相同**——它们指着同一个位置，正常情况下画出来的就是同一批像素；
一旦引擎排版与光栅分家，只有被替换的那个名字会变，两张图立刻分叉。

实测健康值 0.000%～0.044%（残差是光标闪烁），坏掉时 0.56%～0.62%，阈值取 0.3%。

用例里的文字**不用键盘敲，走 `pluginMethod_PasteHtml`**：`page.keyboard.type` 会丢字符，
丢一个 `Wo` 就是 1.4% 的差异，和要找的缺陷同一个量级。

### 反向验证（三层各一次）

| 去掉什么                              | 结果                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 按 PR #170 的做法把文件名写进专有位置 | `font-catalog-licensing` 的不变式用例变红，逐条打印"位置 75（062）里是 Liberation Sans，指向它的却是 Arial" |
| 删掉本轮追加的 15 条 selection 记录   | E2E 的 SimSun / 微软雅黑 两条变红（0.62% / 0.56%，健康值 0.000%～0.044%）；单测两条同时变红                 |
| 把 CJK 源换回 CFF（`OTTO`）子集       | `pdf-cjk-export` 变红：编辑器里 3.14% 墨迹，导出的 PDF 里 0.05%                                             |

### 单测

- `test/unit/font-selection-bin.test.ts`：blob 逐字节往返；188 个文件的记录重建结果
  与 vendor 写的完全一致；每个被回退表引用的 family 都有记录。
- `test/unit/font-catalog-licensing.test.ts`：没有任何一个文件的 name 表查不到开源
  授权证据（vendor 升级把专有字体带回来会直接红）；引用的位置都有文件、磁盘上没有
  无人引用的文件；**那条不变式**；CJK 区间归一到同一个 family；十个语系各自路由；
  回退区间背后的字体**真的有那些字的字形**（就是"空白"那个缺陷）；PDF 清单的槽位
  存在且确实是它声称的那个 family。

### 顺带修掉的线上缺陷

`PDF_FONT_MANIFEST` 里写的是 267–270 这几个槽位——那是 #170 加进去的，而 #174
revert 时**漏了这个文件**（它只 revert 了落地页预取的槽位号）。也就是说从那次
revert 到现在，导出 PDF 里所有中文都是空白。本轮把这几个槽位重新建起来，并补了
两条用例：槽位必须存在，且里面的 family 必须与别名相符。

`public/landing-prefetch.js` 的 `CORE` 与 `test/e2e/landing-prefetch.spec.ts` 的
`CORE_FONTS` 同步改成 059–062（实测三个编辑器共同加载的那四个面）。

## 账

| 项目                   | 变化                               |
| ---------------------- | ---------------------------------- |
| 删除专有字体           | −171.2 MB（79 个文件）             |
| 新增开源字体           | +28.6 MB（15 个文件，SIL OFL 1.1） |
| `public/fonts/`        | 327 MB → 184 MB                    |
| catalog 位置           | 267 → 282（79 个位置从此无人引用） |
| family 数              | 193 → 202                          |
| selection 记录         | 273 → 288                          |
| 回退 range             | 3075 → 2984                        |
| 中文 family 得到真粗体 | 48 个                              |

单篇中文文档的首次下载：宋体一路从 4 MB 变成 3.6 MB（压缩后 2.1 MB），
黑体一路 9.9 MB（压缩后 5.9 MB，它同时是所有 CJK 的回退）。

## 第三个坑：导出 PDF 时中文全空白（CFF 字体不行）

上面全部跑通、E2E 120 条全绿之后，手工验了一次"导出 PDF"——**中文是空白的**，
拉丁照常。同一篇文档在替换前的 catalog 上导出是好的（PDF 214 KB，替换后 32 KB）。

排查过程很短，因为可以对照：把 CJK 回退区间改指到 catalog 自带的
Droid Sans Fallback（TrueType）上，中文立刻回来了（PDF 76 KB）。差别不在字体本身，
在**轮廓格式**：Noto Sans/Serif **CJK** SC 是 CFF（`OTTO`）字体，而 x2t 往 PDF 里
一个字形都嵌不进去；catalog 里原有的字体（SimSun、Liberation、DejaVu、Carlito）
全是 glyf 的 TrueType。

所以 CJK 换成 **Noto Sans SC / Noto Serif SC**：它们是可变字体，用
`fontTools.varLib.instancer --update-name-table` 取 wght=400 / 700 两个静态实例
（`--update-name-table` 不能省，否则 name 表停留在默认实例 "Noto Sans SC Thin"，
两个字重同名、粗体也认不出来），再按上面的两种切法切。轮廓是 glyf，导出 PDF 正常。
顺带比 CFF 版还小：9.9 + 3.6 MB。

**这条只有真的导出一次 PDF 才看得见**：编辑器里渲染完全正常。所以补了
`test/e2e/pdf-cjk-export.spec.ts`——纯中文文档，导出 PDF 再打开，量页面区域的墨迹，
必须还在（两个 viewer 的页面位置不一样，所以不是拿两张图相比，而是各自量各自的墨迹）。
**反向验证**：把 sweep 的 CJK 源换回那两个 CFF 子集重跑一遍，用例报
`the exported PDF page is blank`（编辑器里 12.17% 墨迹，PDF 里 0.02%，正常 1.04%）。

## 上线后实测（PR #184 合并部署之后）

```
/fonts/017?cb=随机   404              ← SimSun，源站已无
/fonts/016?cb=随机   404              ← 微软雅黑，源站已无
/fonts/267?cb=随机   200  10,423,464  ← Noto Sans SC（新）
/fonts/269?cb=随机   200   3,764,940  ← Noto Serif SC（新）
/fonts/017（不带 cb）200   4,077,068  age=329273（3.8 天）  ← 旧 SimSun 的缓存副本
```

`E2E_BASE_URL=https://edit.chaxus.com` 跑 `font-substitution` + `pdf-cjk-export`：
6 条全过（逐像素差 0.000%～0.044%，PDF 墨迹 1.04%）。Production smoke 与 Docker
镜像构建都绿。

## 部署之后还差一步：缓存里的旧字体

`_headers` 给 `/fonts/*` 设的是 `public, max-age=31536000, immutable`。这条规则在
"文件名即内容"的前提下没问题，但**删除**打破了那个前提：被删掉的名字不会再有新内容
去覆盖缓存，旧字节可以在边缘再活将近一年。#170 那次上线实测过：带 cache-buster 请求
`/fonts/017` 是 404（源站确实没有了），不带 buster 拿到的是 4 MB 的旧 SimSun，
`age` 逐秒增长。

上面那张表就是它：源站 404、缓存里还在发 4 MB 的旧 SimSun。
所以要**在 Cloudflare 面板做一次 Purge Cache**（本轮尚未执行）（仓库里做不到：`_headers`
只能声明将来的缓存策略，改不了已经发出去的副本）。在此之前那些专有字体仍然可以从
本站域名取到——新的 `AllFonts.js` 已经不再引用它们，正常使用不会请求到，但严格说
仍在提供。

## 给下一个人

- 改 catalog 前后各跑一次 `node bin/font-license-sweep.mjs --check` 和
  `npx vitest run test/unit/font-catalog-licensing.test.ts`。
- **别再把文件名在位置之间搬来搬去**。要换字体就改行里的位置号。
- 新增 family = 位置 + `__fonts_infos` 行 + `g_fonts_selection_bin` 记录，三样缺一不可。
- 验证一定要在真实浏览器里看渲染，文本跨过 U+A0，并且用 `PasteHtml` 而不是键盘。
