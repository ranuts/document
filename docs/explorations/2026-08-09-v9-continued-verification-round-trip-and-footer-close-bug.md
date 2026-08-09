# v9 继续验证：Excel 往返测试、图表；Word "编辑页脚后关闭"会静默锁死文档（已定位根因并修复）

日期：2026-08-09
分支：feat/v9-web-mode
状态：**Word 页脚-Close 锁死 bug 已定位根因、已修复、已验证**；Excel 那次
"公式自动补全吞字"经复测后判定是测试工具本身的问题，不是产品 bug（见下文
"结论更新"一节）。

## 背景

修完 Excel 无限保存循环那个 bug 之后，用户要求继续验证。这一轮补了三块之前
没覆盖到的地方：Excel 的保存-重新打开字节级往返、Excel 图表插入、PPT 的
表格插入和放映模式、以及 Word 里 Edit Header 崩溃修复之后一直没测过的三个
兄弟菜单项（Edit footer、Remove header、Remove footer）。随后用户要求继续
排查并修复发现的问题，这次追加的内容就是那一轮排查和修复的结果。

## Excel：保存-重新打开往返验证——数据完整性没问题

用真实的浏览器保存流程（不是猜测）验证了一轮往返：在页面里挂一个假的
`window.showSaveFilePicker`（返回一个能捕获写入字节的假 `FileSystemWritableFileStream`），
触发 `downloadAs('XLSX')`，拿到真实保存出来的 4798 字节，编码成 base64，
通过 localStorage 传给另一个 embed 模式的标签页，用 `document:open-buffer`
重新打开。

结果：单元格文本（`RoundTrip...`）、数字（`7`）、公式（`=B1*6`，正确算出
`42`）、甚至保存前最后选中的单元格（`A5`）都精确保留。这条路径没问题。

## Excel：图表插入——正常

选中 B1:C1（值 7 和 42），Insert > Recommended Chart，预览图和实际插入的
图表都正确反映了数据。保存/重新打开机制在插入图表后依然只触发一次保存事件，
没有复现前一轮那个无限循环 bug（这也顺带验证了昨天那个修复在更复杂的文档
状态下依然有效）。

## Excel：一开始怀疑的"公式自动补全吞字" bug——复测后判定是测试工具本身的问题，不是产品 bug

### 最初的怀疑

在任意单元格输入一个引用了另一个单元格的普通算术公式（比如 `=B1*6`），用
浏览器自动化工具的 `type_text`（一次性把整段文本当成一次输入事件送进去）
输完后按 Enter，观察到公式后面凭空多出一段 `+BASE()` 或 `+REGEXEXTRACT()`
——一度怀疑是"公式自动补全下拉框劫持了 Enter 键语义"这个真实的产品 bug，
当时记录进了文档。

### 复测：换成逐字符按键，同样的公式完全正常

用户要求继续排查后，回头用 `press_key` 逐个字符敲（`=`、`B`、`1`、`*`、`6`，
每个字符单独一次按键事件，更接近真实用户打字的方式）重新走了一遍完全相同的
场景：

- `=B1*6` 逐字符敲完，公式栏精确显示 `=B1*6`，没有任何自动补全下拉框弹出。
- 按 Enter 提交，正确算出结果（`0`，因为这次 B1 是空单元格），公式没有被
  篡改。
- 另外还单独测了一个更细节的现象：用 `type_text` 一次性输入 `=A1` 之后再
  一次性输入 `*2`，结果整个 `=A1` 部分消失，单元格内容变成孤零零的 `*2`
  ——同样换成逐字符 `press_key` 复测，`=A1*2` 完整正确，没有丢字。

### 结论更新

两次独立现象（"Enter 吞公式"和"输入被截断丢字"）都只在用一次性灌入一整段
文本的 `type_text` 方式复现，换成逐字符按键就完全消失。这跟这次会话前面
（Word 阶段）已经确认过的"CDP 合成键盘输入有时跟不上 SDK 内部状态"是同一类
测试工具局限，不是产品里真实存在的 bug——真实用户打字的速度和事件粒度
（每个按键一次独立的 keydown/keypress/keyup）跟这里的一次性大段文本输入
在浏览器层面走的是不同的事件路径，`type_text` 触发的失败模式不能代表真实
用户会遇到的情况。**这一条目最初判断为"待确认严重程度的新发现"，现在改判
为测试工具限制导致的假阳性，不需要产品侧修复**——保留这段记录是为了给以后
遇到类似"自动化测试里复现、但说不清是不是真 bug"的情况提供一个参照：换成
逐字符输入方式重新验证一遍，是排除测试工具假象的标准做法。

