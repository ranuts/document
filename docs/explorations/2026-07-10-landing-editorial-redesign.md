# 落地页编辑化重设计："页面即一份正在本地编辑的文档"

日期：2026-07-10
分支：feat/seo-landing-hero
涉及文件：`index.html`、`public/home.css`、`public/zh-CN/index.html`

## 动机

原落地页虽然规整，但形态是典型的"模板 SaaS"：全居中 hero、四张等宽卡片、
三个带盒子的编号步骤、手风琴 FAQ——没有任何视觉元素来自产品自己的世界。
这次重设计的目标是"更有设计感"，方法是让设计概念从产品本体长出来。

## 设计概念

**这个页面本身就是一份正在本地编辑的文档。** 产品最有说服力的证据是
"打开网络面板，0 个请求"——把这份证据做成视觉主角：

1. **Hero 改为非对称双栏**（左文案、右视觉），打破全居中模板。右侧是一个
   纯 CSS 搭的"文档窗口"（`.docwin`）：
   - 标题栏：窗口圆点 + `report.docx` / `报告.docx` + 绿色"已保存到本地 ✓"
   - 格式标签页：`.docx`（激活）`.xlsx` `.pptx` `.csv`
   - 纸面：骨架行中夹一行**真实文字**，带蓝色选区和闪烁光标
   - 右缘一条 OnlyOffice 风格的批注气泡："你 · 刚刚 / 0 字节上传——可在网络面板核实"
   - 底部状态条：`● network · 0 requests · 0 bytes out`
2. **h1 的强调方式从"蓝字"改为"编辑器选区高亮"**（`.accent` 改为
   `--ran-blue-300` 底色 + `box-decoration-break: clone`）——文档编辑器
   原生的强调语言，且该 token 在暗色下自动翻转为深蓝，两主题都成立。
3. **章节去模板化**：
   - 所有 section 头部从居中改为左对齐、压在一条 hairline 上
   - 四张卡片改对角 bento（`grid-template-areas: 'a a b' / 'c d d'`），
     宽卡的 h3 放大形成主次
   - 步骤区去掉盒子，改为顶部一条 rail（灰线 + 48px 蓝色进度刻度），
     编号保留（流程确实有序），去掉了编号里与 h3 重复的文字
   - FAQ 改为左标题右列表两栏，去掉每项的盒子只留分隔线
4. **角色分工**：蓝色只花在选区/光标/主按钮；绿色只表示"本地/已保存"；
   Geist Mono 承担所有"机器事实"（文件名、网络读数、eyebrow、状态标签）。

## 实现要点

- **零新增设计值**：全部沿用 `--ran-*` token；选区色直接用 `--ran-blue-300`
  （明 `#dfefff` / 暗 `#002f62`，token 层自动翻转，home.css 不写暗色规则）。
- **docwin 纯 HTML/CSS、无 JS**，静态 `/zh-CN/` 页可原样复用（与 `.btn`/
  `.card`/原生 `<select>` 的降级策略一致），标记 `aria-hidden="true"`。
- 动效仍全部集中在 `prefers-reduced-motion: no-preference` 内：原有
  hero 载入 stagger、chip 脉冲保留，新增光标闪烁（reduced-motion 下光标
  静态显示不消失）；卡片 hover 抬升从 -4px 收敛到 -3px。
- 交互钩子未动：`#hero-open`、`#hero-new`、`r-select.lang-select`、
  `.reveal .d1–.d5` 类名全部保留，`index.ts` 无需改动。
- SEO 不受影响：h1/h2/FAQ 文案与三段 JSON-LD 均未改动，只动了结构与样式。

## 验证

- Chrome 实测四个组合：亮/暗 × 桌面(1440)/移动(390)，hero、bento、
  步骤 rail、两栏 FAQ、页脚均正常；暗色下选区/批注/状态条对比度可读。
- 注意：本地验证时 PWA service worker 会缓存旧 `home.css`，需先
  unregister SW + 清 Cache Storage 再刷新（线上已有 stale-build 自动
  reload 机制，见 2026-07-05-sw-stale-build-auto-reload.md）。
- `pnpm run format:check` 通过；无 TS 改动。

## 后续可选

- 骨架行如日后要更"像文档"，可换成两栏排版暗示或表格线，但需警惕
  骨架屏本身的 AI 模板感。
- 若 ranui 沉淀出"窗口/浏览器框"类组件，docwin 可反哺回 `chaxus/ran`。
