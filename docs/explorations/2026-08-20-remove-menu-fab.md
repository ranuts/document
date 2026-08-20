# 移除编辑器右下角的 Menu 悬浮按钮

2026-08-20

## 起因

用户截图指出编辑器右下角那个 "Menu" 悬浮按钮（压在垂直滚动条上、紧挨底部缩放条），
要求去掉。

## 删之前先查它挂着什么

`lib/ui.ts` 的 FAB 里有 6 项：上传文档、新建 Word / Excel / PPT、AI 助手、主题切换。
逐项确认在**文档已打开**的状态下还有没有别的入口：

| 菜单项              | 别的入口                                    |
| ------------------- | ------------------------------------------- |
| 上传文档            | 无（编辑器 `help:false`、无拖拽、无快捷键） |
| 新建 Word/Excel/PPT | 无（同上）                                  |
| AI 助手             | 有——`?agent=1`                              |
| 主题切换            | 无（落地 hero 一打开文档就隐藏）            |

代码注释里本来就写着主题那一行的存在理由："the hero is hidden once a document is
open ... without this row there is no way to flip it while editing"。

所以这不是纯装饰，删掉是有代价的。把这四项的取舍摆给用户确认后，选了「整个删掉」：
打开/新建从首页（或 `/editor?new=docx`、`?file=`）走，主题在首页页脚切。

## 删除范围

| 文件                             | 内容                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `lib/ui.ts`                      | `buildFab` / `getFab` / `createFixedActionButton` / `showMenuGuide` 及引导气泡状态；391 → 124 行 |
| `lib/document.ts`                | `showMenuGuideFn` 与三处 1s 延时调用、`setUICallbacks` 的对应入参                                |
| `lib/events.ts`                  | 同上（RENDER_OFFICE 路径）                                                                       |
| `index.ts`                       | 两处 callback 装配、`createFixedActionButton()`、`import 'ranui/theme-switch'`                   |
| `styles/base.css`                | `.fab-*` / `.menu-guide*` / `guideFadeIn                                                         | Out`；499 → 311 行 |
| `packages/shared/src/i18n.ts`    | `menu` / `menuGuide` 词条（接口 + 8 个语言，共 18 处）                                           |
| `test/unit/i18n-locales.test.ts` | CORE_KEYS、`pt` 的 same-as-english 例外、德语回退用例换用 `uploadDocument`                       |
| `test/e2e/app-smoke.spec.ts`     | 两处 `#fab-container` 断言                                                                       |

`import 'ranui/theme-switch'` 一并删掉：全仓只有 FAB 那一行用它，落地页的
`<r-theme-switch>` 是静态 HTML 自带 `label="Theme"`，不经过 i18n。

## 顺手保住的一件事：prefetch

FAB 的每个"新建/打开"行都挂着 `pointerenter → prefetchEditorAssets`（悬停即开始拉
引擎）。删掉 FAB 会连这个也一起丢，而且 `lib/prefetch.ts` 会变成整仓无人 import 的
死模块（它导出的 `prefetchOnIntent` 此前根本没被用过）。

所以把控制面板那四个按钮接上 `prefetchOnIntent`——这正是那个 helper 存在的理由。
行为不丢，模块不死。

## 没删的：theme\* 词条

`themeLabel` / `themeSystem` / `themeLight` / `themeDark` 现在在本仓也没人用了，但
`packages/shared` 是 ran 生态三处站点共享的包，这几个是通用的开关标签，别的站点可能
在用——跨仓的删除不该我单方面做。`menu` / `menuGuide` 则删了：它们的文案
（"菜单在右下角，悬停即可查看"）只描述这个已经不存在的 FAB，留着会误导翻译。

## 用例

`app-smoke.spec.ts` 反过来钉住这个决定：`/editor` 上 `#fab-container` 与 `#menu-guide`
必须 `toHaveCount(0)`。落地页那条原本用 `#fab-container` 证明"`/` 不加载编辑器 bundle"，
改用 `#control-panel-container`（同样只由 bundle 构建）。

本地跑 `app-smoke` / `main-site` / `entry-paths` 三个 spec 验证控制面板路径没被带坏；
单测全绿，`tsc --noEmit`、oxlint、prettier、生产构建均通过。

## 踩到的坑：本地 tsc 读的是 workspace 包的旧构建产物

删完 i18n 词条后本地 `pnpm run lint:ts` 是绿的，CI 上 `Lint and Validate` 却红在
`tsc --noEmit`：

```
test/unit/i18n.test.ts(143,16): error TS2345:
  Argument of type '"menu"' is not assignable to parameter of type 'keyof I18nMessages'
```

原因是 `@ranuts/shared` 的 `exports` 指向 **`dist/`**（`./i18n` → `dist/i18n.d.ts`），
不是 `src/`。本地那份 `packages/shared/dist/` 是改动之前构建的，`I18nMessages` 里还留着
`menu`，所以 tsc 看不出问题；CI 的 `pnpm install --frozen-lockfile` 会触发包的 `prepare`
（`tsc -p`）重建 dist，类型这才真正更新，漏改的那处引用当场报错。

**改了 `packages/*/src` 之后，本地校验前先 `pnpm -C packages/<name> run build`**（或
`pnpm -r run prepare`），否则 tsc 校验的是上一个版本的类型。这是典型的"本地绿、CI 红"
不对称，和仓库里记过的 vite preview / 线上那几条同类。
