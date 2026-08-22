# 字体：171 MB 专有字体，和一行中文里的四种字体

日期：2026-08-22
相关：`public/fonts/`、`public/sdkjs/common/AllFonts.js`、`bin/font-license-sweep.mjs`、
`packages/converter/src/document-converter.ts`
前篇：[字体在线上是裸传的](2026-08-22-font-transfer-and-dead-config.md)

起因是一句用户反馈："默认的字体展示中文效果很差，期望默认的字体对于多语言的展示
都比较好才行，至少不会乱。" 查下去发现观感问题和版权问题是同一件事的两面。

## 一、版权：79 个文件、171 MB 不能再分发

把 `public/fonts/` 全部 267 个文件按 XOR 解码后读 sfnt name 表
（nameID 0 版权 / 13 授权 / 14 授权 URL），按权利人归类：

| 权利人            | 文件 | 体积    | 代表字体                                                   |
| ----------------- | ---- | ------- | ---------------------------------------------------------- |
| 常州华文 SinoType | 20   | 74.9 MB | 华文楷体/宋体/仿宋/中宋/细黑/隶书/行楷/彩云/琥珀           |
| 北京方正 Founder  | 11   | 28.1 MB | 方正舒体/姚体/小标宋/仿宋/黑体简体、微软雅黑               |
| 无版权字段        | 11   | 26.8 MB | SimSun 宋体、SimHei 黑体、LiSu 隶书、等线、经典系列        |
| 中易中标 ZHONGYI  | 2    | 20.5 MB | 新宋体（`© ZHONGYI Electronic Co. 2001`）                  |
| 长城计算机        | 2    | 7.7 MB  | 仿宋_GB2312、楷体_GB2312                                   |
| Stone Co.         | 2    | 6.4 MB  | 幼圆                                                       |
| Microsoft         | 16   | 3.5 MB  | Calibri、Georgia、Verdana、Trebuchet、Comic Sans、Webdings |
| Monotype          | 15   | 3.5 MB  | Arial、Times New Roman、Courier New、Impact、Andale Mono   |

这批是 OnlyOffice Docs **服务器**会从宿主机上取到的字体集，第三方打离线包时一并
带进来了。本仓库与 edit.chaxus.com 都是公开的，托管即再分发。

分类过程中有三处初判有误，逐个读 nameID 13 后修正（都是**开源**，予以保留）：

- **Khmer OS**：`This font is free software; you can redistribute it...`（LGPL）
- **Liberation Sans Narrow**：`Licensed under the Liberation Fonts license`
  （Copyright 归 Oracle 容易误导）
- **Mitra Mono**：`GNU© Dr Anirban Mitra. You are allowed to distribute...`

另有 AR PL UKai（文鼎 Arphic Public License）、Takao（IPA）、Nanum（NHN/NAVER）、
Symbola、Tibetan Machine Uni、OpenSymbol、ASCW3 均已核实可分发。

## 二、观感：一行中文，四种字体

`__fonts_ranges` 是 `[起, 止, __fonts_infos 行号]` 三元组（**注意第三个数是
infos 的行索引，不是 files 的位置**，这里踩过一次，两个数组长度接近，认错了照样
能解析出"某个"字体）。vendor 给的默认值把 CJK 拆给了四个互不相关的字体：

| 码位             | vendor 默认         | 说明                                   |
| ---------------- | ------------------- | -------------------------------------- |
| `一` U+4E00 汉字 | Droid Sans Fallback | 2008 年 Android 的回退字体，**无粗体** |
| `。` U+3002 句号 | Microsoft YaHei     | 专有                                   |
| `，` U+FF0C 全角 | SimSun              | 专有，且汉字只覆盖 32%                 |
| `あ` U+3042 假名 | SimSun              |                                        |
| `가` U+AC00 谚文 | NanumGothic         |                                        |

所以「你好，世界。」这七个字：汉字是 Droid（黑体骨架）、逗号是宋体、句号是雅黑。
三种字形风格、三种字重、三种标点字面位置。这不是审美判断，是机械事实——新加的
用例失败时会把它原样打出来：

```
split across families: [["ideograph 一","Droid Sans Fallback"],
  ["ideographic full stop","Microsoft YaHei"],["fullwidth comma","SimSun"],
  ["hangul","NanumGothic"]]: expected 4 to be 1
```

加粗更糟：Droid Sans Fallback 只有 regular，中文加粗全靠算法合成。

## 三、两件事必须一起做

删掉专有字体，中文标点和假名就没有覆盖字体了，直接变豆腐块。而且问题不止中文：

**Calibri 一个字体，独自扛着阿拉伯文、亚美尼亚文、格鲁吉亚文、希伯来文和西里尔
补充。** 把它换成 metric-compatible 的 Carlito——Carlito 这几个语系的覆盖率是
0%。只做版权替换的那一版，实测覆盖率是这样的：

