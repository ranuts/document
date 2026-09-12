# 字体管理

## 为什么不包含字体文件

本项目不包含 Arial、Times New Roman、微软雅黑、宋体等受版权保护的字体文件。这些字体名称的引用保留在配置文件中以确保文档兼容性，但实际字体文件已移除，以符合开源许可要求。

## 添加字体

字体文件放在 `public/fonts/` 目录下，文件名是 `public/sdkjs/common/AllFonts.js` 里
`__fonts_files` 数组的一个**元素**（一串数字，无扩展名），而 `__fonts_infos` 的行
按**数组下标**引用它——注意这两者不是一回事：下标 65 上放的字符串可能是 `"062"`。

文件不是裸 TTF：前 32 字节被固定 16 字节密钥 XOR 过，用 `bin/font-catalog.mjs`
编解码（正反变换相同）。

```bash
node bin/font-catalog.mjs encode MyFont.ttf public/fonts/282   # 装进 catalog
node bin/font-catalog.mjs decode public/fonts/062 /tmp/x.ttf   # 取出来看
node bin/font-catalog.mjs verify public/fonts/000              # 体检
node bin/font-thumbnails.mjs                                   # 补字体下拉的缩略图
```

改完 `AllFonts.js` 一定要跑最后那条：字体下拉的名字是从精灵图里按行号裁出来的，
目录比图长会直接抛错（见下面 #218 那节）。

加一个新 family 要同时做三件事，见下面"新增 family 要同时做三件事"。查某个字体现在
落在哪个文件上：在 `__fonts_infos` 里找到它那一行，取常规面的位置号 P，再读
`__fonts_files[P]`。

> 请仅使用开源字体或拥有合法授权的字体。

## 专有字体已经换掉了（2026-08-22）

vendor 离线包带进来的字体集是 OnlyOffice Docs **服务器**会从宿主机取到的那一套：
微软 Core Fonts、Monotype 的 Arial / Times / Courier，以及华文、方正、中易、长城、
Stone 的中文字体，79 个文件、171 MB。本仓库和线上都是公开的，托管即再分发。

`bin/font-license-sweep.mjs` 已把它们全部换成开源字体：文档里写着 "Arial" 或
"宋体" 照常解析，只是落到 Liberation Sans / Noto Serif SC 上。**没有改任何
字体文件、没有改名**，换的是注册表，不是字节。

```bash
node bin/font-license-sweep.mjs --check   # 只报告方案，不落盘
node bin/font-license-sweep.mjs           # 执行
```

### 唯一那条规则

引擎排版时读的是**加载的那个文件里**写的 family 名（`m_pFaceInfo.family_name`），
再拿它过一遍匹配器。所以：

> 位置 P 上那个文件里的 family 名，必须属于某个指向 P 的 `__fonts_infos` 行。

原始 catalog 的 267 个被引用位置全部满足这一条。第一次尝试（PR #170，当天被 #174
revert）把替代字体的**文件名**写进了专有字体的位置，于是位置 75（Arial 那一行指着它）
上放着一个自称 "Liberation Sans" 的文件，而这个名字属于位置 65——引擎用一个字体排版、
用另一个字体画字形，输入 `Hello` 显示 `Fcjjm`。

正确做法：**不要在位置之间搬文件名，改行里的位置号**，让 Arial 那一行直接指向
Liberation Sans 已经占着的位置。

### 新增 family 要同时做四件事

位置（`__fonts_files`）+ 行（`__fonts_infos`）+ **`g_fonts_selection_bin` 里的一条
记录** + **十张缩略图精灵图里各一块瓦片**。少了第三样，匹配器按名字找不到这个
family，又会回到"排版与光栅分家"的错位；少了第四样，读者把字体列表滑到底，编辑器
当场不能用了。

`g_fonts_selection_bin` 一度被当成不可修改的黑盒。它的阅读器就在 `sdk-all.js` 里，
`bin/lib/selection-bin.mjs` 按同一套布局实现了读写，单测钉住两件事：解码再编码与
原始 blob 逐字节相同；从字体自己的 OS/2 + head + post 重建的记录，与 vendor 生成器
写的那条完全一致。

### 字体下拉的名字精灵图（issue #218）

下拉里每个字体名不是文字，是从一张精灵图里按"该字体在 `__fonts_infos` 里的位置"
裁出来的一块瓦片：

```js
s = Math.floor(store.at(n).get('imgidx') / r);
spriteThumbs.getImage(s);
// -> s.data.set(new Uint8ClampedArray(this.data.buffer, i * a, a))
```

目录比精灵图长**不是降级而是抛错**——`RangeError: Invalid typed array length`，
而且之后每次滚动再抛一次，文档没法编辑了。字体替换那次追加了 9 个 family、精灵图
还是 vendor 的 193 块，这就是 #218。

上游踩不到，是因为 `allfontsgen` 一次性写出 `AllFonts.js` 和精灵图（对照一个官方
部署：144 families / 144 瓦片）。但在我们这儿**不能跑那个生成器**：它只认字体文件
name 表里的名字，而我们 202 行里有 **60 行是别名**——`Arial`、`Calibri`、
`Microsoft YaHei`、`楷体` 等等，没有任何文件真叫这些名字。跑它会把这 60 行全抹掉，
凡是按专有字体名引用的文档就不再解析。

所以精灵图归我们自己维护：

```bash
node bin/font-thumbnails.mjs             # 补齐缺的瓦片，并重建 png
node bin/font-thumbnails.mjs --check     # 只报不写
node bin/font-thumbnails.mjs --calibrate # 打印 vendor 的排版参数
```

幂等——vendor 自带的瓦片一个字节不动——并且十张图全写（`fonts_thumbnail` 与
`fonts_thumbnail_ea`，五档像素比），因为 picker 对每一张都按同一个位置取。名字用
该字体自己渲染，排版参数是从 vendor 现有瓦片上量出来的，不是猜的。

每张精灵图有两份：所有浏览器读的游程 alpha 掩码 `*.png.bin`，以及只有 ONLYOFFICE
桌面壳才读的 RGBA `.png`。png 是**从掩码整张重建**而不是追加，两者不可能走散。格式
（别处没有文档）：12 字节大端头（`width` / `heightOne` / `count`），随后是 alpha
掩码，一个字节就是一个像素的覆盖度，`0` 除外——它后面跟一字节的全透明游程长度。

`test/unit/font-catalog-licensing.test.ts` 把这些都钉住了：瓦片数对 family 数、
解码像素数对文件头、png 的 alpha 通道对掩码逐字节。
`test/e2e/font-picker-scroll.spec.ts` 走用户路径：打开列表、滑到底、要求最后一行
真的有名字画出来。

### 验证方式

E2E 的视觉用例比的是"原始 vs 存回"，两侧用同一套字体渲染，看不见字体本身的错误。
改完 catalog 一定要在真实浏览器里看渲染，测试文本**跨出 U+00A0**，并且用
`pluginMethod_PasteHtml` 灌文字而不是键盘输入（键盘会丢字符，丢一个词的差异和
缺陷本身同量级）。

细节见
[docs/explorations/2026-08-22-font-substitution-solved.md](explorations/2026-08-22-font-substitution-solved.md)。
