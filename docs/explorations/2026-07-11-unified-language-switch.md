# 统一语言切换：全站 r-select + 共享 lang-switch.js

日期：2026-07-11
分支：feat/seo-landing-hero
涉及：`public/lang-switch.js`（新增）、`public/landing.css`、16 个卫星页、
`public/zh-CN/index.html`、`public/404.html`

## 问题（用户指出）

语言切换不统一：首页（英/中）是 `r-select` 下拉，16 个卫星页和 404 页是
顶栏纯文本链接（"中文"/"EN"）。

## 方案

全站统一为首页同款 `🌐 + r-select`，跳转逻辑收敛到一个共享脚本：

- **`public/lang-switch.js`**：监听 `r-select.lang-select` 的 `change`
  事件（`event.detail.value`），从对应 `r-option` 的 **`data-href`** 属性读
  跳转目标——各页面声明式给出自己的两个语言 URL，零内联逻辑、零重复代码。
  zh 首页原有的内联 handler 一并替换为该脚本。
- 16 个卫星页 + 404 页换成 `r-select` 标记（当前语言为 value，两个
  `r-option` 带 `data-href`），head 增加 `select.iife.js` + `lang-switch.js`。
  `bin/build.sh` 的 vendored 清单从页面派生，select 自动纳入同步。
- `landing.css` 增加 `.lang-wrap` / `r-select.lang-select`（含
  `:not(:defined)` 隐藏防 FOUC）样式，与 home.css 一致。
- 应用首页（根 index.html）不变：markup 相同，接线在 index.ts（应用
  bundle），不加载 lang-switch.js，无双重处理。

## 代价与取舍

- 卫星页每页多加载 select.iife.js（80K raw / ~18K gz）。换来的是全站一致
  的交互范式和未来加语言只改 markup。
- SEO：nav 里的 `<a hreflang>` 可爬链接被 r-option 替代（不可爬），但语言
  互链发现靠每页 `<head>` 里的 `link rel="alternate" hreflang` 已覆盖，
  与首页做法一致。

## 验证

- `/open/docx` 切中文 → `/zh-CN/open/docx`；zh 卫星页切 EN → 英文对应页；
  zh 首页/404 页共享脚本均正常跳转；select 渲染 84×32 与首页一致
- 注意：dev 验证时又遇 SW 旧缓存 landing.css（select 压缩成 22px 的假象），
  清 SW + Cache Storage 后正常——本地验证 public/ 下 CSS 改动时记得先清
- format / lint:ts 通过