```
Armenian    95% -> 0%      Arabic       100% -> 0%
Georgian    92% -> 0%      Arabic Supp  100% -> 0%
Hebrew      78% -> 29%     Cyrillic Supp 100% -> 42%
```

65 个 Unicode 区块里 48 个原本依赖专有字体，**整个回退体系是架在 Arial + Calibri
两个专有字体上的**。这是"不止中文"的实质。

## 四、做法

### 位置替换，不动数组

`__fonts_files` 是**位置索引**：`__fonts_infos` 按下标引用 face，不按名字。所以
不能从数组里摘条目（会打乱后面所有位置），而是**把专有文件所在槽位的值改写成替代
字体的文件名**，再物理删除该文件。

一处改动同时解决两件事：文档里写着"宋体"或"Arial"照样解析得到，只是落到开源字体
上——这正是 LibreOffice 的 metric-compatible 替换策略。

`g_fonts_selection_bin`（字体选择器与 metrics 的二进制，格式未文档化）**刻意不
动**：它携带的正是我们要继续应答的那些 family 名。

### 替换表

拉丁部分优先选 metric-compatible（字宽一致，不跑版）：

| 文档中的名字                              | 实际字体          |
| ----------------------------------------- | ----------------- |
| Arial / Arial Black                       | Liberation Sans   |
| Times New Roman                           | Liberation Serif  |
| Courier New / Andale Mono                 | Liberation Mono   |
| Calibri                                   | Carlito           |
| Georgia                                   | DejaVu Serif      |
| Verdana / Trebuchet / Comic Sans / Impact | DejaVu Sans       |
| Webdings                                  | OpenSymbol        |
| 宋体 / 仿宋 / 楷体系                      | Noto Serif CJK SC |
| 黑体 / 雅黑 / 等线 / 幼圆 / 装饰体系      | Noto Sans CJK SC  |

中文衬线类给衬线体而不是一律拍平成黑体——宋体是中文正文的常用字体。装饰体
（隶书、舒体、姚体、彩云、琥珀、行楷、新魏）没有开源等价物，落到黑体，
理由是"字形完整可读"优于"落到部分覆盖的字体然后缺字"。

### 语系路由

每一条都是**实测**出来的：把该语系的区块拿去和 catalog 里 193 个 family 逐个打分，
取最高的，而不是凭印象指定。

| 语系                         | 目标                      | 备注                                |
| ---------------------------- | ------------------------- | ----------------------------------- |
| 全部 16 个 CJK 区块          | Noto Sans CJK SC          | 一个文件覆盖简中/繁中/日文/韩文     |
| 阿拉伯（4 个区）             | Noto Naskh Arabic         | catalog 原本就有，OFL，之前没被用上 |
| 希伯来 / 亚美尼亚 / 格鲁吉亚 | 对应 Noto Sans 分支       | 新增，各几十 KB                     |
| 西里尔补充 / 越南语扩展      | Noto Sans                 | 新增                                |
| 叙利亚文 / 塔安那文          | Noto Sans Syriac / Thaana | **原本零覆盖**，新增                |
| 希腊                         | DejaVu Sans               | 94%，高于 Noto Sans 的 84%，故不动  |

### ranges 要切分，不能整段覆盖

一个三元组可能跨语系边界。所以路由是把重叠的 run **切开**再插入，而不是整条改写
（否则给希伯来文改路由会把邻居一起拖走）。3075 条经切分+合并后成 2977 条。

## 五、验证

### 覆盖率逐区块对比（改动前 vs 改动后）

42 个主要 Unicode 区块，全部持平或提升。两个显示为"下降"的经查是假象：

- **平假名 99% → 97%**：Noto CJK 只缺 U+3040 / U+3097 / U+3098，这三个在 Unicode
  中**未分配**。旧字体给未分配码位也放了字形。97% 就是满分。
- **Arabic Pres-A 91% → 89%**：该区含 32 个 noncharacter（U+FDD0–FDEF）。排除后
  Noto Naskh 覆盖已分配码位的 93%。

叙利亚文、塔安那文从 0% 变为有覆盖。

### 用例

`test/unit/font-catalog-licensing.test.ts`，17 条：

- 逐个文件读 name 表，任何一个查不到开源授权证据就红（vendor 升级重新引入会被拦）
- `__fonts_infos` 引用的文件都在磁盘上；磁盘上没有无人引用的文件
- `__fonts_ranges` 的目标都是有效 infos 行
- 11 个 CJK 探针必须落到**同一个** family
- 10 个语系各自路由到指定字体

**反向验证**：`git stash` 掉 `public/` 的改动恢复原 catalog，17 条中 **12 条变红**，
其中"CJK 单一字体"那条直接打印出四个字体的清单（见上文）。恢复后全绿。

### 顺带抓到的 P0

`PDF_FONT_MANIFEST` 硬编码槽位号，其中 `017`（SimSun）和 `016`（微软雅黑）在
sweep 之后已不存在——**导出 PDF 里所有中文会是空白**。这个列表手工维护、无人钉住，
补了两条用例（引用的槽位必须存在；必须覆盖中文常用字体名）。反向验证：把 `269`
改回 `017`，用例报 `expected [ '017' ] to deeply equal []`。

