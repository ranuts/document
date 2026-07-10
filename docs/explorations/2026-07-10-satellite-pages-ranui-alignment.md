# SEO 卫星页对齐 ran 设计体系：vendored ranui IIFE + landing.css 重建

日期：2026-07-10
分支：feat/seo-landing-hero
涉及：`public/ranui.iife.js`（新增，生成物）、`bin/ranui-iife.entry.ts`、
`vite.ranui-iife.config.ts`、`bin/build.sh`、`public/landing.css`、
16 个卫星页、`public/zh-CN/index.html`、`public/home.css`、`.prettierignore`

## 问题

16 个 SEO 卫星页（/offline-document-editor、/no-signup-document-editor、
/open/_、/convert/_、/vs/* 及其 /zh-CN/ 镜像）与刚重设计的首页完全脱节：

1. `landing.css` 自造调色板（`#0052cc` + Tailwind 灰阶）+ 系统字体，
   不走 `--ran-*` token
2. 顶栏是 `📝` / `🌐` / `★` emoji 拼的，与首页 logo 块 + octocat 不一致
3. `theme-color` 还是 `#0052cc`（首页与 manifest 已是 `#006bff`）
4. CTA / 卡片全是手写样式，因为静态页没有打包器、跑不了 ranui 组件；
   zh 首页也因此维护着 `.btn`/`.card`/原生 `<select>` 三套降级实现

## 方案：vendored ranui IIFE（用户提议）

在 public/ 放一个 ranui 的 IIFE bundle，静态页 `<script defer>` 引入即可
注册真组件，所有页面对齐同一套 UI：

- **入口** `bin/ranui-iife.entry.ts`：只 import `ranui/button|card|select`
  三个 side-effect 注册（全量 `ranui/dist/index.iife.js` 有 1.5 MB，含
  player/katex，不适合 SEO 入口页）
- **构建** `vite.ranui-iife.config.ts`：vite lib 模式 IIFE 输出
  `public/ranui.iife.js`（94 KB / gzip 21.6 KB），`publicDir: false` 防止
  public 复制自身，`emptyOutDir: false` 防止清空 public
- **同步机制**：`bin/build.sh` 每次构建重新生成（与 ran-tokens.css 同一
  模式，永不漂移）；产物提交入库；`.prettierignore` 忽略之
- sw.js 预缓存列表是最小集（运行时缓存兜底），无需改动

## 页面改动

**16 个卫星页**（Python 脚本批量转换，逐页断言防错配）：

- `theme-color` → `#006bff`；`<link /ran-tokens.css>` 前置；IIFE defer 引入
- 顶栏换成首页同款 bar（logo 块 + 语言切换链接 + octocat GitHub 链接，
  gh-mark 用 `<symbol>` + `<use>` 复用）
- h1 上方新增 mono eyebrow，编码页面类别（"Offline · PWA"、
  "Convert · .xlsx → .csv"、"对比 · vs Google Docs"……）
- CTA `<a class="cta">` 内包真 `<r-button type="primary">`；
  开源框 `<div class="oss">` → `<r-card class="oss">`

**landing.css 全量重写**：零私造值，全部桥接 `--ran-*` token；hairline
h2 / mono eyebrow / FAQ 每问 hairline / 对比表 mono 表头，视觉语言与
home.css 一致；暗色由 token 层免费获得（原先是手写的一套暗色变量）。

**zh 首页去降级**：`.btn`→`<a><r-button>`、`.card`→`<r-card>`、原生
`<select>`→`<r-select>`（+ 内联脚本监听 `change` 的 `event.detail.value`
做跳转，与 index.ts 同协议）。home.css 里三套降级样式删除。

## 渐进增强约定（重要）

组件注册前/无 JS 时页面必须可用：`:not(:defined)` 兜底样式承担 FOUC
防护——`r-button:not(:defined)` 渲染成同款按钮外观（CTA 始终可点，
外层是真 `<a>`）、`r-card:not(:defined)` 给边框卡片外观、
`r-select.lang-select:not(:defined)` 隐藏但保留占位宽度。**新增组件用法
时记得配套 `:not(:defined)` 规则。**

## 验证

- Chrome 实测：EN/ZH 卫星页 × 亮/暗 × 桌面/移动，全部正常；
  `customElements.get('r-button')` 确认 IIFE 注册成功
- zh 首页 r-select 派发 `change`（detail.value='en'）确认跳转 `/` 生效
- `pnpm run lint:ts`、`pnpm run format:check` 通过
- embed-demo.html 是开发者演示页（自带内联样式），本轮未动

## 后续可选

- 若 ranui 日后提供官方按组件 IIFE 分发，可撤掉本地打包配置直接同步
- E2E 可加一条卫星页冒烟（断言 r-button upgraded + 无 console error）
