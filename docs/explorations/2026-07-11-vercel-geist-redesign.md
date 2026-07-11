# Vercel/Geist 风格重设计：单色 CTA、有边框卡片、主题切换器、编辑器 chrome token 化

## 背景

用户对落地页整体设计不满意，要求在现有设计体系内参考 Vercel 的风格重做。
探索发现 ranui 的 token 层本来就是照 Geist 建的（Geist 字体、`#006bff`
Vercel 蓝、10 级灰阶），问题出在页面层的运用：蓝色强调过重（蓝 CTA、蓝眉
题）、卡片是无边框灰底、编辑器本体 UI 硬编码旧紫 `#667eea` 且无暗色模式、
没有主题切换器。

用户确认的三个方向：**单色 CTA**（黑底白字，暗色反转；蓝色降级为链接色 +
hero 选区高亮）、**范围含编辑器 UI**、**加三态主题切换器**。

## 上游先行（chaxus/ran → feat/geist-contrast-button-tokens）

单色按钮是 Geist 核心原语，按"生态优先"沉到 ranui 而不是站点覆写：

- 新语义 token `--ran-color-contrast-{bg,bg-hover,bg-active,text}`，bg/text
  挂在 gray-1000/background-100 上随主题自动反转；
- `r-button type="contrast"` 一等变体；默认（secondary）hover 去蓝改为
  Geist 边框加深；
- `r-card` 默认形态改为 Geist 有边框卡片（`--ran-color-bg` + 1px 边框），
  并新增 `--ran-card-border-color` 穿透 closed shadow root 做 hover 加深；
- 清扫 antd 时代的硬编码 fallback（`#1890ff`/`#d9d9d9`）。

**联调方式**：`ran` 构建后 `cp -R .../ranui/dist/. node_modules/.pnpm/
ranui@0.2.0-alpha.2/node_modules/ranui/dist/`，站点 `pnpm build` 自动再生
`public/ran-tokens.css` + `public/ranui-iife/*`。此拷贝会被 `pnpm install`
冲掉；**上线前必须先发 `ranui@0.2.0-alpha.3` 并 bump 依赖**（CI 从 registry
安装，否则 vendor 到旧 token 层）。保险：站点 CSS 消费新 token 一律带内联
兜底 `var(--ran-color-contrast-bg, var(--ran-gray-1000))`。

## 站点改动

- **home.css / landing.css**：CTA 圆丸化（`::part` + `:not(:defined)` 兜底
  同步改 contrast 配色）；眉题/卡片标签/步骤编号由蓝转灰 mono；logo 单色化
  （`--ink` 底、`--ran-color-bg` 字，随主题反转）；hero 徽章透明底细边框圆
  丸；docwin 阴影降为 elevated 层；卡片 hover 由"上浮 + menu 阴影"改为
  "边框加深 + elevated 阴影"；eco/页脚 hover 由蓝转 ink。蓝色只保留：链接、
  hero 选区高亮（`--sel`）、caret、焦点环。
- **主题切换器**：`public/theme.js`（vanilla，键 `ran-theme`，与 ranui
  `setTheme` 约定一致：强制主题设 `data-ran-theme`+`theme` 双属性，system
  移除属性让媒体查询接管）+ 每页 head 无闪烁内联片段 + 页脚三态圆丸开关
  （原生 button + 内联 SVG symbol，不用 r-select，避免 shadow DOM 升级闪烁）。
- **19 个页面**统一五步模式（theme-color 双 meta、无闪烁片段、theme.js、
  contrast CTA、页脚切换器），EN 与 zh-CN 镜像同一提交内同步，用
  `grep -c 'data-theme-choice\|type="contrast"'` 校验计数一致。
  `manifest.json` theme_color → `#ffffff`。
- **编辑器 chrome**（styles/base.css + lib/ui.ts）：FAB/菜单/引导气泡/agent
  面板全部迁到 `--ran-*` token（阴影按角色分层 menu/modal），随主题变色；
  删除 ui.ts 三处内联 hover（改 CSS 类），agent launcher 改单色 contrast 圆钮。

## 验证

- 站点 `pnpm build`、`lint:ts`、`format:check`、240 个单测全绿；ran 仓库
  相关契约测试（button/card/colorpicker/signal，77 个）通过。
- Chrome 实测：亮/暗/system 三档、切换持久化 + 无闪烁、卫星页与 zh 镜像、
  404、移动端 390px、编辑器 FAB 菜单与 agent 面板暗色表现，全部符合预期。

## 踩坑记录

1. **Vite 依赖预打包缓存**：dev server 启动时的 ranui 会被 optimizeDeps
   缓存，拷贝新 dist 后必须重启 dev server 才能看到组件层变化。
2. **Service Worker 缓存**：PWA 的 sw.js 会精缓存旧 CSS，本地验证要先
   unregister + 清 caches，否则页面新旧样式混杂，极具迷惑性。
3. **`.git/info/attributes` 损坏**：ran 仓库该文件被误写入 rtk 输出导致
   `git stash pop` 报 "could not write index"，重写为
   `pnpm-lock.yaml merge=lockfile` 后恢复。
