# 修复刷新时组件边框闪烁：ranui part 名错误 + 兜底样式与真身不一致

日期：2026-07-11
分支：feat/seo-landing-hero
涉及：`public/home.css`、`public/landing.css`、`styles/base.css`

## 现象

刷新页面时，hero 两个按钮和语言选择器会有"边框一闪而过"。

## 根因（两层）

1. **`::part(ran-btn)` 是错误的 part 名，从未生效。** ranui r-button 实际
   导出的 part 是 `button`（容器：圆角/背景）和 `content`（内边距/边框/
   字体，即 `.ran-btn-content`）。home.css / landing.css / styles/base.css
   里所有 `::part(ran-btn)` / `::part(ran-btn-content)` 规则全部落空，
   按钮一直按 ranui 默认尺寸渲染（padding 4px 15px，line-height 22px，
   radius 6px，高 32px）。
2. **`:not(:defined)` 兜底与升级后真身不一致。** 兜底画的是 48px 高、
   `border-hover` 边框的大按钮；组件注册后换成 32px 小按钮 → 升级瞬间
   尺寸/边框跳变，就是用户看到的闪烁。r-card 兜底同样不匹配（写了
   radius-lg + 白底，真身是 radius-md + `--ran-color-bg-muted` 灰底 +
   自带 16px 内边距）。

## 修复

- 三个 CSS 文件的 part 选择器全部改为 `::part(button)` / `::part(content)`
  （尺寸类属性放 `content`，圆角两个都设）。hero CTA 现在真正按设计尺寸
  渲染（padding 12px 24px，高 48px）。
- 兜底样式与升级后逐像素对齐，关键项：
  - r-button：`line-height: 22px`（`.ran-btn-content` 默认值，之前写
    `line-height: 1` 导致高度差 6px）、边框 `--ran-color-border`（默认型）
    / `--accent`（primary）、背景 `--ran-color-bg-elevated`
  - r-card：`--ran-radius-md` + `--ran-color-bg-muted` + `padding: 16px`
    （补偿 `.ran-card` 自带内边距，保证内容位置不动）
- 验证方法：无 JS 的 iframe（只挂 CSS）量兜底几何 vs 升级后页面实量，
  两态 getBoundingClientRect 完全一致（首页按钮 129/161×48、卫星页 CTA
  183×48、oss 卡 608×116、zh 卡片 688×189 + 内容缩进 17px）。
  仅剩差异：默认型按钮里 svg 与文字的间距 ±4px（插槽内联间距 vs gap，
  不可感知）；r-select 升级前 `visibility: hidden` 的轻微 pop-in（type=text
  无边框，无闪烁问题）。

## ranui part 名速查（源自 dist 源码，closed shadow 无法运行时检查）

| 组件     | 导出的 part                                                         |
| -------- | ------------------------------------------------------------------- |
| r-button | `button`（容器）、`content`（内边距/边框/字体）                     |
| r-card   | `card`、`header`、`title`、`description`、`extra`、`body`、`footer` |
| r-select | 无（只能样式化 host；内部无法穿透）                                 |

## 约定（重要）

- **改组件 part 样式时，必须同步改对应的 `:not(:defined)` 兜底**，两者
  逐像素一致（padding、line-height、border 色、radius、背景），否则
  custom element upgrade 会闪。
- r-select 不导出 part 是生态缺口，候选反哺 `chaxus/ran`：给 select 补
  `part` 导出后即可穿透定制。
