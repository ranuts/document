# 字体管理

英文版（含完整细节：回退路由、授权判定、PDF 导出清单）见 [fonts.md](fonts.md)。

## catalog 里只放可再分发的字体

本项目与 edit.chaxus.com 都是公开的，把字体放进仓库就等于再分发它。

vendor 离线包原本带着 **79 个专有字体、171 MB**——常州华文、北京方正、中易中标、
长城、Stone 的中文字体，以及微软 Core Fonts 和 Monotype 的 Arial / Times New
Roman / Courier New。那是 OnlyOffice Docs **服务器**会从宿主机取到的字体集，被
一并打进了离线包。2026-08-22 已由 `bin/font-license-sweep.mjs` 全部换成开源等价物。

（本文件此前写着"本项目不包含受版权保护的字体"——那句话在 v9 vendor 引入后就
与事实不符了，现在才真正成立。）

`test/unit/font-catalog-licensing.test.ts` 每次运行都会读每个字体文件自己的
name 表（nameID 0/13/14），一旦 vendor 升级把专有字体带回来就会变红。

## 替换后的对应关系

文档里写的字体名**保持不变**（`__fonts_infos` 的 family 名照旧），只是背后的
文件换成了开源字体。拉丁部分优先选字宽一致的替代品，所以换字体不会跑版：

| 文档中的名字                              | 实际字体          |
| ----------------------------------------- | ----------------- |
| Arial、Arial Black                        | Liberation Sans   |
| Times New Roman                           | Liberation Serif  |
| Courier New、Andale Mono                  | Liberation Mono   |
| Calibri                                   | Carlito           |
| Georgia                                   | DejaVu Serif      |
| Verdana、Trebuchet MS、Comic Sans、Impact | DejaVu Sans       |
| 宋体、仿宋、楷体系                        | Noto Serif CJK SC |
| 黑体、微软雅黑、等线、幼圆、装饰体系      | Noto Sans CJK SC  |

同一次改动还修好了中日韩的显示：此前一行中文会被拆给**四个不同字体**渲染
（汉字用 Droid Sans Fallback、句号用微软雅黑、全角逗号用宋体、谚文用
NanumGothic），现在全部由 Noto Sans CJK SC 一家承担，中文也终于有了真正的粗体
而不是算法合成的。

## 添加字体

字体文件放在 `public/fonts/` 目录下，文件名是 `__fonts_files` 数组里的名字
（无扩展名）。**注意这是 XOR 混淆的线格式，裸 TTF 放进去无效**，必须用
`bin/font-catalog.mjs` 编码：

```bash
# 挑一个当前最大编号之后的名字
node bin/font-catalog.mjs encode MyFont.ttf public/fonts/282
```

然后在 `public/sdkjs/common/AllFonts.js` 里：

1. 把 `"282"` 追加到 `__fonts_files`，记下它的数组位置 `P`；
2. 在 `__fonts_infos` 里加一行 `["My Font", P, 0, -1, -1, -1, -1, -1, -1]`；
   要让别的字体名也解析到同一个文件，就再加几行指向同一个 `P`（这就是别名机制）。

**别把编号记死**：`__fonts_files` 是位置索引，而替换专有字体的做法是改写槽位的
值，所以同一个位置在一次 sweep 之后可能指向完全不同的文件。要用哪个编号，去读
`AllFonts.js`。

改完 catalog 还有三处按编号硬编码、必须同步，否则静默 404：
`packages/converter` 的 `PDF_FONT_MANIFEST`、`public/landing-prefetch.js` 的
`CORE`、`test/e2e/landing-prefetch.spec.ts` 的 `CORE_FONTS`。前两处都真的漏过。

> 只使用开源字体或拥有合法授权的字体。