## Word：Edit footer -> 输入内容 -> 点 Close，会静默让文档永久无法编辑（已修复）

### 背景

Edit Header 那个"表格+评论+跨表格全选"才会触发的崩溃已经在同一天早些时候
修复（见
[2026-08-09 header 崩溃修复文档](2026-08-09-v9-header-edit-crash-corrupts-document.md)）。
这次继续验证同一个菜单下另外三个兄弟操作（Edit footer、Remove header、
Remove footer）有没有类似问题时，发现了一个**门槛低得多、而且完全没有任何
报错信号**的新问题。

### 复现（最小复现路径，不需要表格/评论/复杂选区）

1. 新建空白 Word 文档，打字 "hi"。
2. Insert > Header & Footer > **Edit footer**（功能区正确切到 "Header & Footer"
   标签页，页面底部出现可编辑的 Footer 区域——这一步本身完全正常）。
3. 在页脚区域打字，比如 "footer text"。
4. 点功能区右上角的 **Close** 按钮退出页脚编辑模式。
5. 回到正文，尝试编辑（打字、或者全选后打字替换）。

**结果：正文彻底无法编辑**。用了两种独立的验证方式反复确认，排除了"输入
焦点跑丢了"这个常见的测试工具假象（这次会话之前多次踩过的坑）：

- 直接检查 `document.activeElement`，确认焦点确实精确落在编辑器用来捕获
  键盘输入的隐藏 `<textarea id="area_id">` 上（不是丢到了 `<body>` 或者别的
  地方）。
- 点工具栏上的 "Select all" 按钮（而不是用可能没触发到正确元素的模拟按键）
  强制建立一个已知的选区状态（选中原有的 "hi"），确认 `asc_GetSelectedText()`
  返回的选中内容和预期一致，然后在选区上打字——**如果编辑器正常，这应该
  用新打的字替换掉选中的 "hi"**。实际结果是：打完之后再 `Ctrl+A` +
  `asc_GetSelectedText()` 读回来，内容原封不动还是 "hi"，一个字都没变。
- `asc_getCanUndo()` 打完字之后仍然是 `false`。
- 检查了这次会话已知的所有卡死信号——`mainCtrl.appOptions.isEdit`（`true`，
  正常）、`AscCommon.Uc.Tra()`（`false`，代表"没有被阻塞"）、
  `AscCommon.Uc.l5d`（`0`，没有卡在非零）——**全部显示健康**，跟 Edit Header
  那次崩溃事故一样，这又是一种现有 watchdog 完全覆盖不到的新型卡死状态。
- **全程控制台没有任何报错或警告**（跟 Edit Header 那次不同——那次至少有
  一条明确的 `Cannot read properties of undefined (reading 'Oc')` 异常可以
  顺藤摸瓜；这次是彻底沉默的静默失效，连"哪里出错了"的线索都没有）。

### 对照组：同样的操作序列换成 Edit Header，完全正常

用完全相同的步骤（打字 "hi" -> Edit **header**（而不是 footer）-> 在页眉
打字 -> Close -> 回到正文验证）反复测试，**正文编辑完全正常**——用
"Select all" 按钮建立选区后打字，能正确替换选中内容（"hi" 被替换成
"bye"），`asc_getCanUndo()` 返回 `true`。

也就是说：**问题精确锁定在"页脚"（footer）这一侧，"页眉"（header）走的是
同一套 UI（同一个 Header & Footer 标签页、同一个 Close 按钮），却不会触发**。
这排除了"Close 按钮本身有问题"这个最初的猜测——如果 Close 本身坏了，
header 分支也应该受影响，但它没有。

### 隔离出的关键信息

- **不需要**这次会话早些时候 Edit Header 崩溃复现所需要的"表格 + 评论 +
  跨表格全选"这些复杂前置条件——一个全新空白文档、只打了两个字 "hi"，就能
  稳定复现。这比 Edit Header 那个 bug 的触发门槛低得多，理论上意味着**任何
  一个 v9 用户，只要用了一次"编辑页脚"这个功能，都有很高概率踩中**。
