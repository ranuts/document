# v9：全新 Excel 文档在零操作下无限循环触发保存（已修复）；PPT 逐项验证通过

日期：2026-08-09
分支：feat/v9-web-mode

## 背景

Word 那边的 Edit Header 崩溃修复完之后，用户要求继续验证 v9 的 Excel 和 PPT。
按同样的方法论（真实浏览器操作 + 盯紧控制台，不满足于"界面看起来没报错"）
分别过了一遍两个编辑器的新建文档、基础编辑、保存流程。

## Excel：全新文档打开后，什么都不做也会陷入无限保存循环（严重级，已修复）

### 复现

`pnpm run dev:v9`，打开 `?new=xlsx`，**全程不做任何操作**，只是等文档加载完、
定期检查控制台。结果几秒内控制台被刷屏：

```
Save document event: [object Object]
Saving v9 binary 3658 bytes as XLSX format
Uncaught (in promise)
Save document event: [object Object]
Saving v9 binary 3658 bytes as XLSX format
Uncaught (in promise)
...(以每秒 5-10 次的速度无限重复，开新标签页反复验证过，稳定复现)
```

两次前后间隔几秒的 `list_console_messages` 对照，msgid 从 26 涨到 156——
确认这不是"加载时打了几条日志"，是一个真正在跑的死循环，且带着一个每次
都失败的未捕获 promise rejection。这是这次 v9 排查以来遇到的最严重问题：
比 Word 那个"要凑特定操作组合才触发"的崩溃更糟——**这个不需要用户做任何事，
新建一个空白 Excel 文档就会摊上**，持续消耗 CPU、持续报错。

### 根因

在浏览器里对 `xxa`（cell 引擎里 `asc_Save` 的内部名）、`DOj`（cell 的离线
保存触发器）等函数做二次包装，打印调用栈，定位到触发点：

```
at api.xxa (我们自己的补丁包装)
at d.Jzg (sdk-all-min.js:50744)   <- 真正的自动保存去抖动检查逻辑
at d.H4i (sdk-all-min.js:41701)   <- 每 40ms 跑一次的定时器回调
at (anonymous) (sdk-all-min.js:41596)
```

顺着往上读到定时器的注册点（`public-v9/sdkjs/cell/sdk-all-min.js:41594`）：

```js
d.prototype.Xke = function () {
  var q = this;
  this.l0 = !0;
  a.IS_NATIVE_EDITOR ||
    setInterval(function () {
      q.H4i();
    }, 40); // 每 40ms 跑一次，除非是"真正的原生桌面编辑器"
  ...
```

`H4i` 内部按条件分流到 `Jzg`（`sdk-all-min.js:50724`）——这是 SDK 自带的、
真实存在的自动保存去抖动逻辑：记录"上次保存时间" `this.vSc`，每次 tick 检查
是否已经过了自动保存间隔，过了就调用 `this.xxa(!0)`，**但不在这次调用里
更新 `vSc`**——它假设真正的 `xxa` 实现会在保存成功后自己去更新这个时间戳
（这是一个正常、合理的设计，问题出在我们这边）。

而这个项目里 `lib/onlyoffice-editor.ts` 的 `runWebModeOnAppReady`（v9 Web Mode
把 `asc_Save`/`asc_DownloadAs` 从"假装是桌面版、其实存服务器不存在"的坏分支
重定向到离线保存触发器的补丁）此前把 `xxa`/`oja`/`iZd` 这几个**内部原始
入口名**也整个覆盖成了我们自己的 `triggerSave`——直接跳过了原始 `xxa`
实现里"保存后更新 `vSc`"这一步。于是：`Jzg` 每 40ms 检查一次"距上次保存
是否已超时"，永远是"超时"（因为 `vSc` 从来没被推进过），于是永远调用
`triggerSave`，触发一次完整的"序列化 + 转换 + 触发下载"流程——每 40ms 一次，
无限循环。

