# PPT "字体乱码" 真因 = Service Worker 缓存旧构建 + SW 自动更新修复

日期：2026-07-05
分支：`fix/sw-freshness`（基于 `release/v0.0.4`）

## 现象

用户在生产站 `https://ranuts.github.io/document/` 新建 PPT，标题占位符显示为乱码
`Ajgai rm_bb rgjc`，**再刷新一次就正常**。用户问："不是已经修过了吗？"

## 排查过程与被推翻的假设

一开始怀疑是 CLAUDE.md 里记录的 CJK split-brain（HarfBuzz 塑形字体 ≠ FreeType 渲染字体）
在生产环境复发，理由是那套真正的修复 `fontRemapMiddleware` 是 **Vite dev-server 专属**，
生产静态部署不跑。并据此打算给 slide 编辑器补 Windows 路径字体 remap。

**用 chrome-devtools 实测后这个方向被推翻：**

1. 乱码串 `Ajgai rm_bb rgjc` 解码 = `Click to add title` 每个字母 glyph-ID **整体偏移 -2**
   （C→A、l→j、i→g…），是 split-brain 特征，但这正是**旧构建**里"PPT 也做字体改写、
   错映射到 glyph 不兼容字体"的行为。当前构建（`924ffb8` 改成仅 Excel 改写）不再这样。

2. 在线上反复冷加载（含 **20x CPU 降速 + Slow 3G** 极限放大竞态窗口）+ 暖加载共三轮，
   **一次都没能复现乱码**，每次都是正常的 serif `Click to add title` / `Click to add subtitle`。

3. 三轮的字体网络请求**完全一致**：`c:\Windows\Fonts\arial.ttf`、`Deng.ttf`、`simsun.ttc`
   等系统字体请求**每次都 `net::ERR_FAILED`**，且**没有任何 `/fonts/*.ttf` 被请求**——
   说明 PPT 默认模板压根不用 `/fonts/` 下的 ttf，而是用 OnlyOffice 内置引擎（`fonts.wasm`）
   渲染。那些失败请求在正常/乱码两种情况下都失败，**不是乱码原因**，remap 它们无意义。

## 真因

用户截图时 DevTools 正开在 **Application → Storage / Unregister service workers**，
结合"再刷一次就好"——真因是 **Service Worker 缓存住了旧构建**：

- `public/sw.js` 对非 HTML 静态资源用 stale-while-revalidate（先给缓存、后台再更新）。
- `bin/build.sh` 每次构建给 SW 注入时间戳 → 新 `CACHE_VERSION` → 新 `CACHE_NAME`，
  `activate` 会清旧缓存。**版本化和清理机制都在**。
- 唯一缺陷是**"一次加载滞后"**：页面已用旧 SW / 旧缓存渲染完，新 SW 才 `skipWaiting` +
  `clients.claim` 接管，但**不会重载已经加载好的页面**。于是用户必须再手刷一次才拿到新构建。
  旧构建恰好含已修复前的 PPT 字体改写 bug → 首屏乱码，刷新后（新构建）正常。

## 修复

`index.ts` 的 SW 注册块新增 `controllerchange` 监听，新 SW 接管时**自动 reload 一次**，
带三道护栏：

```ts
const hadController = !!navigator.serviceWorker.controller;
let reloadingForUpdate = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!hadController || reloadingForUpdate) return; // 1. 仅更新（非首装）；2. 只 reload 一次
  if (getDocmentObj().fileName) return;             // 3. 有文档打开时不 reload，避免丢失编辑
  reloadingForUpdate = true;
  window.location.reload();
});
```

未改 `public/sw.js` 逻辑：新 SW 换 `CACHE_NAME` → SWR 在新（空）缓存里 miss → 从网络取新资源，
所以自动 reload 后即是最新构建，与旧缓存清理时序无关。

## 验证（chrome-devtools 端到端）

在 `vite preview`（dist）上：

| 场景 | 预期 | 实测 |
| --- | --- | --- |
| 首次安装（无旧控制器） | 不 reload | ✅ 载入计数停在 1 |
| 有旧控制器 + 未开文档（模拟新部署，合成 `controllerchange`） | 自动 reload 一次 | ✅ window marker 丢失、sessionStorage 保留 = 同页刷新 |
| 文档已打开时 `controllerchange` | 不 reload | ✅ marker 仍在、编辑器 iframe 完好 |

`pnpm run lint:ts` 通过；`sw-routing.test.ts` 31/31 通过；`pnpm run build` 成功。

## 结论

- **字体本身不用改**：当前构建 PPT 渲染正常，`924ffb8`（仅 Excel 改写）的修复是生效的。
- 用户看到的乱码是 **SW 缓存旧构建**，本次改动让新部署后**首访即自动切到新构建**，
  消除"要再刷一次"的步骤，且不会打断正在编辑的文档。