- **不需要**点击"Remove footer"——单纯 Edit footer -> 打字 -> Close 这三步
  就足够触发，Remove footer 本身单独测试（在一个从来没进过页脚编辑模式的
  文档上直接点 Remove footer）反而是安全的，不会破坏可编辑性。
- 因为完全没有任何控制台报错，没法用这次会话前面验证 Edit Header 崩溃时
  用的方法（抓异常堆栈、定位到 SDK 源码里的具体行）来找根因——这次连"从
  哪个函数开始追"的线索都没有，需要用不同的排查手段（比如系统性地在
  Close 按钮和页脚相关的 SDK 内部方法上分别打桩计数/记录调用序列，对比
  header 和 footer 两条路径在"点 Close"这一步内部到底调用了哪些不同的
  函数），这个工作量预计和 Edit Header 崩溃那次的根因排查相当，这次没有
  投入去做。

### 根因

先验证了一个关键假设：焦点是不是真的丢到了页脚（一个隐藏起来但仍然存在的
子文档）上，而不是彻底找不到目标——检查 `document.activeElement`，确认
键盘输入的落点始终精确是 `<textarea id="area_id">`（编辑器用来捕获所有
键盘输入的隐藏元素），不是丢到了别处。既然焦点是对的，问题只能出在这个
元素本身的状态上——检查它的原生 DOM 属性，找到了：**`area_id` 这个
textarea 的 `readOnly` 属性被卡在 `true`**，跟 SDK 内部的 `isEdit`/`Tra()`
这些"逻辑上是否允许编辑"的状态完全无关——**是浏览器原生的输入锁，不是
应用层的状态机问题**，这也是为什么之前用 `Tra()`/`l5d` 这些 watchdog 已经
在监控的信号完全查不出异常：那些信号本来就不覆盖这个更底层的锁。

顺着 `sdk-all.js`（word 引擎的未压缩源码）里 `area_id` 的创建点往下读，
找到了完整的调用链：

- `AscCommon.Xr` 是管理这个隐藏 textarea 的单例，`Xr.zL` 就是 `area_id`
  这个元素本身。
- `Xr.tGb(n)` 是唯一真正给 `zL.readOnly` 赋值的地方，但它的实现是
  `this.zL.readOnly = this.qHc ? true : n`——也就是说**只要 `Xr.qHc` 是
  真值，不管外面传 `true` 还是 `false` 进来，最终都会被强制钉死成
  `true`**，之前另外发现的引用计数器 `Xr.Kxe`（用来配对 start/end 的那种
  熟悉的计数器模式）反而是健康的（`0`，配平了），这次泄漏走的是另一条路。
- `Xr.qHc` 本身由 `Xr.Bwg()` 重新计算：`this.qHc = this.zb.Vo`（`Xr.zb`
  现场验证过就是全局的 `window.Asc.editor`，跟这个文件其它地方到处用的
  `editor`/`api` 是同一个对象）。
- `api.Vo` 是一个贯穿整个 `sdk-all.js` 反复出现的通用"暂停重绘"标志位，
  用法几乎全是这种成对的保存-恢复写法：`var g=editor.Vo;editor.Vo=!0;
<画点什么东西>;editor.Vo=g`，散落在几十处跟页眉/页脚编辑毫不相关的内部
  绘制/缩略图生成代码里。

现场验证确认：复现之后 `api.Vo` 确实卡在 `true`，而 `mainCtrl.appOptions.isEdit`
全程都是 `true`（SDK 自己一直以为文档是可编辑的，只是这个原生 DOM 属性在
拖后腿）。真正的根因是**某一处（大概率是页脚特有的、页眉没有的某个重绘/
布局同步路径）调用了 `editor.Vo=!0` 之后，因为某种时序竞争没有执行到配对的
`editor.Vo=g` 那一行去恢复**——但由于这个 `Vo` 标志位在整个文件里被几十处
不相关的代码复用，逐一排查是哪一处具体调用点出的问题，工作量和收益不成
比例（而且现场复测发现这个泄漏本身是**时序竞争、不是每次都触发**——同样的
"Edit footer -> 打字 -> Close"序列，有时候干净、有时候才会卡住，符合"某个
异步操作有时候来得及、有时候来不及"的竞态特征）。

### 修复

