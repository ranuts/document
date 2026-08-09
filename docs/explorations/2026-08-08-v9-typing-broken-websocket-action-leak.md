# v9：新建文档完全无法输入文字（打字没反应），根因是假 WebSocket 连接泄漏了一个"忙碌计数器"

> **现状（本文档写作完成时）**：本文档记录的四个问题全部已修复并验证通过——
> ① 打字完全无反应（假 WebSocket 连接泄漏忙碌计数器）；② 同一个忙碌计数器
> 还有其它未定位的泄漏源，加了看门狗兜底；③ 状态栏"数据加载中"卡死不消失
> （同一个看门狗顺带扩展修复，另一种表现形式的同类问题）；④ 段落样式库缩略图
> CJK 文字不显示（SDK 内部字形渲染器丢字，改用浏览器原生 API 自己画一层盖
> 上去，含一次因字号写死导致偏小、一次因预览格式和字挤在一起的追加修正）。
> 四个都已用真实工具栏交互（不是直接调 API）验证过，全部单测/lint/format 绿。
> 另外排查过项目符号库、编号库、艺术字库，均确认无同类问题（内容本来就不含
> 中文字符）。
>
> **2026-08-09 补充**：后续又发现一个更严重的、性质完全不同的问题——新建
> 文档默认字体（Times New Roman）下打字，画面显示的字符是错的（不是丢字，
> 是系统性地显示成别的字符），根因是 `font-map.json` 把 Times New Roman
> 等西文字体错误指向了中文字体 NotoSansSC。已定位、已修复，详见
> [2026-08-09：默认字体打字全乱码](2026-08-09-v9-latin-text-garbled-notosanssc-substitution.md)。
>
> **2026-08-09 再补充**：继续排查表格插入等功能时，发现看门狗第三次扩展
> （`isDisconnected` 复位）只解决了症状的一半——同一次假断连触发的
> `Asc.c_oAscAsyncAction.Disconnect`（id 20）长动作，其对应的 `onLongActionEnd`
> 从未被调用，导致 Save/Comments/Track changes/语言菜单等一大片工具栏按钮
> 静默永久失效（现象比 isDisconnected 那次更严重、覆盖面更大）。看门狗第四次
> 扩展修复了单次触发的情况，但同一操作连续触发两次后发现 Toolbar/LeftMenu/
> Statusbar 还各自独立锁了一部分按钮，第四次扩展覆盖不到——看门狗第五次扩展
> 已修复并用连续两次真实表格插入验证通过。**之后又找到了这一整类问题的真正
> 根因**：约十个互相独立的控制器都直接监听同一个 SDK 内部事件
> `asc_onCoAuthoringDisconnect`，而这十个监听器最终都是通过 SDK 内部唯一的
> 事件分发函数 `api.bc(...)` 调用的——直接在这一个出口把这个事件（以及带
> `Disconnect` id 的长动作）拦下来，就能让十个控制器谁都收不到、从源头上
> 完全不会锁，不再需要等看门狗每次反应式解锁。已实现并用连续两次真实表格
> 插入验证通过（全程零锁定，看门狗一次都没触发）。详见下方"看门狗第四次
> 扩展""看门狗第五次扩展"和"真正的根因修复"三节。

## 背景

