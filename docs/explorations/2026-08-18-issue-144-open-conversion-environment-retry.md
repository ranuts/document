# issue #144：Chrome 打开本地文件报 -82，Edge 正常 —— 环境类打开失败自动重试

日期：2026-08-18
相关 issue：[#144](https://github.com/ranuts/document/issues/144)（chrome中打开文件出错）

## 一、现象与用户给的关键约束

- 两台 Win11，Chrome 135 / Chrome 150 打开本地 `.docx`（截图里是一个中文名文件）
  弹厂商"打开文件时发生错误"对话框 + 我们的 toast `code -82`；
- 同两台机器上 Edge 151 打开**同一批文件正常**；
- 用户补充：**新建文档两个浏览器都正常，只有"打开本地文件"出错**。

## 二、打开链路里 -82 到底从哪来

v9 的打开是厂商内部完成的：`createPersonalEditorInstance` 把字节做成 blob URL
交给 `document.url`，编辑器 Offline 控制器执行

```js
// web-apps/apps/documenteditor/main/app.js（Offline 控制器）
e.doc.url ? (i = await AscCommon.x2t.convertToBin(t, e.doc.title, e.doc.fileType)) : (i = { binary: 'DOCY;v5;...' }); // ← 新建走这条，根本不过 x2t
```

两点直接对上用户的观察：

1. **新建文档不经过 `convertToBin`**（用内置空 DOCY），所以"新建正常、打开出错"
   不是文件的问题，而是**打开转换链路**的问题；
2. `convertToBin` 的任何抛错都被 `x2t_helper.js` 重新包成
   `Document conversion failed: ...`，落到 frame 的 unhandledrejection 上，由
   `installOpenFailureGuard` 转成 `asc_onError(-82)` → 厂商对话框 + 我们的 toast。
   **-82 因此是个笼统的出口**：文档真坏、x2t 缺导入器、以及编辑器自身还没初始化好，
   三类完全不同的原因都长成同一张截图。

## 三、为什么"同一份文件、同一台机器，Chrome 挂 Edge 好"

`_convertDocument` 在写入源文件之前 `await self.fetchFonts()`，而厂商的
`AscCommon.fetchFonts` 没有任何就绪判断：

```js
window.AscFonts.g_font_infos.forEach(function (w) {
  ...
  var U = AscCommon.g_font_loader.fontFilesPath;
  A = AscCommon.g_font_loader.fontFiles[A];   // ← A 可能是 undefined
  u.push(p(U + A.Id) ...)                     // ← 于是 .Id 抛 TypeError
});
```

字体系统（`AscFonts.g_font_infos`、`g_font_loader.fontFiles`）与文档打开是**并行**
初始化的，谁先到手取决于缓存冷热、网络与 CPU。线上实测（`edit.chaxus.com`，
无痕 profile）能看到这段窗口：

| t(ms) | g_font_infos | fontFiles | x2t 就绪 |
| ----- | ------------ | --------- | -------- |
| 2884  | undefined    | 无 loader | false    |
| 3174  | 193          | 268       | false    |
| 4153  | 193          | 268       | **true** |

冷 profile 下 x2t 要先下载并解压 ~10 MB 的 `x2t.wasm.gz`，字体系统稳赢；
**缓存全热的浏览器**里 x2t 从 Cache API 秒开，转换可能跑在字体系统前面，
于是 `fetchFonts` 抛 TypeError → `Document conversion failed` → -82。
这正好解释"天天开着的 Chrome 挂、刚装的 Edge 好"，且与 Chrome 版本无关
（135 和 150 都挂）。

仓库里本来就有一半的防护（`prepareEditorIframe` 守卫 3），但它只判断
`AscFonts.g_font_infos` 是不是数组，**没管厂商真正解引用的
`g_font_loader.fontFiles[i].Id`**，所以只堵住了两个坑里的一个。

复现验证：真实语料（POI 的 `saut_page.docx` 等）改成中文名 `22 小爱同学.docx`
打线上，冷 profile 三份全部 15～24 s 打开成功——**文件名与文件本身都被排除**
（与语料战役第 2 天推翻"中文名 P0"的结论一致）。用户那侧的触发条件是浏览器
状态，不是文档。

## 四、修复

1. **`isFontSystemReady()`**（新，导出可测）：`g_font_infos` 是数组、且非空时
   `g_font_loader.fontFiles` 必须也是非空数组，否则 `fetchFonts` 一律回
   `cb([])`。导入不需要字体，宁可无字体导入，也不能让打开失败。
2. **`classifyOpenFailure()`**（新，导出可测）：把打开失败分成两类——
   - `document`：`Conversion failed with code: N`、emscripten `Aborted(...)`、
     `missing function`、`RuntimeError` → x2t 真的看过这些字节并拒绝，重试无意义；
   - `environment`：`Cannot read properties of undefined`、`X2T module`、
     `Failed to fetch` 等 → 编辑器自身没就绪／资源没到，文档大概率没问题。
3. **环境类失败自动重试一次**：`retryCurrentOpen()` 用同一份字节重建编辑器
   （连带重来的还有字体系统、x2t 模块、图片管线），期间给用户一条 info toast；
   只重试一次，第二次仍失败才按原路弹 -82。重试用 `openGeneration` 代际号
   标记每次构建，旧 frame 迟到的重复 rejection 不会算到新文档头上。
4. **-82 toast 带上真实原因**：以前用户只能截到 `code -82`，现在附
   `[Document conversion failed: ...]`（截断 160 字），下一份 issue 就能直接看出
   是文档问题还是环境问题。

## 四·补：从"跳过字体"改成"等字体"（同日追加）

第一版守卫在字体系统没就绪时直接 `cb([])`（无字体导入）——那只是让崩溃变成
降级，竞态本身还在。追加版把它改成**有序依赖**：`awaitFontSystem()` 把回调
压住，等字体系统就绪再交给厂商实现，只有等待超预算（5 s）才退回无字体导入。
浏览器里没法把字体目录变成同步加载，但让转换 await 它，等价于消除竞态。

两个必须算清楚的账：

- **代价**：就绪时立即放行，一分不花（单测断言此路径不排任何定时器）。
  实测本地热缓存的一次正常打开等了 **200 ms**（4 个 50 ms 轮询）——这恰好
  反向印证了根因：热缓存下转换确实跑在字体前面。冷 profile 则等 0（字体
  ~3.2 s 就绪，x2t ~4.2 s 才就绪）。E2E 把这个值钉在 2 s 以内，一旦某个环境
  下字体系统性地输掉竞速、每次打开凭空多等几秒，用例先红。
- **字体加载失败**：单个字体文件失败由厂商自己 `.catch` 吞掉，与我们无关；
  整个字体目录都没到，则等满 5 s 后退回无字体导入——也就是第一版的行为，
  不新增任何挂起路径。

**自查 review 补的一处**：等待期间编辑器 frame 可能已被销毁（用户开了别的文档、
或打开失败触发了重开），此时把回调交回死掉的 realm 会抛错，而且是**在定时器里抛**
——等于宿主页面的未捕获错误。已加 try/catch 并补单测（原函数与回调都抛"dead realm"，
断言不外抛且定时器已清）。

**自查 review 补的第二处（更要命）**：上面那个 try/catch 一并把
`original.call(...)`（厂商 `fetchFonts`）也包了进去，而厂商这个函数**会同步抛**
——它在 `AscFonts.g_font_infos.forEach` 里直接取 `g_font_loader.fontFiles[index].Id`，
只要索引落空就是 TypeError。调用方 `x2t_helper.js` 的
`fetchFonts` 是 `new Promise((resolve, reject) => AscCommon.fetchFonts(cb))`，
**只有回调被调用才 resolve**。于是：

- 同步路径（字体已就绪那一支）抛出是好事：它发生在调用方的 executor 里，
  会 reject 整个打开 → -82 → `installOpenFailureGuard` 重试。故意不包。
- 定时器路径抛出被吞掉后，没有任何人 settle 那个 Promise，转换永远 await
  一个不会来的回调 —— 正是 `installOpenFailureGuard` 当初要消灭的**永久转圈**，
  而且连 -82 都不会报。

改法：catch 里在 `ready` 分支补一次 `cb([])`（自身再包一层 try），把它降级成
和"等超时"完全一样的无字体导入；同时把 `isFontSystemReady(win)` 与 `record()`
也移进 try——前者裸抛还会漏掉 `clearInterval`，留下永不停止的 interval。

反向验证：去掉这次的 `cb([])` 兜底，新用例 `answers a throwing vendor
fetchFonts with a fontless import, never with silence` 立刻变红
（`expected "vi.fn()" to be called 1 times, but got 0 times`——回调零次，即挂起）；
去掉 `isFontSystemReady` 外的 try，`stops polling when reading the frame itself
starts throwing` 变红（`Cannot access a dead realm` 从定时器里裸抛出来）。

## 五、用例（用例固化制度）

- `test/unit/onlyoffice-editor.test.ts`：`isFontSystemReady` 三态、
  `classifyOpenFailure` 两类，外加 `awaitFontSystem` 八条（就绪即放行且不排
  定时器、迟到就绪后放行并记录等待毫秒、超时退回 `cb([])` 且不留定时器、
  frame 消失时不外抛、**厂商同步抛错时仍把 `cb([])` 交出去且只交一次**、
  正常交接时兜底不插手、读 frame 抛错时停止轮询、默认预算上限）。
- `test/e2e/open-retry.spec.ts`（新）：在真实编辑器里把**本次会话的第一次**
  `AscCommon.x2t.convertToBin` 换成抛
  `Document conversion failed: TypeError: Cannot read properties of undefined (reading 'Id')`
  （与真实竞态同形），断言：故障确实触发过、文档最终加载完成、没有厂商错误框、
  没有 -82、重建后的编辑器还能正常保存。
- `test/e2e/open-failure.spec.ts`（原有）反向钉住：垃圾字节 `.xlsx` 是
  `document` 类失败，**不重试**、立刻报错、保存快速拒绝。
- `open-retry.spec.ts` 第二条：正常打开时真实记录的字体等待必须 < 2 s。

## 六、遗留

- 真正的时序竞态无法在 CI 里稳定复现，本轮用故障注入固化行为；若线上仍有
  用户报 -82，toast 里的原因文本会直接给出下一步方向。
- 同批新 issue [#145](https://github.com/ranuts/document/issues/145)（安卓 Chrome
  幻灯片初始缩放 31%、反复改缩放后报错）另案：现有 E2E 只跑桌面 Chromium，
  缺移动端（触摸 + devicePixelRatio + 缩放）覆盖，需要先补一条移动模拟用例。

## 七、打开成功后释放重试用的字节（二次 review）

`currentOpenAttempt` 为了"环境类失败重开一次"保留了整份 `binData`，但它**只在
下次打开时被覆盖，打开成功后从不释放**——编辑器自己持有一份文档、挂载用的 blob
是第二份，这里就成了第三份，整个会话常驻。#145 的现场恰恰是移动端内存压力导致
canvas 被丢弃，留这份压舱物是反着来的。

`onDocumentReady` 里加 `releaseOpenAttemptBytes()`。安全性来自
`installOpenFailureGuard` 自己的 `documentContentReady` 分支：文档一旦加载完成，
之后任何转换失败都被当作"导出失败"处理，不会再走到 `retryCurrentOpen`，所以释放
之后没有人还会来要这份字节。重试预算（`retried`）仍然保留。

反向验证：去掉 `releaseOpenAttemptBytes()` 调用，用例
`releases the retry bytes once the document is open` 变红（`expected true to be false`）。