Word/PPT 没有復现同样的问题，大概率是因为各自的等效自动保存类用的是不同
的內部字段名/门控条件（`cell`、`word`、`slide` 是三份独立的 SDK 打包，各自
独立混淆），没有触发同一种"debounce 时间戳只能靠原始实现自己推进"的假设
落空；但既然三个编辑器共用同一段 `runWebModeOnAppReady` 补丁代码，这个坑
理论上不是 Excel 独有的，只是这次只在 Excel 上被触发条件覆盖到。

### 修复

`lib/onlyoffice-editor.ts` 里那段"重定向 asc_Save/asc_DownloadAs"的补丁，
去掉了对 `oja`/`xxa`/`iZd` 这三个内部原始名的覆盖，只保留对公开入口
`asc_Save`/`asc_DownloadAs` 的重定向：

```ts
// 之前：
for (const rawName of ['oja', 'xxa', 'iZd']) {
  if (typeof a[rawName] === 'function') a[rawName] = triggerSave;
}
if (typeof a.asc_Save === 'function') a.asc_Save = triggerSave;
if (typeof a.asc_DownloadAs === 'function') a.asc_DownloadAs = triggerSave;

// 之后：
if (typeof a.asc_Save === 'function') a.asc_Save = triggerSave;
if (typeof a.asc_DownloadAs === 'function') a.asc_DownloadAs = triggerSave;
```

原有代码注释里已经写明"工具栏 Save 按钮和 requestSaveDocument()->downloadAs()
最终都是调用 asc_Save/asc_DownloadAs"——也就是说所有用户可触发的保存路径
本来就只经过这两个公开入口，覆盖底层原始名从一开始就是多余的防御性动作。
去掉之后：

- 用户触发的保存（工具栏 Save 按钮、`downloadAs()`）继续正确工作，不受影响。
- SDK 自己的自动保存定时器调用 `xxa` 时，落到**原始的、未经修改的** `xxa`
  实现——这条路径本来就是本文件其它地方反复提到的"被 AscDesktopEditor
  polyfill 骗过去、走进 Desktop 分支、实际什么都不做"的死路，但在 Web Mode
  下这恰好是可以接受的：Web Mode 本来就没有真正的协同服务器，"定期自动保存
  到服务器"这个功能本身就不适用，让它保持无害地空转比让它被我们的补丁
  意外唤醒成一个真实的、无限重复的下载触发器要安全得多。

### 验证

- 全新 `?new=xlsx` 标签页，完全不操作，等 4 秒以上——控制台干净，`Save
document event` 不再出现（补丁前几秒内就能刷到 100+ 条）。
- 点击工具栏 Save 按钮——只触发一次 `Save document event`，产出正常大小的
  真实字节（3658 bytes），之后不再重复。
- 直接调用 `window.editor.downloadAs('XLSX')`（模拟 `requestSaveDocument`/
  embed API `document:save` 的调用路径）——同样只触发一次，行为正常。
- 顺手做了一次 Word 回归测试（这段补丁代码是三个编辑器共用的）：新建 docx、
  打字、点 Save——同样只触发一次保存事件，`Ff.prototype.$j` 那个补丁的日志
  也正常打出，确认没有连带破坏之前修的 header 崩溃补丁。
- 基础编辑功能验证：输入文字、Tab 跳格、输入数字、输入公式
  `=A3*2`（正确算出 84）、输入 v9.3 新增的 `REGEXEXTRACT` 函数（能正常求值，
  未见崩溃；求值过程中触发了一次公式自动补全把输入内容意外追加了一段
  `+REGEXEXTRACT()`，这是公式签名提示框拦截 Enter 键的常见交互细节，跟
  Excel/Google Sheets 里的同类行为一致，判定为正常 UX 而非 v9 特有 bug）。
- 全程 `asc_getCanUndo()` 保持 `true`，文档始终可编辑，没有出现 Word 那次
  崩溃事故里"文档从此静默不可编辑"的症状。

### 遗留

