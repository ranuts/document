# embed-demo 对齐 ran 设计体系（2026-08-16）

路线图第 5 项（方向六 1）。用户原话："这个页面好丑，风格跟其他的都不搭"。

## 改了什么

`public/embed-demo.html` 从内联的 Tailwind 风格灰蓝配色（`#2563eb` 按钮、
`#111827` 终端 log）改为与首页/落地页同一套壳：`/ran-fonts/fonts.css` +
`/ran-tokens.css` + `/landing.css`（复用 header.bar / brand / ghmark），
控件全部换成 ranui 组件——`<r-button>`（primary + default）、`<r-input>`
（URL）、`<r-checkbox>`（只读开关）、`<r-card>`（日志）、`<r-theme-switch>`
（顶栏）。所有颜色/间距/圆角/字体都来自 `--ran-*` token，暗色模式随 token
层免费获得（已在 dark 下截图核对）。唯一保留原生的是 `<input type=file>`
——ranui 没有文件控件，用 token 给它和 `::file-selector-button` 做了同款
hairline 样式。

`bin/build.sh` 会按页面 `<script src="/ranui-iife/...">` 引用自动同步 IIFE
包，所以新增的 `input.iife.js` / `checkbox.iife.js` 已从
`node_modules/ranui/dist/iife` 拷进 `public/ranui-iife/`（dev 直接读 public/）。

## 行为契约不变（E2E 依赖）

- `#status` 文本 `loading` → `ready`（50 处 E2E 断言）；只加了 `.ready`
  class 用来点亮状态圆点
- `#fileInput` 仍是原生 file input（`setInputFiles` 依赖）
- 全局 `post(type, payload)`、`window.lastSavedFile`、message 监听逻辑逐字
  保留
- 其它 id（openLocalBtn / openGeneratedBtn / urlInput / openUrlBtn /
  readonlyInput / saveBtn / editorFrame / log）不变

适配点：`<r-checkbox>` 的状态在 `change` 事件 `detail.checked` 里，脚本用
一个 `readonly` 布尔镜像它；`<r-button>` 的禁用走 `setAttribute('disabled')`
而不是 `.disabled=`（save 处理器里也多加一道 `hasAttribute('disabled')`
守卫，因为自定义元素禁用态不阻止程序化 click）。

## 一个布局坑

`<r-button>` 是 closed shadow，host `display:flex`；给 host 设
`width:100%` 只会把 host 撑满、内部按钮仍是自然宽度，视觉上出现"按钮后面
拖着一条空壳"。正确做法是不撑 host，用 `.actions{display:flex;flex-wrap}`
让按钮按自然宽度排——与 ranui 自身文档站的用法一致。

## 验证

- 真浏览器（chrome-devtools）：light/dark 截图；打开示例 xlsx → 只读开关
  两个方向 `document:get-state` 正确 → 保存拿回 9450 B 的 File，B3 读回
  "Sample customer B"
- `E2E_PORT=4176 playwright test embed-api embed-save-default entry-paths`
  → 12 passed
- accept 列表顺手加了 `.pdf`（embed 已支持 PDF）
