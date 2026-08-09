# v9 入口点收敛回本地开发链接，默认打开/新建始终走 v7

日期：2026-08-09
涉及：`index.ts`、`package.json`

## 背景

这次会话前半段密集测试并修复了一批 v9 bug（详见
[2026-08-08 typing-broken 文档](2026-08-08-v9-typing-broken-websocket-action-leak.md)、
[2026-08-09 乱码文档](2026-08-09-v9-latin-text-garbled-notosanssc-substitution.md)），
但 v9 整体还处于"发现一个修一个"的阶段，还没有到可以替代 v7 成为默认版本的
稳定程度。用户提出：默认的"打开文件"/"新建 Word/Excel/PowerPoint"要继续走 v7，
同时想在导航栏加一个能跳到 v9 的入口，方便随时切过去看看进度。

## 现状确认：默认按钮本来就是走 v7 的

`OO_VARIANT`（`lib/onlyoffice-editor.ts:15`）是一个**编译期常量**：
`import.meta.env.MODE === 'v9' ? 'v9' : 'v7'`，只在 `vite --mode v9` 下才会
是 `'v9'`。`index.html`/`index.ts` 是 v7、v9 两个变体共用的同一份源码，
"Open a file"/"New Word" 等按钮的点击处理（`index.ts` 里
`onOpenDocument`/`onCreateNew`）并不感知运行时切换，只会走编译进当前这份
JS 里的那一条分支。也就是说，只要不额外传 `--mode v9`，默认的
`pnpm run dev`、`pnpm run build` 编译出来的按钮就已经是 v7——这次没有改
任何按钮相关的代码，只是确认并记录了这个事实。

## 加的东西：仅本地开发可见的 v9 跳转链接

讨论过几种"给用户一个切到 v9 的入口"的方案（独立子域名/Pages 项目、同域名
`/v9/` 子路径、运行时无缝切换）——结论是这几种都需要真正的部署/架构投入，
在 v9 还不稳定、"先能看一眼进度"这个诉求下都是过度设计。最后选定最小的
一步：**只在本地开发时，主站导航栏多出一条跳到本地 `dev:v9` 服务器的链接**，
不改变任何生产环境的行为。

### 实现

`index.ts` 里加了一段判断（紧跟在 hero CTA 按钮绑定之后）：

```ts
if (import.meta.env.DEV) {
  const nav = document.querySelector('#landing-hero header.bar nav');
  const githubLink = nav?.querySelector('a.gh');
  if (nav && githubLink) {
    const v9Link = document.createElement('a');
    v9Link.className = 'navlink';
    v9Link.href = 'http://localhost:5183/';
    v9Link.target = '_blank';
    v9Link.rel = 'noopener';
    v9Link.textContent = 'v9 (dev)';
    nav.insertBefore(v9Link, githubLink);
  }
}
```

关键点：**用 JS 动态插入，不写进静态 HTML**。`import.meta.env.DEV` 在
`vite build`（生产构建）里恒为 `false`，这段代码在生产包里虽然还在（没有
死代码消除），但条件判断本身保证它永远不会执行、也不会在页面上出现——
`dist-v9/` 构建产物里搜不到 `"v9 (dev)"` 这段文案，确认过。

`package.json` 里把 `dev:v9` 固定了端口：

```json
"dev:v9": "vite --host --force --mode v9 --port 5183"
```

选 5183 是因为这台机器上 `ran` 生态自己的 `vite`/`vitepress` 开发服务器
长期占着 5173、5174（`ranui`、`ranui` 文档站），默认的 `pnpm run dev`
（不带 `--mode`，即 v7）在这台机器上实测会顺延到 5175。5183 是当时确认
过完全空闲、且明显跳出 5173-5180 这个"ran 生态惯用段"的端口号，用来避免
`dev:v9` 每次启动端口漂移，导致上面那条硬编码的跳转链接失效。

## 未做的事（讨论过，明确搁置）

- **独立子域名/Cloudflare Pages 项目**（如 `v9.chaxus.com`）：技术上最干净、
  风险隔离最好的方案，但需要人工在 Cloudflare 后台建新项目、接域名——这一步
  我做不了，等 v9 真要给真实用户预览时再由用户自己操作。
- **同域名 `/v9/` 子路径**：不用建新项目，但 v9 静态资源里有不少假设"部署在
  根路径"的写死路径（`/wasm/`、`/sdkjs/`、Service Worker 注册范围等），
  挪到子路径下大概率要挨个排查修复，工作量和风险都明显更大，跟"v9 还不稳定、
  要控制影响面"的诉求矛盾，判定不值得现在做。
- **运行时无缝切换**（类似 Gmail"试用新版"）：探讨最深入的一个方向，最终
  否掉的原因是 OnlyOffice SDK 会把自己挂在全局命名空间上（`window.Asc`、
  `window.DE`/`SSE`/`PE`），v7、v9 两套 SDK 若在同一个 JS 全局作用域里
  先后加载会互相污染；两边的 iframe patch 脚本还各自 monkey-patch
  `XMLHttpRequest.prototype.open`/`WebSocket` 这类浏览器共享原型，叠加会
  产生不可预测的行为。正确做法是复用现有的"编辑器跑在独立 iframe 里"
  的架构——切换时销毁旧 iframe、创建指向另一变体入口 HTML 的新 iframe，
  从而借助 iframe 的独立 JS 全局作用域天然隔离两套 SDK——但这需要：①
  `public/`、`public-v9/` 两棵资源树同时挂在同一域名下（总部署体积翻倍，
  按需加载但不消除风险）；② 切换时把当前未保存文档从旧 iframe 序列化、
  迁移进新 iframe 重新打开，这条迁移路径本身就是新增的、v9 不稳定时最容易
  出问题的地方。综合下来，在 v9 还不稳定的当下投入这个体验不划算，等 v9
  真正稳定、需要长期与 v7 并存时再重新评估。
- **SEO 风险已单独排除**：无论最终选独立子域名还是子路径，v9 预览入口本身
  的落地页跟 v7 首页文案高度相似，必须加 `robots: noindex, nofollow`（以及
  主站跳转链接本身加 `rel="nofollow"`）避免被搜索引擎当成重复内容分流
  v7 的排名——这个结论已经达成一致，留到真正要上线独立预览通道时一起做。

## 验证

- `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage`
  全绿（296 个单测）。
- `pnpm run dev`（v7，本机顺延到 5175 端口）+ `pnpm run dev:v9`
  （固定 5183 端口）同时起，浏览器打开 v7 页面，确认导航栏
  "No sign-up" 和 "GitHub" 之间多出一条 "v9 (dev)" 链接，`href` 正确指向
  `http://localhost:5183/`。
- 点击首页 "New Word"，抓取生成的 iframe `src`，确认走的是 v7 的
  postMessage/`asc_openDocument` 流程（URL 里没有 v9 Web Mode 特有的
  `type=desktop`/`asc_openDocumentFromBytes` 痕迹），且渲染出的是 v7.5.0
  经典深蓝色工具栏 UI——确认默认按钮确实打开的是 v7，不是 v9。
- `pnpm run build:v9` 重新跑通，`dist-v9/` 产物里确认包含今天新加的
  `blockCoAuthoringDisconnectDispatch` 补丁代码，同时确认 `"v9 (dev)"`
  这段文案不出现在任何 `dist-v9/assets/*.js` 里（生产构建正确剔除了本地
  专用的跳转链接逻辑的执行路径）。
