# 字体管理

## 为什么不包含字体文件

本项目不包含 Arial、Times New Roman、微软雅黑、宋体等受版权保护的字体文件。这些字体名称的引用保留在配置文件中以确保文档兼容性，但实际字体文件已移除，以符合开源许可要求。

## 添加字体

字体文件放在 `public/fonts/` 目录下，文件名为 `public/sdkjs/common/AllFonts.js` 中 `__fonts_files` 数组的对应数字索引（无需扩展名）。

**示例：添加 Arial 字体**

1. 打开 `AllFonts.js`，找到 Arial 常规字体的索引 — 是 `223`
2. 将字体文件放置为 `public/fonts/223`
3. 应用程序引用索引 `223` 时会自动加载该文件

Arial 其他变体：

| 变体   | 索引 | 路径               |
| ------ | ---- | ------------------ |
| 常规   | 223  | `public/fonts/223` |
| 斜体   | 224  | `public/fonts/224` |
| 粗体   | 226  | `public/fonts/226` |
| 粗斜体 | 225  | `public/fonts/225` |

查找任意字体的索引，请查阅 `AllFonts.js` 中的 `__fonts_infos` 数组。

> 请仅使用开源字体或拥有合法授权的字体。

## 已知问题：仍有 79 个专有字体（171 MB）

vendor 离线包带进来的字体集是 OnlyOffice Docs **服务器**会从宿主机取到的那一套：
微软 Core Fonts、Monotype 的 Arial / Times / Courier，以及华文、方正、中易、长城、
Stone 的中文字体。本仓库和线上都是公开的，托管即再分发。**这个问题尚未解决。**

2026-08-22 尝试替换过一次，当天 revert（#170 → #174）：上线后全页 glyph 错位，
输入 `Hello` 显示 `Fcjjm`，中文完全不渲染。

**再次动手前请先读
[docs/explorations/2026-08-22-font-licensing-why-substitution-fails.md](explorations/2026-08-22-font-licensing-why-substitution-fails.md)**，
里面记录了五种做法各自怎么坏的实测。简版：

- 不存在"小改一处"的替换。family 名、glyph 索引、metrics、字符覆盖绑在四份数据里
  （`__fonts_files` / `__fonts_infos` / `__fonts_ranges` / `g_fonts_selection_bin`）。
- `__fonts_files` 的每个**位置**就是一个字体身份，不只是路径。两个 family 共用一个
  位置会取错 glyph；一个文件名铺在多个位置会被当成多个字体各自下载。
- metric 兼容不等于 glyph 顺序兼容：Arial 与 Liberation Sans 逐码位比对，939 个里
  844 个不同，只有基本 ASCII 恰好一致——所以只用 `Hello` 测会得到假象。
- `sdk-all.js` 硬编码了 `Arial`、`Calibri`、`SimSun`、`Tahoma`、`Batang`、
  `MS Mincho`，删掉这些名字编辑器直接起不来。
- `g_fonts_selection_bin` 不是可选的，清空后所有字符变豆腐块。

E2E 抓不到这类问题——视觉用例比的是"原始 vs 存回"，两侧用同一套错误字体渲染。
只能在真实浏览器里验证，且测试文本必须跨出 U+00A0。