`test/unit/document-converter.test.ts` 里两条硬编码 `fonts/072` / `fonts/017` 的
断言也改成从 manifest 派生——槽位已经移动过一次，钉死只会产生假红。

## 六、账

| 项目         | 变化                               |
| ------------ | ---------------------------------- |
| 删除专有字体 | −171.2 MB（79 个文件）             |
| 新增开源字体 | +81.2 MB（15 个文件，SIL OFL 1.1） |
| 净变化       | **−90 MB**                         |
| catalog 槽位 | 267 → 282                          |
| family 数    | 193 → 201                          |
| 回退 range   | 3075 → 2977（切分后合并）          |

首次打开中文文档的下载量与之前大致相当（旧的宋体 3.9 MB + Droid 4 MB + 雅黑
1.5 MB ≈ 9.4 MB 裸传，新的 Noto Serif CJK 24.5 MB 但经前篇的传输压缩约 13 MB），
换来的是完整覆盖、单一字形风格和真正的粗体。catalog 是按槽位**按需**取的，所以
四个新 CJK 字重不会一起下载。

## 六点五、部署之后还差一步：缓存里的旧字体

合并部署后线上实测（同一时刻）：

```
/fonts/017                 HTTP 200   4,077,068 bytes   age: 310369   （旧 SimSun）
/fonts/017?cb=<随机>       HTTP 404
/fonts/267?cb=<随机>       HTTP 200  16,437,364 bytes   （新 Noto Sans CJK SC）
```

带 cache-buster 就是 404，说明**源站已经没有这些文件了，部署是对的**；不带
buster 拿到的是缓存副本，`age` 逐秒增长（310369 ≈ 3.6 天），也就是同一份旧副本
一直在被服务。

**是我们自己的缓存头把它钉住的**：`_headers` 给 `/fonts/*` 设了
`public, max-age=31536000, immutable`。这条规则在"文件名即内容"的前提下是对的
（catalog 按索引命名、随 vendor 整体更换），但**删除**打破了那个前提——被删的
名字不会再有新内容来覆盖缓存，于是旧字节可以再存活将近一年。

`cf-cache-status` 一直报 `DYNAMIC`，同时又带着 `age`——所以这层缓存不是 CF CDN
的那一层（多半是 Pages 自己的资产层）。**读 `DYNAMIC` 不能推断"没有被缓存"。**

**需要在 Cloudflare 面板做一次 Purge Cache**（仓库里做不到：`_headers` 只能声明
将来的缓存策略，改不了已经发出去的副本）。在此之前，那些专有字体仍然可以从本站
域名取到——虽然新的 `AllFonts.js` 已经不再引用它们，正常使用不会请求到，但严格
说仍在提供。

教训：**给 immutable 长缓存的资源，"删除"不是一个可以单方面完成的动作**，删完还
要主动作废缓存。下次批量移除 vendor 资源时一并计划这一步。

## 七、留给后续

**vendor 里从不加载的文件**，本轮没动（主题不同，单独 PR）：

- `*_ie*.js` 27.5 MB——加载条件是 `useWasm ? "x.js" : "x_ie.js"` / `WebAssembly.Memory`
  检测，而本站 x2t 强依赖 WASM，无 WASM 的浏览器根本打不开文档。
  **已在后续 PR 删除并实测**：删掉后全套 E2E 99 passed / 0 failed。
- visio（`sdkjs/visio` 13 MB + `web-apps/apps/visioeditor` 7.1 MB）——
  `DOCUMENT_TYPE_MAP` 里没有 vsdx，但 `api.js` 直接引用了它，删除需要单独验证。

**`sdk-all.js` 不在这个清单里，尽管一开始以为它是。** 它共 54 MB，而 requirejs
配的是 `sdk: "../../sdkjs/word/sdk-all-min"`，看起来非 min 那份从不加载。真删掉
之后 **11 个 E2E spec 变红**，报 `Unexpected token '<'`——那是 404 落到 SPA
fallback 后把 index.html 当 JS 解析。trace 里有对 `/sdkjs/word/sdk-all.js` 的
真实请求。

`sdk-all-min.js` 是引导包，`sdk-all.js` 是其后加载的**完整 API 包**：
`save-stream.ts` 的注释写着 "the full API bundle (sdk-all.js)"，`isLoadFullApi`
就是它的标志位，`open-state.ts` 也区分了 "sdk-all-min, asc_docs_api._init"。
所以 `lib/prefetch.ts` 与 `landing-prefetch.js` 两个都预取是**对的**。

教训：requirejs 的 `paths` 只说明"模块名怎么解析成第一个文件"，不等于"运行时
只会取这一个文件"。判断 vendor 死代码要以**实际请求**为准——删掉跑一遍 E2E，
比读配置可靠。