沿用这个项目已有的、专门应对"SDK 内部状态泄漏、又不值得逐个调用点去修"这
类问题的方案——`public-v9/onlyoffice-iframe-patch.js` 里已经跑着一个每
2 秒检查一轮的 watchdog（"patch section 4c"，之前已经在监控 `l5d`、
`isDisconnected`、`Toolbar.editMode`、`stackLongActions` 这几个泄漏信号），
这次新增了第七个检查项：

```js
var api4 = window.Asc && window.Asc.editor;
var Xr4 = window.AscCommon && window.AscCommon.Xr;
if (
  mainCtrl4.appOptions.isEdit && // 只在 SDK 自己认为"应该能编辑"时才生效，
  api4.Vo && // 避免误伤真正的只读/预览模式
  Xr4.zL.readOnly
) {
  api4.Vo = false; // 复位真正泄漏的那个标志位
  Xr4.Bwg(); // 让 SDK 自己的重算逻辑去决定 qHc/readOnly 的新值，
  // 不直接强改 qHc/readOnly，保留 Bwg 内部其它分支
  // （Fm/xR/iEa 那部分判断）该生效时依然生效
}
```

关键设计取舍：不是直接把 `qHc`/`readOnly` 强制改成 `false`（那样会绕过
`Bwg()` 内部为其它场景准备的判断逻辑），而是只复位真正泄漏的 `api.Vo`
标志位，然后调用 SDK 自己的 `Bwg()` 重新计算——这样即使以后发现某个这次
调查没覆盖到的场景也需要 `qHc` 是 `true`，这个 watchdog 也不会跟 SDK 自己
的逻辑打架。同时用 `mainCtrl.appOptions.isEdit` 做门禁，确保用户主动开启的
只读/预览模式（`?readonly=1`、`setReadonlyMode(true)`）不会被这个 watchdog
误当成"泄漏"清掉。

### 验证

- 由于这个泄漏本身是时序竞争、不是每次都稳定复现，改用更直接的方式验证
  watchdog 本身的逻辑：现场手动模拟出跟真实 bug完全一样的状态
  （`api.Vo=true` 后调用一次 `Xr.Bwg()`，确认 `qHc`/`zL.readOnly` 都变成
  `true`，跟复现时观察到的现场状态完全一致），然后**什么都不做**，只是
  等 3 秒——watchdog 在下一个 2 秒的检查周期里自动把 `api.Vo`/`qHc`/
  `readOnly` 全部复位回 `false`，控制台正确打出了新增的警告日志
  `[OO] input-capture textarea stuck read-only (api.Vo leaked) --
resetting (patch section 4c watchdog)`。
- 光复位标志位还不够，得确认真的能打字：`focus()` 到 `area_id`、
  `Ctrl+A` 全选、打字 "recovered"，`asc_getCanUndo()` 返回 `true`，
  再 `Ctrl+A` + `asc_GetSelectedText()` 读回来正确显示 `"recovered\r\n"`
  ——确认不只是标志位复位了，文档真的恢复到可以正常编辑的状态。
- 顺手也确认过：用同样的手法直接调用 `api.Vo=false; Xr.Bwg();`（watchdog
  即将做的同一件事）能够立刻、手动地把一次已经真实触发（不是模拟）的卡死
  状态恢复过来——这是在设计 watchdog 之前，用来确认"这个修复思路本身是
  对的"的现场验证，watchdog 只是把这个已验证有效的手动修复自动化、定期化。
- `pnpm run build:v9` 重新构建，确认新的 watchdog 代码出现在
  `dist-v9/onlyoffice-iframe-patch.js` 里。

### 遗留

- 没有找到"到底是哪一处 `editor.Vo=!0` 之后忘了配对恢复"的具体调用点——
  这次的修复策略跟这个项目里其它几个 watchdog 一致：治标（复位泄漏的
  标志位）不治本（不去改 SDK 内部具体是哪行代码漏了），如果以后 OnlyOffice
  升级换了内部实现，这个 watchdog 的检测条件需要重新核对是否还适用。
- 这次只验证了"页脚"这一侧会泄漏 `api.Vo`，头部对照测试显示不会——但没有
  进一步确认是不是也存在"泄漏了 `api.Vo` 但泄漏点不同、触发条件不同"的
  其它路径（比如 Excel/PPT 是否有类似的、这次会话没测到的泄漏面）；不过
  这次的修复是通用的（检查 `api.Vo`/`Xr.qHc` 本身，不针对"页脚"这个具体
  触发点），所以即使以后发现别的触发路径，这个 watchdog 大概率也能兜住。