- 没有反向验证 Word/PPT 的自动保存类是否存在同一种"debounce 时间戳假设
  由原始 xxa/oja/mTi 实现推进"的设计——现在的修复是从源头切断了这个假设
  被打破的可能（不再覆盖任何内部原始名），所以即使 Word/PPT 存在同类隐患，
  这次修复也顺带避免了，但没有专门去确认这个隐患是否真实存在。
- 没有做 xlsx 的完整保存-重新打开字节级往返验证（只验证了保存产出的字节
  数量合理、过程无报错），公式/格式在往返后是否精确保留没有逐项复核。

## PPT：新建文档、多页、切换动画、保存——全部正常，无新问题

新建 `?new=pptx`：

- 首屏截图一开始看起来"空空如也"（可访问性树里连 Home 标签页下的按钮都
  没出现）——但这只是快照抓取时机比视觉渲染快了半拍，重新截图后功能区
  完整、标题/副标题占位符正常，不是真的渲染失败。这也是这次会话反复验证
  过的一个方法论提醒：**光看第一次快照/截图不能下结论，尤其是加载刚完成
  的瞬间**。
- 标题占位符打字（Tab 选中占位符 -> Enter 进入编辑 -> 输入文本）正常。
- 全程监听了 4 秒以上确认**没有**复现 Excel 那种自动保存无限循环——PPT 这边
  目前看是干净的。
- 点击工具栏 Save——只触发一次保存事件，产出正常字节，无残留报错。
- Add Slide -> 选择 "Title and Content" 版式——新增第二页正常，缩略图正确
  显示新内容占位符。
- 切到 Transitions 标签页，应用 "Push" 切换动画——无报错；应用后出现的
  `appOptions.isDisconnected stuck true` / `Toolbar.editMode stuck false` 等
  几条 watchdog 重置日志，是这次会话前几天就已经根因修复、只是把 watchdog
  当兜底保留的"假断连"老问题的残留信号，不是新 bug（详见
  [2026-08-08 typing-broken 文档](2026-08-08-v9-typing-broken-websocket-action-leak.md)）。
- 再次通过 `window.editor.downloadAs('PPTX')` 触发保存——只有一次
  `Save document event`，字节数从 28318 涨到 30478（符合新增一页+切换动画
  后体积变大的预期），过程无异常循环。
- 插入形状（Rectangle）没有验证成功——工具栏点击后形状进入"待放置"状态，
  但需要在画布上拖拽才能真正落下形状，这是这次会话从 Word 阶段就已经确认
  过的**测试工具本身的限制**（合成的 mousedown/mousemove/mouseup 序列不会
  被 SDK 的拖拽意图检测识别），不是产品问题，跳过未继续深挖。

### 对"v9 是否稳定"结论的更新

三大编辑器（Word/Excel/PPT）目前各自新建文档 + 基础编辑 + 保存的主干路径
都已过了一遍真实浏览器验证，各自发现的严重问题都已定位根因并修复：

| 编辑器 | 发现的严重问题                                | 状态                   |
| ------ | --------------------------------------------- | ---------------------- |
| Word   | 特定操作组合下 Edit Header 崩溃并永久锁死文档 | 已修复（同日早些时候） |
| Excel  | 全新文档零操作即无限循环触发保存              | 已修复（本节）         |
| PPT    | 本轮验证未发现新问题                          | -                      |

Excel 这次的问题比 Word 那次更值得警惕的地方在于**触发门槛极低**——不需要
任何特定操作组合，新建文档本身就会中招，属于"每一个 v9 Excel 用户都会
100% 遇到"的级别，而不是 Word 那种需要凑特定操作序列才会踩中的边缘情况。
两次问题合在一起看，共同的教训是：**`runWebModeOnAppReady` 里对 SDK 内部
函数的每一处覆盖，都需要考虑"这个函数还被 SDK 自己的其它内部逻辑依赖着
什么隐含约定"，不能只看"覆盖后用户点按钮还能用"就判定安全**——这次的自动
保存定时器就是一个只有跑够几秒钟、不做任何操作也会自己暴露出来的隐藏依赖。
