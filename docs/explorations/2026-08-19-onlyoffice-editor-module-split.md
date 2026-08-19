# 把 1975 行的 onlyoffice-editor.ts 拆成一个门面 + 一层模块

日期：2026-08-19

## 一、为什么要拆

`lib/onlyoffice-editor.ts` 长到 1975 行，里面塞着七类彼此无关的东西：编辑器挂载、
保存通道、打开失败处理、字体系统竞态、9 条厂商运行时补丁、移动端布局、只读开关。
最直接的代价是 `prepareEditorIframe` 一个函数就有 **584 行**——9 条补丁挤在同一个
`for (frame)` 循环里，每条都自带一套 `win as unknown as {...}` 断言和一个 `__oo*`
标志位，改任何一条都要在这团里翻页找边界，而且函数末尾那句"全部就位"判定读的是 5
个散落在各处的局部变量。

## 二、拆法

**一个门面 + 一层各司其职的模块**，公开导出面（`lib/embed-api`、`lib/web-mcp`、
`lib/converter` 与全部单测所依赖的符号）**一个都没变**：门面用 `export ... from`
把它们原样转出去，所以这次拆分对调用方和测试是零改动。

```
lib/onlyoffice-editor.ts   387 行  挂载 / 重建 / loadEditorApi + 公开导出面
lib/onlyoffice/
  iframe-guards.ts          64 行  9 条守卫的编排（谁装了、装没装全）
  guards/*.ts           19~121 行  一条守卫一个文件，缺陷背景写在文件头
  open-state.ts            120 行  就绪 / 打开失败 / frame 首个错误
  open-failure.ts          218 行  失败分类、-82 guard、环境类失败重开一次
  font-system.ts           133 行  字体系统就绪判定 + awaitFontSystem
  save-stream.ts           327 行  保存请求生命周期 + 导出触发 + file-stream 回收
  viewport.ts              201 行  紧凑视口判定与布局同步
  sdk-api.ts                77 行  同源 iframe 里的 Asc.editor 访问
  readonly.ts               46 行  运行时只读
  ui-theme.ts               26 行  默认主题 / 站点主题跟随
  file-helpers.ts           30 行  文件名 / MIME / 字节形状
```

拆的时候只守两条规矩：

1. **跨模块状态只有一个持有者**。`documentContentReady` / `documentOpenError` /
   `lastFrameError` 过去是三个模块级变量，被守卫、保存路径、错误 toast 三处直接
   读写；现在全部归 `open-state.ts`，其它模块一律调 `isDocumentContentReady()` /
   `getDocumentOpenError()` / `getLastFrameError()`。只读状态归 `readonly.ts`，
   在途保存请求归 `save-stream.ts`（守卫要让它失败就调
   `failPendingSaveConversion`，不再自己伸手进别人的变量）。复制一份状态是这种拆分
   唯一会真正制造 bug 的做法。
2. **不许出现环**。`open-failure` 的"环境类失败重开一次"要调 `createEditorInstance`，
   而后者在门面里——沿用仓库既有的回调注入约定（`setConverterCallbacks` /
   `setUICallbacks`），门面在末尾 `setOpenRunner(createEditorInstance)`，
   `open-failure` 只认一个 `OpenRunner` 类型。

守卫的返回值也统一了：每个 `install*Guard(win)` 返回"这条守卫现在是否在位"（无论
是本次装上还是早就装过），`iframe-guards` 用其中 5 个必须就位的返回值合成原来的
`fullyApplied`——与旧代码逐位等价，只是判定从"读 5 个局部变量"变成"读 5 个返回值"。

## 三、怎么保证行为没变

- **逐行核对**：脚本把旧文件的每一行（去掉纯注释/括号）拿到新目录里全文匹配，
  剩下 39 行差异逐条人工确认，全部是刻意改动：加 `export`、把直接读模块变量改成
  调访问器、`createEditorInstance(` → 注入的 `runOpen(`、以及移动过的 import。
  没有一行逻辑被顺手"改进"——这次提交只搬家，不改行为。
- `tsc --noEmit` + oxlint 全绿；单测 32 文件 617 例全绿（测试文件一行没动，
  因为公开导出面没变）。
- 本地 E2E 全套（真实编辑器 + 真实 x2t）**82 passed / 16 skipped / 0 failed**
  ——守卫全在这一层被真正执行到，它是这次拆分唯一有意义的验收：单测覆盖不到
  `guards/**` 的任何一行。（第一遍跑时 `open-retry` 的字体等待预算断言红过一次，
  2350 ms vs 2000 ms；单跑 2.6 s 通过，机器当时还在跑 docker 套件——是并发下的
  时序抖动，不是拆分引入的。空载重跑全绿。）

## 四、以后往哪加

- 新的厂商运行时补丁 = `onlyoffice/guards/` 新建一个文件 + 在 `iframe-guards.ts`
  挂上，别再往门面里塞；
- 需要读"文档是否就绪 / 为什么打不开"就调 `open-state` 的访问器；
- 门面只该有三件事：挂载、重建、加载 API。
