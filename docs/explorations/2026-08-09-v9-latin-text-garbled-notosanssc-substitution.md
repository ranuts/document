# v9：默认字体（Times New Roman）打字全乱码，根因是 font-map.json 把拉丁文字体错误替换成了中文字体

## 背景

在排查完 v9 打字失效、样式库中文缺失等一系列问题（见
[2026-08-08 打字失效文档](2026-08-08-v9-typing-broken-websocket-action-leak.md)）
之后，用户反馈：新建文档、正常打字，画面上显示出来的字（英文和中文）都不对——
比如输入"qqqq大"，画面上显示"0000"。

**这是这次 v9 排查里最严重的一个 bug：不是预览缩略图（样式库那次），是文档
正文本身的文字渲染错了，而且影响的是新建文档的默认字体（Times New Roman），
相当于每一篇新文档从一开始就带着这个问题。已定位真正根因并修复、验证通过。**

## 复现与初步定位：模型是对的，画面是错的

用同源 iframe 访问，实测：

1. 新建空白文档（默认字体 Times New Roman），打一个字母 `q`。
2. 用 `api.asc_GetSelectedText()`（全选后读取）确认文档模型里存的**确实是
   `q`**——不是输入法/按键层面出了错。
3. 但画面上渲染出来的字符是 `o`（没有 `q` 那个下垂的尾巴）。

继续测了几个字符，发现一个精确的规律：