用户在本地测试环境（跟当时正在验证 [issue #72 v9 修复](2026-08-08-issue-72-pasted-image-blank-on-save.md)
的是同一个浏览器标签页）反馈截图：新建 Word 文档后光标能看到、能点，但打字完全
没反应，工具栏右上角还有一块区域是空白的。

这是一个此前从未被发现过的、**比 #72 图片问题严重得多的 bug**——之前"三个
上线阻塞项都已清零"的结论（见
[2026-08-06 go-live 审计](2026-08-06-v9-go-live-readiness-audit.md)）里验证过的
"可编辑"，回头看很可能是用 `asc_getCanUndo()`/API 直调验证的，从没有真正用
键盘敲过字——这次是第一次用真实键盘事件（chrome-devtools MCP 的
`type_text`/`press_key`，不是直接调 API）测试 v9 的打字功能，一测就复现。

## 复现

1. `pnpm run dev:v9`，"New Word" 新建空白文档。
2. 点文档正文区域，用真实键盘事件输入任意文字。
3. **完全没有反应**：光标不动，没有任何字符出现，控制台也没有报错弹窗——是
   静默失效，不是崩溃。

## 排查过程

### 第一个线索：`AscCommon.Uc.l5d` 卡在非 0

这个变量在这次会话调查 v9 版 #72 时已经摸清楚了含义（见
[issue #72 文档"第四轮"](2026-08-08-issue-72-pasted-image-blank-on-save.md#第四轮真正根因找到了v9-现已修复并验证截至本节写作时最新状态)）：
`AscCommon.Uc.l5d` 是一个"进行中操作"嵌套计数器，通过
`asc_onStartAction`/`asc_onEndAction`（压缩名 `Zx`/`Xo`）成对维护，`Uc.PZ(!0)`
自增、`Uc.PZ(!1)` 自减。只要 `l5d !== 0`，`AscCommon.Uc.Tra()` 就返回 `true`，
而这是几乎所有文档修改操作最终都会走到的 `Cf()`/`ugb()` 限制检查链路的
**第一道、无条件的门**——不像 #72 那次只挡图片插入（`Cf(1)` 一种类型），`l5d`
非 0 会挡住**所有**类型的 `Cf()` 调用，包括普通文字输入。

实测：新建文档后什么都还没做，`AscCommon.Uc.l5d` 就已经是 `1`。手动清零后
打字确实短暂能用了一下，但没过几秒钟又卡住——说明有什么东西在**持续地**、
反复地把它加回去，光清一次没用，得找到泄漏源头才能真正修好。

### 第二个线索：一次真实的 WebSocket 连接尝试

控制台里有一条容易被忽略的 warning：

```
WebSocket connection to 'ws://localhost:5173/doc/df97202e78c2105858b7/c/?shardkey=...&EIO=4&transport=websocket' failed:
WebSocket is closed before the connection is established.
```

`public-v9/onlyoffice-iframe-patch.js` 第 4 节已经有一个"Engine.IO/Socket.IO
握手 mock"，通过拦截 `XMLHttpRequest` 伪造轮询（polling）传输的握手响应，让
SDK 的 socket.io 客户端"以为"自己连上了协作服务器、不再无限重试——但那个 mock
**只覆盖 XHR**，SDK 的 socket.io 客户端还会独立地、真实地发起一次
`new WebSocket('ws://.../doc/{id}/c/?...')` 连接尝试。这个项目没有真实的
collaboration server，这个 WebSocket 连接会真的失败。

**实测确认这就是泄漏源**：用 chrome-devtools MCP 把 `window.WebSocket`（iframe
内）替换成一个对 `/doc/.../c/` 路径直接同步抛错的假构造函数后，`l5d`
在接下来 8 秒的持续采样里稳定停在 `0`，不再复发；同时打字恢复正常
（`asc_getCanUndo()` 从 `false` 变成 `true`，说明真的写进了文档模型，不只是
画面上看起来正常）。反之，仅仅手动把 `l5d` 清零、不阻止这个 WebSocket，几秒后
就又会变回非 0——因为 socket.io 有自己的重连策略，会反复重试、反复失败、反复
泄漏。

**根因**：每次这个真实 WebSocket 连接尝试失败，都会在 SDK 内部触发一次
"连接中/连接失败"的 start-action，但配套的 end-action 没有被正确调用到（可能
是因为失败发生在某个 SDK 认为"理应总会成功走到清理逻辑"的分支之外），于是
`l5d` 每次重连尝试都净增 1、永远不会回到 0。

### 第三个线索：一个独立的、也会泄漏计数器的小 bug——主题选择器崩溃

同一个浏览器会话里还发现了另一条独立的报错（`changesError`），这个跟 WebSocket
完全无关，但**碰巧也会泄漏同一个计数器**，值得一起记录清楚：

```
TypeError: Cannot read properties of undefined (reading 'theme')
  at Object.systemThemeSupported (app.js:8:207556)
  at Object.map (app.js:8:183184)
  at n.o (app.js:8:1813897)
```

反混淆后，`Common.Controllers.Desktop.systemThemeSupported = function(){return r.theme && "disabled"!==r.theme.system}`——
`r` 是这个控制器内部一个闭包私有变量，正常应该由真实桌面宿主通过
`Common.Controllers.Desktop.init(config)` 传入主题配置来赋值。而
`Common.Controllers.Desktop.isActive()` 返回 `true` 只是因为我们自己的
`window.AscDesktopEditor` polyfill 的存在骗过了这个检测（这正是 v9 Web Mode 能
让工具栏正常渲染的机制本身），但我们从没提供一个完整的、包含主题信息的桌面宿主
配置，所以 `r` 永远是 `undefined`，一读 `.theme` 就抛异常。

这个崩溃恰好也发生在一次 start-action 内部（渲染工具栏"大纲级别"那块 UI 时
触发的），异常把配对的 end-action 跳过了，效果和 WebSocket 泄漏一模一样：
`l5d` 净增 1，且这次崩溃每次新建文档都必现（不像 WebSocket 重连那样要等一会儿
才发生），所以哪怕修好了 WebSocket 那部分，这个崩溃单独一个就足够让每篇新文档
一开始就带着 `l5d=1` 出生，永远打不了字。**两个问题必须都修，只修一个不够。**

这个崩溃还有个肉眼可见的副作用：工具栏右上角"大纲级别"下拉框那块地方，因为这次
渲染直接抛出异常中断了，一直是空白的——正是用户截图里红框标出来的那块区域。

## 修复

### 1. 阻止真实 WebSocket 连接尝试（`public-v9/onlyoffice-iframe-patch.js` 第 4b 节）

紧跟在第 4 节 Engine.IO XHR mock 后面新增一段：把 `window.WebSocket` 替换成一个
构造函数，遇到 URL 匹配 `/doc/{id}/c/` 就直接同步抛 `NetworkError`（不发起任何
真实网络请求），其余 URL 原样透传给真正的 `WebSocket`。跟 XHR mock"让 SDK
以为已连接、不再重试"是同一个哲学，只是这次是"直接不让它有机会尝试，而不是
伪造一个假的成功响应"——因为 WebSocket 协议本身没有 XHR 那种能在 `onreadystatechange`
里插手伪造响应帧的钩子，直接拒绝连接、让客户端保留使用已经在正常工作的 polling
传输，是更简单可靠的做法。

### 2. 给主题检测方法加防御性 try/catch（`lib/onlyoffice-editor.ts` 新增 `patchDesktopThemeCrash`）

跟 `suppressDialogsInFrame`/`suppressCoAuthoringDisconnect` 同一个"轮询等目标
对象出现，然后打补丁"模式：等 `frameWindow.Common.Controllers.Desktop`
出现后，把 `systemThemeSupported`/`systemThemeType` 包一层 try/catch，异常时
返回安全默认值（`false`/`'light'`）而不是向上抛。在 `runWebModeOnAppReady`
里紧跟着另外两个 suppress 调用之后调用。

两处修复都不需要理解"为什么真实桌面宿主没配好主题/WebSocket 会怎样"这类问题
的完整原理——用的是这个项目里已经反复验证有效的思路：**这个纯客户端、无服务器
的场景里，凡是设计给"真实协作服务器/真实桌面宿主"用的检测机制，只要它一失败
就会产生比它本身更严重的副作用（这次是"静默锁死所有编辑"），就应该在客户端
直接短路掉，而不是试图真的实现一套假的协作/桌面协议。**

## 验证

- **新建文档后持续采样 `AscCommon.Uc.l5d` 8 秒**：稳定为 `0`，不再复发（修复前
  同样的采样会在几秒内变回非 0）。
- **控制台**：不再出现 `changesError`/主题崩溃的报错，也不再出现 WebSocket
  连接失败的 warning。
- **工具栏"大纲级别"下拉框**：不再空白，正常显示"1"。
- **真实键盘输入**：用 chrome-devtools MCP 的 `type_text`/`press_key`
  （不是直接调 API）敲字，文字正常出现在文档里；`asc_getCanUndo()` 从
  修复前的恒 `false` 变成 `true`，确认是真的写进了文档模型，不是画面假象。
- `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage`
  全绿（296 个单测，覆盖率阈值达标）。

## 未解决的小问题（不阻塞，记录一下）

用 chrome-devtools MCP 的合成键盘事件（`type_text`/连续 `press_key`）测试时，
偶尔会出现打出来的字符跟敲的不一致（比如连续按 `h`、`i` 两个键，文档里只出现
了一个 `g`）。没有深入排查，判断是 CDP 合成键盘事件对这类 canvas/WASM 渲染的
文本编辑器输入法层面的还原度问题（真实物理键盘输入会走完整的操作系统/浏览器
输入法组合路径，CDP 的按键注入不一定能完全还原），跟这次修复的两个 bug
（`l5d` 泄漏导致完全打不了字）是性质不同的两件事——这次要修的是"完全没反应"，
不是"敲对但显示错"。如果以后有真实用户反馈"打字会乱码"，需要单独立项排查，
不要跟这次的根因混为一谈。

## 后续加固：忙碌计数器看门狗（已实现并验证）

上面两个泄漏源（WebSocket、主题崩溃）修完之后，实测又在**打开段落样式库下拉
菜单**这个操作上复现了同一个症状——但这次控制台**没有任何报错**，说明是第三个、
还没找到具体位置的独立泄漏源。这个 SDK 体量太大，一个一个去找、去补每个泄漏点
不现实。

改用更省事、也足够安全的思路：在 `public-v9/onlyoffice-iframe-patch.js` 新增
第 4c 节"忙碌计数器看门狗"——每 2 秒检查一次 `AscCommon.Uc.l5d`，只要非 0
就直接清零并打印警告日志。之所以敢这么做：`l5d` 只影响"当前是否允许做文档
修改操作"这一个判断（`AscCommon.Uc.Tra()`），跟文档/撤销栈的完整性完全无关
（那部分状态在每个文档自己的 `Ga.Bd` 里单独维护）——**这个方案只适合本项目
这种单用户、没有真实协作服务器的场景，如果是真的桌面版/服务器版这么做就不安全
了**（会掩盖真实的多用户锁冲突）。

验证：手动把 `l5d` 设成 5 模拟一次未知来源的泄漏，2 秒内看门狗自动清零、控制台
打出预期的警告日志，全程不需要人工干预。

### 看门狗再扩展一次：状态栏"数据加载中"卡死不消失（已定位根因，已修复并验证）

用户后续反馈"v9 还有哪些其他问题，都一起检查修复"，逐个过工具栏功能时发现：
新建文档后，状态栏左下角（正常应该显示"字数统计"按钮的位置）常驻显示"数据加载
中…"，永远不消失；点开"编号"（numbering）下拉菜单后，哪怕这条已经消失了，也会
**再次**卡死出现。

**排查**：这行字对应的翻译键是 `loadFontsTextText`（"Loading document
fonts..."的中文），由 app.js 里一套通用的"长时间操作"状态栏机制
（`Main.setLongActionView`，由 `onLongActionBegin`/`onLongActionEnd` 驱动）
控制——而这两个方法**正是**直接绑定在 `asc_onStartAction`/`asc_onEndAction`
上的（`this.api.asc_registerCallback("asc_onStartAction",
onLongActionBegin)`），跟前面 `l5d` 泄漏用的是同一对底层事件。

第一次尝试：以为跟 `l5d` 一样是"忙碌计数器卡住"，检查
`mainCtrl.stackLongActions`（真正记录"当前有哪些长操作在跑"的栈）却发现是
空的——说明操作本身确实"结束"了，只是状态栏文字这一层没跟着清掉。据此在
`onDocumentReady` 里加了一次性清空，结果**只解决了首次加载这一种触发场景**，
点开"编号"下拉菜单又会重新卡死，说明这是一个会反复出现的问题，不能只在文档
加载完成那一个时间点处理一次。

**关键坑，记录下来避免下次重踩**：`mainCtrl.stackLongActions`
**不是普通数组或普通对象**，是一个自定义的栈结构，`Object.keys()`
在它上面永远返回它自带的 5 个方法名（`push`/`pop`/`get`/`exist`/`length`），
不是真实存的条目——第一次判断"栈是不是空的"用 `Object.keys(stack).length
=== 0` 完全判断错了方向。得改用 `stack.length()`（当函数调用）才是真的条目数。
调用后发现**栈里其实一直卡着一条没清掉的记录**：`{id: 2, type: 0}`，对应
app.js 原生打开文档流程里的 `onLongActionBegin(Asc.c_oAscAsyncActionType
.BlockInteraction, LoadingDocument)`——它的配对"结束"信号在 Web Mode 下没有
触发，跟这份文档记录的所有其它问题是同一种"依赖真实服务器信号，我们的环境里
永远不会来"的病因。

第二个坑：一开始想用 `Asc.c_oAscAsyncActionType.BlockInteraction`
这个符号常量去匹配卡住条目的 `type` 字段，图个"不用硬编码魔法数字"——结果实测
这个枚举常量的真实值是 `1`，卡住条目的 `type` 却是 `0`，两者对不上，导致修复
代码悄悄地从来没触发过（控制台连警告日志都没有）。最后放弃"用语义化常量名"，
直接按实测到的具体值 `{id: 2, type: 0}` 精确匹配。

**最终方案**：撤销 `onDocumentReady` 里那次一次性清理，改为在已有的第 4c 节
看门狗定时器里一并处理——每 2 秒检查一次栈顶，如果是这个精确签名
`{id:2, type:0}`，就调用 `mainCtrl.onLongActionEnd(entry.type, entry.id)`
（走 SDK 自己的正常"结束长操作"入口，而不是直接拿 `.pop()` 硬删或者只清空
文字），这样既清掉了栈里的记录也会连带清空状态栏文字。**特意只精确匹配这一个
签名**，不做成"栈顶有什么就强制结束什么"——万一以后真的有一个保存/打印/下载
之类的长操作合法地还在进行中，被看门狗提前强行结束反而会比卡住的状态栏文字
更糟。

**验证**：新建文档后状态栏从一开始就是空的（比第一版更快，第一版要等到
`onDocumentReady` 触发那一刻）；点开"编号"下拉菜单重新触发泄漏后，2 秒内
控制台打出 `[OO] stuck long-action {"id":2,"type":0} -- force-ending`，状态栏
文字同步清空，全程不需要人工干预。`pnpm run lint:ts && pnpm run
format:check && pnpm run test:coverage` 全绿。

### 看门狗第三次扩展：`isDisconnected` 卡 `true`，整个编辑器静默变只读

排查完样式库中文缺失、默认字体乱码（见
[2026-08-09 乱码文档](2026-08-09-v9-latin-text-garbled-notosanssc-substitution.md)）
之后继续用真实交互过其它功能点，测表格插入的时候又撞上了同一大类问题的
**第四种**表现形式：工具栏所有按钮突然全部变灰不可点，正文区域的隐藏输入框
也带上了 `readonly`。

排查确认是 `mainCtrl.appOptions.isDisconnected` 被置成了 `true`——这个标志
一旦为真，SDK 自己的 `setMode()` 会级联把 `isEdit`/`canEdit` 都设成
`false`，整个编辑器静默变成只读（没有任何弹窗提示）。这个机制在这次会话
更早之前排查"WebSocket 连接失败"那次已经见过（见本文档最上面"排查过程"
一节），当时是文档刚打开时必现；这次是**已经正常编辑了一段时间之后，从
点开表格插入这种完全普通的操作里又冒出来一次**，说明这不是"只在打开文档
那一刻会发生一次"的问题，而是整个会话生命周期里随时可能复发的同一类问题，
现有的 `suppressCoAuthoringDisconnect`（只拦截了这个状态的一个副作用——
隐藏保存/打印按钮，没有碰 `isEdit` 本身）覆盖不到。

**修复**：沿用同一个第 4c 节看门狗，每 2 秒也检查一次
`mainCtrl.appOptions.isDisconnected`，一旦发现是 `true` 就重置
`isDisconnected`/`isEdit`/`canEdit`，并额外调用一次
`api.asc_setViewMode(false)`——光重置这几个 UI 层的标志位不够，SDK 内部
真正的"是否只读"状态是分开维护的，两边都要修正过来才能让编辑真正恢复
（这一点是这次会话更早排查 WebSocket 问题时就已经验证过的经验，这次直接
复用）。这个重置在单用户、没有真实协作服务器的场景下是安全的——这份文档
永远不会有正当理由需要进入"已断线"状态。

**验证**：手动把 `isDisconnected` 强制设成 `true`（模拟一次未知来源的
触发），2 秒内看门狗自动清零、控制台打出预期的警告日志；紧接着实际打字，
`asc_getCanUndo()` 从 `false` 变成 `true`，确认不只是标志位被清空，编辑
能力也确实恢复了。`pnpm run lint:ts && pnpm run format:check && pnpm run
test:coverage` 全绿。

### 看门狗第四次扩展：`Disconnect` 长动作卡死，Save/Comments/Track changes 等一整片按钮永久失效

修完上面的 `isDisconnected` 之后继续用真实交互测别的功能（Insert > Table
网格选择器，插入一个 3x3 表格），发现同一个假断连触发点还有**第二条**独立
的泄漏路径，表现比 `isDisconnected` 那次更严重：工具栏里 Save、Comments、
Headings（左侧面板）、Track changes、Set document language、语言切换菜单
全部永久变灰不可点，状态栏一度显示"Connection is lost"——但 `Bold`/
`Italic`/表格插入本身等功能不受影响（跟 `isDisconnected` 那次"整个编辑器
只读"不是同一种表现，容易被误判成两个无关的 bug）。

排查确认 `mainCtrl.appOptions.isDisconnected` 和 `AscCommon.Uc.l5d` 这次
都是正常的（`false`/`0`），说明看门狗已有的两个检查点都没覆盖到这次的
根因。用同源访问翻 `public-v9/web-apps/apps/documenteditor/main/app.js`
（未压缩但变量名混淆的 bundle）定位到：Toolbar/Header/Statusbar 等**十几个
控制器各自独立**用 `api.asc_registerCallback("asc_onCoAuthoringDisconnect", ...)`
注册了自己的断连处理函数，互不经过统一的调度——其中 Toolbar 那份会把
`this.editMode` 置为 `false` 并调用 `DisableToolbar(true, true)`，级联调用
`toolbar.setMode({isDisconnected: true, ...})`，最终靠 `lockToolbar(Common.
enumLock.lostConnect, true)` 把一大批按钮打上 `disabled`。

关键发现：这批断连处理函数注册的同时，**也会往 `mainCtrl.stackLongActions`
里插入一条 `{id: 20, type: ...}` 的长动作**（`20` 就是 SDK 常量
`Asc.c_oAscAsyncAction.Disconnect` 的值）。app.js 自己在处理"连接恢复"时，
走的是 `mainCtrl.onLongActionEnd(type, id)` ——只要这条长动作被正常
结束，SDK 会自己触发完整的恢复级联（状态栏显示"Connection is restored"，
Save/Comments/Track changes 等全部一起解锁），不需要我们逐个控制器去反向
硬改内部状态。问题是：这次会话已有的看门狗（section 4c 第二段）只认
`{type: 0, id: 2}` 这一种卡死的长动作签名（那是"数据加载中"状态栏那次的
signature），遇到 `id: 20` 的条目直接 `break` 跳出循环，从未处理——所以
它在栈里永久卡死，SDK 自己的恢复级联永远不会被触发。

**修复**：把 section 4c 里检查 `stackLongActions` 的循环从只认
`{type:0, id:2}` 一种签名，扩展成同时认 `id === 20`（Disconnect，不锁
`type`，因为实测这个字段随触发路径变化，见 patch 里的注释）。命中任意一种
时都调用同一个 `mainCtrl.onLongActionEnd(entry.type, entry.id)`，让 SDK
走自己原生的"连接恢复"清理路径，而不是逐个控制器手动 patch。

**验证**：

1. 直接调用 `mainCtrl.onLongActionBegin(1, Asc.c_oAscAsyncAction.Disconnect)`
   人工复现——工具栏立刻出现同样的大片变灰、状态栏"Connection is lost"。
2. 不做任何手动干预，只等看门狗的 2 秒轮询——`stackLongActions` 自动清空，
   状态栏变回"Connection is restored"，所有按钮恢复可点。
3. 用**真实的 UI 操作**（重新走一遍 Insert > Table 网格选择器插入表格）
   复现最初发现问题的路径，同样在 2~3 秒内自动恢复，确认修的是真实触发
   路径，不是只对准我自己构造的测试条件。
4. `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage`
   全绿（296 个单测）。

### 看门狗第五次扩展：单次触发能自愈，但连续触发两次会留下残余——Toolbar/LeftMenu/Statusbar 各自独立的锁

上面第四次扩展验证时只连续走了**一次**真实的 Insert > Table 网格选择器操作，
确认能自愈。继续排查时把同一个操作**连续做两次**（更接近真实用户反复插入
表格/图片等操作的使用模式），发现第二次触发后，即使 `stackLongActions`
已经清空、`mainCtrl.appOptions.isDisconnected` 也是 `false`，Save、
Comments、Headings（左侧面板）、Track changes、Set document language
这一批按钮**依然卡死不可点**——说明这次的假断连事件还有第三条独立泄漏路径，
不经过 `stackLongActions`，第四次扩展覆盖不到。

**排查**：同源翻 app.js 确认，除了 Toolbar 控制器自己的
`onApiCoAuthoringDisconnect`（`this.editMode=false` +
`DisableToolbar(true,true)`，最终靠 `lockToolbar(Common.enumLock.
lostConnect, true)` 批量上锁），还有至少三处**互相独立**、直接调用
`SetDisabled(true)`/`setDisabled(true)` 的地方，谁都不经过
`stackLongActions`，谁的解锁也不会被其他任何一处触发：

| 卡住的按钮                            | 拥有者                                                             | 直接调用                         |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| 全部工具栏格式化按钮                  | `Toolbar` 控制器自己的 `editMode`/`mode.isDisconnected`            | `lockToolbar(lostConnect, true)` |
| Comments / Headings（左侧面板）       | `LeftMenu` 控制器                                                  | `this.SetDisabled(true)`         |
| Track changes / Set document language | `Statusbar` 控制器持有的 `btnTurnReview`/`btnDocLang` 两个按钮实例 | 各自的 `setDisabled(true)`       |

一开始尝试的通用做法（`mainCtrl.onLongActionEnd(type, 20)`、
`mainCtrl.disableEditing(false, 'reconnect')`）都试过，两个都只能恢复
Toolbar 那一片和状态栏文案，碰不到 LeftMenu/Statusbar 这两处——它们的
`onApiCoAuthoringDisconnect` 是完全独立注册的回调，没有走同一条清理路径。

**修复**：在 section 4c 看门狗里新增第三个检查块，每 2 秒：

1. `toolbarCtrl.editMode === false` 时，重置 `editMode`/`toolbar.mode.
isDisconnected`，调用 `lockToolbar(Common.enumLock.lostConnect, false)`
   和 `DisableToolbar(false, false)`；
2. `#left-btn-comments`/`#left-btn-navigation` 任一带 `disabled` class 时，
   调用 `LeftMenu` 控制器的 `SetDisabled(false)`；
3. `Statusbar` 控制器的 `btnTurnReview`/`btnDocLang` 各自的 `isDisabled()`
   为真时，分别调用对应的 `setDisabled(false)`。

三个检查各自独立、互不依赖，每一个都单独在浏览器里手动验证过确实能解锁
对应的按钮，命中条件都做了判断（不是无条件每 2 秒硬调），空跑时是无操作。

**验证**：不做任何手动干预，把"打开 Insert > Table 网格选择器插入表格"这个
真实操作连续做两次（复现最初发现残留问题的确切路径），等待看门狗的 2~3 秒
轮询——Save、Comments、Headings、Track changes、Set document language
全部恢复可点，状态栏正常显示"Connection is restored"。`pnpm run lint:ts
&& pnpm run format:check && pnpm run test:coverage` 全绿（296 个单测）。

### 真正的根因修复：在 SDK 内部事件分发的唯一出口拦一次，而不是追着每个控制器修

五次看门狗扩展修完之后，用户明确要求"最好可以发现根本原因，这样修好一处，
其他地方都好了"——回头看，前五次扩展全都是**反应式**的：每 2 秒巡检一次
已知的几个卡死信号，命中就手动逆转。这个模式天然追不完：每次换一个新的
真实操作去测，都可能撞上第 6、第 7 个从未见过的独立锁点（Toolbar 自己的
`editMode`、LeftMenu 的 `SetDisabled`、Statusbar 两个按钮各自的
`setDisabled`……），因为这一大类问题的根源——**大约十个互相独立的控制器
（Toolbar、LeftMenu、Statusbar、Header、ReviewChanges……）都各自直接调用
`api.asc_registerCallback("asc_onCoAuthoringDisconnect", 自己的处理函数)`**，
彼此之间没有任何统一的分发或清理路径，谁的按钮该怎么锁、怎么解，完全是
各写各的。

**关键突破**：既然十个处理函数最终都是被同一个地方调用的，那就不用挨个去堵，
直接在那"同一个地方"拦一次就够了。用同源访问翻 `public-v9/sdkjs/word/
sdk-all-min.js`（压缩但没有 sourcemap 的 SDK bundle）顺着调用链网上找：

1. 触发断连事件的函数是 `d.prototype.oce = function(r){this.ZWb.cancel();
this.bc("asc_onCoAuthoringDisconnect",r);this.zQb(!0)}`——真正的分发点是
   `this.bc(...)`。
2. 浏览器里直接检查 `window.Asc.editor.bc`，确认它就是 `asc_registerCallback`
   注册时写入的同一个监听器列表的读取端：`function(){this.J3j.apply(this,
arguments);var N=arguments[0];if(Wa.hasOwnProperty(N)){for(var
ba=0;ba<Wa[N].length;++ba)Wa[N][ba].apply(this||a,Array.prototype.slice.
call(arguments,1));return!0}return!1}`——`api.bc(eventName, ...args)`
   就是 SDK 内部**唯一**的事件分发出口，`asc_registerCallback` 只是往
   `Wa[eventName]` 这个数组里 push，`bc` 才是真正挨个调用的地方。
3. 同时确认 `stackLongActions` 卡死的 `Disconnect`（id 20）长动作也走同一个
   出口：`api.bc('asc_onStartAction'/'asc_onEndAction', type, 20)`。

**修复**（`lib/onlyoffice-editor.ts` 新增 `blockCoAuthoringDisconnectDispatch`，
`onAppReady` 时对 iframe 内的 `api.bc` 打一次猴子补丁）：包一层，遇到
`name === 'asc_onCoAuthoringDisconnect'`，或者 `name` 是
`asc_onStartAction`/`asc_onEndAction` 且 `id === Asc.c_oAscAsyncAction.
Disconnect` 这两种情况，直接返回 `false`、不转发给原始 `bc`；其余事件名
一律原样放行。这样无论触发源是什么（WebSocket 重试、SDK 内部的连接保活
超时，还是别的没找到的路径），**十个控制器谁都收不到这个事件**，从源头
上不会有任何一处被锁——不再是"锁了再等 2 秒解锁"，而是压根不会锁。

与已有的 `suppressCoAuthoringDisconnect`（拦截
`Common.NotificationCenter.trigger('api:disconnect')`）是两条不同的触发
路径，不能互相替代：后者堵的是 app.js 层面另一条独立的通知总线，前者堵
的是 SDK 内部的事件分发核心。两个都保留，看门狗也保留（当防御纵深——万一
以后又冒出一条完全不同的第三条触发路径，看门狗还能兜底）。

**验证**：

1. 手动直接调用 `api.bc('asc_onStartAction', 1, 20)` 和
   `api.bc('asc_onCoAuthoringDisconnect', true)`，确认补丁拦截计数器命中，
   且工具栏、Comments、Track changes 全程未受影响（不像之前那样先锁住、
   再等看门狗解锁——这次全程根本没锁过）。
2. 单独验证没有误伤：手动调用 `api.bc('asc_onStartAction', 0, 2)`
   （`LoadingDocument`，一个完全不同的 id）确认仍然正常压栈、
   `asc_onEndAction` 后正常弹栈——"加载中"这类正常状态栏提示没有被误伤。
3. 用真实的 Insert > Table 网格选择器**连续插入两次表格**（最初发现残留
   问题的确切路径）——这次控制台除了补丁自己打印的"blocked at the
   source"确认日志外，**全程没有任何看门狗警告**，说明五次扩展里堆的那些
   反应式检查这次一次都没触发，Save/Comments/Headings/Track changes/
   语言菜单全程保持可用。
4. `pnpm run lint:ts && pnpm run format:check && pnpm run test:coverage`
   全绿（296 个单测）。

## 顺带发现：段落样式库预览图标显示数字，不是真实预览（根因已定位，已修复并验证）

同一次交互还看到工具栏"样式库"下拉菜单里的九宫格缩略图显示的是数字 1-9，不是
应该显示的真实预览（比如"标题 1"应该显示用该样式格式化过的示例文字）。

**排查结论：这是一个真实存在、但确认纯粹是视觉层面的字体渲染 bug，样式数据和
套用逻辑完全没问题。已经修复并用真实工具栏点击验证通过。**

### 排查过程

用同源 iframe 访问 + 一路跟到具体的绘制函数（调用链：
`api.GenerateStyles()` → `mub` → `AscCommonWord.pFf` 实例的 `mub` → `W_b` →
`FK`（20ms 时间片批处理循环）→ `ek` → `qJh`（取到真实样式名，如 `pc()` 返回的
`"Normal"`、`"Heading 1"` 等，确认全部正确）→ `tBg` → `yFi`（真正往 canvas 上
画字的地方）），发现：

- `qJh` 取到的样式名全部正确（`Normal`/`Header`/`Footer`/……），翻译、套用都
  没问题；工具栏样式库下拉实际展示的是一个"快速样式"子集（`Normal`/
  `No Spacing`/`Heading 1`~`Heading 9`/`Title`/`Subtitle`/……），跟 Word
  默认的快速样式库对得上——**看到的"1"到"9"，就是"Heading 1"到"Heading 9"
  这 9 个样式，只是"Heading "这个单词部分没画出来，只剩下后面那个数字**；
  "Normal"（无数字可"幸存"）缩略图是完全空白的。
- 直接给 `yFi` 加 spy，实测传入的 caption 参数 `f` **在所有 28 个样式上都是
  正确的、已翻译好的中文**（"正文"、"标题 1"……），不是数据错——问题 100% 出
  在绘制这一步本身。
- 全局给 `CanvasRenderingContext2D.prototype.fillText`/`strokeText` 加 spy，
  实测**在整个生成过程中一次都没被调用过**——说明 SDK 画这些字压根不走浏览器
  原生的文字渲染 API，是它自己的一套内部字形光栅化系统（大概率直接从预解析好
  的字体轮廓数据里取字形描边/位图画上去），而这套内部系统在这一条代码路径上，
  CJK 字形会静默丢失（不报错），拉丁字母和数字能正常画出来。
- 没有任何字体相关的 XHR 请求在这次生成过程中发生（也用 spy 确认过），说明
  不是"字体文件没取到/取错了"这种、这个项目之前遇到过很多次的坑，是 SDK 自己
  内部某个字形缓存/光栅化环节的问题，从 JS 这一层够不着直接修。

### 修复思路：不修 SDK 内部渲染器，浏览器原生 API 自己画一遍盖上去

既然 SDK 自己的内部文字渲染在这条路径上认不出 CJK 字形，而**浏览器原生的
`fillText` 反而是可靠的**（前提是有一个真的支持中文的字体可用）——干脆不管
SDK 内部是怎么画的，等它画完之后，我们自己在同一个 canvas 上用原生 `fillText`
把正确的 caption 文字盖上去一层。

具体做法（`public-v9/onlyoffice-iframe-patch.js` 新增第 6c 节）：

1. 用 `FontFace` API 加载这个项目本来就有的 `NotoSansSC-Regular.ttf`（同一个
   字体文件，文档正文的中文渲染已经在用，见 `font-map.json`），注册成一个新的
   字体族名。
2. 包一层 `yFi`：先调用原始实现（保留它还能画出来的部分，比如某些样式确实能
   正确套用斜体/下划线格式预览），再在图标底部约 38% 的区域画一个半透明白色
   底、用刚加载的 CJK 字体把正确的 caption 文字居中画上去。

踩的一个坑：**`yFi` 不是挂在共享的原型（prototype）上的，是每个 `mpf` 实例
自己的属性（own property），挡住了原型上的同名方法**——第一次直接
patch `Object.getPrototypeOf(mpf).yFi` 完全没生效（实测调用次数是 0）。
另外还有第二个坑：手动重新调用 `api.GenerateStyles()` 之后，虽然确认新图确实
生成了（直接从 `qJh` 的返回值里取出来验证过，byte-for-byte 是新内容），但工具栏
UI 显示用的 `listStyles.store.models[i].imageUrl` 并不会跟着自动刷新——**这只是
手动重新触发时的验证假象，不是修复本身的问题**：真实场景下文档一打开就会自然
触发一次生成，我们的补丁只要在那第一次生成之前就位即可，不需要处理"如何让 UI
刷新已经过时的图"这件事。

最终方案：patch `AscCommonWord.pFf` 这个构造函数本身（每次 `new
AscCommonWord.pFf()` 被调用时，立刻给刚创建出来的实例的 `.mpf.yFi` 打上补丁），
确保补丁在 SDK 自己第一次真正生成缩略图之前就已经就位，不依赖任何"手动重新
触发"的技巧。只对 Word 编辑器生效（`AscCommonWord`）——Excel/PPT 是完全独立、
各自单独混淆过的 SDK 包，内部名字大概率不一样，这次没有验证，以后如果那边也报
类似问题需要单独排查，不能当作"这个补丁已经顺带覆盖了"。

### 验证

用真实工具栏点击（"开始"标签页 → 样式库展开按钮），不做任何手动干预，样式库
九宫格里全部 28 个样式的缩略图都正确显示中文名称（"正文"、"标题 1"到
"标题 9"、"引用"、"强调"、"页眉"、"页脚"……），原有能正确显示的格式预览
效果（比如标题几个格子顶部的加粗数字样式、"强调引用"的下划线）也都还在——
两者叠加显示，没有互相覆盖。`pnpm run lint:ts && pnpm run format:check &&
pnpm run test:coverage` 全绿（296 个单测）。

### 第一版验证之后：字太小，追加一次修正

用户实测反馈"展示的样式太小了"——第一版把字号硬编码成 `11px`，但这个 `11` 是
**canvas 自身的原始像素坐标系**下的大小，不是 CSS 显示大小。实测这个 canvas
的原始分辨率是 208×80，而它在页面上实际显示（无论是工具栏内联的小预览还是
展开的九宫格）用的 CSS 尺寸都是 104×40——正好 2 倍关系，跟
`devicePixelRatio` 对上了。所以硬编码的 `11px` 画出来之后，缩放显示到
CSS 尺寸时，视觉上只有约 5.5px 那么大，明显偏小。

修复：改成按 `画布实际像素宽度 / 104`（即 CSS 尺寸）算出真实缩放比例，字号和
留白都按这个比例动态换算（`fontPx = Math.round(12 * scale)`），不再写死绝对
数值。改完之后重新用真实工具栏交互验证：工具栏内联预览和展开的九宫格下拉，
字体大小都恢复正常、清晰可读，跟界面其它文字的视觉比例协调。

## 需要回头更新的地方

[2026-08-06 v9 go-live 审计](2026-08-06-v9-go-live-readiness-audit.md)里"三个
问题都已修复并验证"的结论，验证方式主要是 API 直调 + 截图看，没有用真实键盘
测过打字——这次发现的 bug 说明那份审计的"可编辑"结论不完整，应该在那篇文档里
补一条指向这里的说明，避免以后又被那份"全部清零"的结论误导，跳过真实键盘测试
这一步。