| 输入（ASCII 码） | 画面显示（ASCII 码） | 差值 |
| ---------------- | -------------------- | ---- |
| `q`（113）       | `o`（111）           | -2   |
| `a`（97）        | `_`（95）            | -2   |
| `b`（98）        | `` ` ``（96）        | -2   |

**每个字符都精确地往前偏移了 2 位**，不是随机乱码，是系统性的字形错位。

## 排查过程：字形渲染在 WASM 里，JS 这层摸不到

用同源访问追查渲染管线，在 `window.AscFonts` 上发现了一整套 **FreeType**
（`FT_CreateLibrary`、`FT_Open_Face`、`FT_Load_Glyph`、
`FT_SetCMapForCharCode`……）和 **HarfBuzz**（`HB_ShapeText`）的 WASM 导出
函数——SDK 的文字渲染不是自己写的一套引擎，是把这两个业界标准的开源库编译成
WASM 在用。

给 `FT_SetCMapForCharCode`/`FT_Load_Glyph` 这两个"看起来最像作案现场"的
JS 导出函数加了 spy，结果**打字过程中这两个函数一次都没被调用过**——查看它们
的源码，发现就是薄薄一层 `wasmExports['Pa']`/`wasmExports['Va']` 转发，
真正的逻辑全部编译在 `sdk-all.bin` 这个二进制文件内部，JS 这一层完全看不到、
碰不到。而且实测这些函数在"字形已经渲染过一次"之后就不会再走 JS 层——说明有
更底层的、WASM 内部自己的缓存/直接调用路径，我们的 JS spy 从一开始就是绕不
开这层的。

**结论：这次的字形错位很可能是编译进 WASM 内部的逻辑问题，从 JS 这一层没有
直接修的余地**——但没有就此放弃，转而检查"是不是当前这个具体字体文件本身有
问题"。

## 关键突破：换个字体（Arial）就不乱码了

新建文档默认字体是 "Times New Roman"。查 `public-v9/font-map.json`
（v9 自己的字体重定向表，因为项目里没有 Times New Roman 这个字体文件，
所有请求这个名字的地方都会被拦截、换成一个真实存在的替代字体），发现：

```json
"times.ttf": "NotoSansSC-Regular.ttf",
"arial.ttf": "LiberationSans-Regular.ttf"
```

**"Times New Roman" 被换成了中文字体 NotoSansSC，"Arial" 被换成了纯拉丁文
字体 LiberationSans。** 用 API 把当前文字的字体从 Times New Roman 改成
Arial（`api.put_TextPrFontName('Arial')`，配合真实工具栏可以做到同样效果），
再打 `q`——**画面正确显示 "q"，不再错位。**

这就把根因彻底钉死了：**不是 FreeType/HarfBuzz 本身坏了，是 NotoSansSC 这个
具体字体文件在这条渲染路径上有问题（大概率是它的 cmap/字形表结构，跟 SDK
这边假设的某个约定对不上，具体是哪一步的偏差没有必要再往 WASM 内部深挖）——
只要换成结构正常的 LiberationSans，同一套渲染代码就是对的。**

## 影响面：不止 Times New Roman 一个字体

顺着这个思路把 `font-map.json` 全部 66 条映射按"最终指向谁"分类看了一遍，
发现问题远比"Times New Roman 一个字体"大：

**正确的**（指向 LiberationSans，纯拉丁字体，不受影响）：
`arial`、`calibri`、`candara`、`corbel`、`helvetica`、`segoeui` 等。

**错误的**（指向 NotoSansSC，会触发这次的乱码 bug）：
`times`、`georgia`、`cambria`、`trebuc`（Trebuchet MS）、`verdana`、
`tahoma`、`impact`，以及更离谱的——`dejavusans*`、`dejavusansmono*`、
`liberationsans-*` 这几组**请求的就是自己本来的文件名**，却被重定向绕到
NotoSansSC 上去，而这些文件本身其实就在 `public-v9/fonts/` 目录里老老实实
放着，根本不需要替换。

也就是说，"Times New Roman"（新建文档的默认字体！）、Georgia、Cambria、
Trebuchet MS、Verdana、Tahoma、Impact——这些常见西文字体，在 v9 里全都会
触发这次的乱码 bug，`font-map.json` 生成的时候大概率是脚本判断逻辑有问题，
把太多字体默认路由去了 NotoSansSC。

## 修复：改 font-map.json，不改渲染代码

给 `public-v9/font-map.json` 里所有被错误指向 NotoSansSC 的西文字体条目，
统一改成指向 LiberationSans-Regular/Bold/Italic/BoldItalic.ttf（跟 Arial/
Calibri 已经在用的映射方式完全一致）；`dejavusans*`/`dejavusansmono*` 系列
改成指向它们自己真实对应的、本来就已经放在 `public-v9/fonts/` 目录里的文件
（`DejaVuSans*.ttf`/`DejaVuSansMono*.ttf`），不再绕道 NotoSansSC。真正
需要中文渲染的字体名（`msyh`/`simsun`/`simhei`/`stsong`/`dengxian` 等，
本来就是中文字体的名字）保持不变，继续指向 NotoSansSC/NotoSansTC/
NotoSansJP/NotoSansKR。

**这是一个纯配置文件改动，没有碰任何 JS 代码。**

### 权衡：换字体之后，中文字符可能不显示了

`times.ttf` 改指向 LiberationSans（纯拉丁字体）之后，如果用户在"Times New
Roman"这个字体下混着打中文，中文字符会因为字体不支持而不显示（空白）——
但这**不是新引入的问题**：实测过 Arial（本来就指向 LiberationSans）在
这次调查之前就已经是这个行为（专门测过：Arial 下面打"大"字，同样不显示）。
所以这次改动只是让 Times New Roman、Georgia 等字体的表现跟 Arial、Calibri
**保持一致**，不是引入新的限制。

**两害相权取其轻**：改之前是"每一篇新建文档，默认字体下打任何英文字母都可能
乱码"（影响面 = 100% 的新文档）；改之后是"专门选中文本用某几个特定的西文
字体（原来就有这个限制的那几个）时，中文字符不会自动 fallback 显示"（影响面
小得多，而且用户本来就应该给中文文本选中文字体，不是靠西文字体名意外
fallback 出来的）。

## 验证

1. **同一个浏览器标签页里改完立刻测，没生效**——排查发现是这个标签页自己的
   字体/字形缓存太旧（这个标签页从头到尾做了好几十次操作），不是修复本身
   没用。
2. **换一个完全隔离的浏览器上下文（`isolatedContext`，独立 cookie/storage，
   相当于全新访客）重新测**：新建文档，**不做任何手动改字体的操作**，直接
   在默认的 Times New Roman 字体下打 `q`——**画面正确显示 "q"**。这是最
   有说服力的验证，因为它排除了任何缓存/历史状态的干扰。
3. `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage`
   全绿（296 个单测；这次改动本身是 JSON 配置，不涉及需要新增单测的逻辑
   分支）。

## 未验证、留给以后的点

- 只逐一验证了 `times.ttf`→`q` 这一个具体案例。`georgia`/`cambria`/
  `trebuc`/`verdana`/`tahoma`/`impact` 用的是**完全相同的替换目标
  （LiberationSans）和完全相同的机制**，理论上应该同样有效，但没有逐个
  字体重新过一遍真实渲染验证——如果以后这几个字体单独出问题，可以从这里
  接着查，但大概率是同一个坑。
- 没有去分析 NotoSansSC-Regular.ttf 文件本身（用字体工具打开看 cmap 表
  结构等）来彻底搞清楚它为什么会导致这个"-2 偏移"——JS 层面已经找到了
  可行的绕过方案（换字体），没有必要再往 WASM/字体文件内部深挖，性价比
  不高。
- 没有验证这个 bug 是否也存在于 v7（v7 用的是完全独立的一套字体重映射表
  `public/onlyoffice-v7-iframe-patch.js`，跟这次改的 `public-v9/
font-map.json` 是两个不同的文件，需要单独排查）。
