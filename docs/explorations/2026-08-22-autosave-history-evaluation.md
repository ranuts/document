# 自动保存到 IndexedDB + 本地文档历史页：可行性评估

日期：2026-08-22
状态：评估 → 已实施（见 [实施记录](./2026-08-22-autosave-history-implementation.md)，
其中第三节修正了本文"按文件名复用历史行"的设计，第四节补上了本文没有的七天保留窗口）

## 零、结论先说

方向对，痛点真实（现在刷新一次，未导出的编辑全没了），但**难点不在存储，在导出**。

我们的"一次快照"不是 Excalidraw 那种几十 KB 的 JSON.stringify，而是一次
`asc_DownloadAs` 全量导出：SDK 序列化 + x2t 转换 + ArrayBuffer 跨 frame 传回，
而 x2t 每次要 283 MB 堆。所以照搬"每次变更防抖 300ms 落盘"的做法会直接把编辑器
拖垮，移动端还会撞上 #145 的 canvas 丢失。

另外这件事会改变产品定位的一句话：从"关掉标签页什么都不剩"变成"你的文档留在
这台机器上"。这是新增的隐私面，必须是显式的、可关的、可清空的。

还有一层比自动保存更便宜、我们却完全没做：**离开前的未保存提示**（`beforeunload`，
全仓零命中）。手滑关标签页目前是静默失去一切，而挡住它只要几十行、不需要任何存储。
这一步应该独立、立刻做。

建议按"四层防线"铺（见下节），一期先做恢复点 + 找回入口，顺便拿到真实的导出耗时数据，
再决定二期的历史库长什么样。

## 一、"关掉网页就没了"是网页应用的通病：业界的四层防线

这个痛点不是我们独有的，凡是有编辑态的网页应用都会碰上，而业界的解法**是叠起来用的四层，
不是四选一**。先把"丢"拆开看：手滑关标签页、刷新、浏览器崩溃/OOM、手机切后台被杀、
换台机器回来——每一种的解法都不同层。

### 第 0 层：离开前拦住（beforeunload）

最便宜、最普遍、也最被低估的一层。GitHub 的评论框、Gmail、Jira、Notion、几乎所有在线表单
都有：有未保存改动时挂 `beforeunload`，浏览器就会在关闭/刷新前弹一次确认。
代价是几十行代码，不需要任何存储，不涉及任何隐私权衡。

**本站现在完全没有**（全仓 grep `beforeunload` 零命中）。也就是说用户手滑按了 ⌘W，
浏览器一声不响就关了，编辑器里几小时的改动直接蒸发——这是当前最大的一处敞口，
而且它跟自动保存是两件独立的事，不该等自动保存做完才做。

限制要知道：提示文案不能自定义（各家浏览器统一措辞）；页面必须有过用户交互
（sticky activation）才会弹；移动端切走/杀进程不触发。所以它挡的是"手滑"，
挡不住崩溃和没电——那两种要靠下面的层。

### 第 1 层：直接写回用户磁盘（File System Access）

让网页表现得像桌面 Office：打开文件时就拿到一个可写句柄，之后的保存直接覆盖磁盘上的原文件。
网页关不关都无所谓，**因为文件本来就在用户磁盘上**。

关键的一点是 `FileSystemFileHandle` **可以存进 IndexedDB**，下次回来用
`queryPermission()` / `requestPermission()` 续上，于是"最近文件列表 + 一键继续编辑原文件"
就成立了——draw.io、VS Code Web 走的都是这条路。Chrome 122 起还支持持久权限
（用户可以授予永久访问，不必每次点）。

覆盖面：Chromium 桌面（Chrome / Edge / Opera 86+）。Safari 完全不支持本地磁盘 picker
（只有 OPFS），Firefox 也不支持，且 Mozilla 的标准立场是反对。所以这是增量能力，不是底座。

本项目其实已经在用 ranuts 的 `saveFileToDisk`（File System Access + 锚点兜底），
但**每次保存都重走一遍 picker、不留句柄**。把句柄留下来，这一层就成立一大半。

而且这一层**对隐私最友好**：数据回到用户自己的文件系统，浏览器里不留副本，泄露面从源头就不产生。

### 第 2 层：浏览器内恢复点（IndexedDB / OPFS）

第 1 层覆盖不到的场景才需要它：Safari / Firefox / 移动端、用户拒绝授权、
`?new=docx` 这种还没落过盘的新文档、以及崩溃时那一刻。这就是本文讨论的主体，
定位是 AutoRecover 而不是 AutoSave（见下一节）。

### 第 3 层：找回入口（存了不等于找得回）

用户主动关掉标签页、第二天从域名根回来时，页面上必须有线索，否则恢复点等于不存在。
业界三种入口，按需要的规模依次上：

1. **启动时的恢复提示**——编辑器页 boot 读元数据（不读 blob），有较新的未导出快照就挂一条
   恢复条："上次编辑的《x.docx》有未保存的改动：恢复 / 丢弃"。这就是 Office 的
   Document Recovery 窗格、WordPress 的"检测到比当前版本更新的自动草稿，要恢复吗"。
   注意 WordPress 那句提示的重点是**版本比较**（哪一份更新），不是"有个备份"——
   对应到我们这里是"磁盘上那份 vs 浏览器里这份谁更新"，恢复条上要显示时间差。
2. **落地页的一行"继续上次编辑"**——静态页不带 editor bundle，但读 IndexedDB 元数据
   只要几 KB 的独立小脚本，形态跟现有的 `open-local.js` / `landing-prefetch.js` 完全同构。
3. **`/history` 路由页**——条目多起来之后才需要，分页 / 搜索 / 批量管理。

要承认一件事：恢复点不止一条时（用户先后编辑过三个文档），**那条恢复条本身就是个迷你列表**，
Office 的恢复窗格也是列表。所以一期真正省掉的不是"列表"，而是"路由页 + 分页 + 搜索"。

由此推出一期的一条硬约束：**存储层必须按最终形态写，不能为"只有一篇"做简化**。
如果图省事做成固定 key 的单条快照，二期就得推倒重来，还要多写一次迁移。

### 关掉网页那一刻的时序

导出是异步的，`beforeunload` 里现发起基本来不及；移动端切后台被杀更是完全没有机会。
所以主保障是 `visibilitychange → hidden` 那一拍（后台冻结前通常还有时间）加上周期性快照本身，
最坏情况丢失一个快照间隔的编辑量——跟 Office AutoRecover 默认 10 分钟同理，可接受，
但要在 UI 上说清楚"这是恢复点，不是备份"。

## 二、四种持久化机制流派

### 1. 云 + 操作日志：Google Docs、Office AutoSave

Google Docs 离线把编辑捕获在本地（IndexedDB）作为操作队列，联网后同步；
Office 的 AutoSave 只在文件存在 OneDrive/SharePoint 时才工作。

这一派需要服务器，本项目直接出局。但有一条**必须借鉴的概念区分**：Office 里
AutoSave 和 AutoRecover 是两件不同的事——AutoRecover **不是保存**，它是"把最近的
改动记到另一个地方"，默认 10 分钟一次，纯本地，只在崩溃后问你要不要恢复。

我们要做的其实是 AutoRecover，不是 AutoSave。这个区分决定了后面所有的取舍：
恢复点可以慢、可以有损（只保最近几个）、可以不覆盖原文件。

### 2. 全量快照 + 防抖：Excalidraw、tldraw

Excalidraw 的 `LocalData` 类统一编排防抖落盘，在 `onChange` / `visibilitychange` /
`unload` 三处触发；场景元素和 appState 走 localStorage，**二进制文件（图片）和素材库
才走 IndexedDB**（用 idb-keyval）。协作时暂停本地写。

tldraw 更省事：给 `<Tldraw persistenceKey="...">` 一个 key 就自动落 IndexedDB 并跨标签页
同步；自定义后端则用 `getSnapshot` / `loadSnapshot`，快照分 `document`（形状/页面，存服务器）
和 `session`（相机、选区、UI 状态，只存本地）。store 监听器用 throttle 压频率。

**它们敢高频是因为快照便宜。** 这一派可借鉴的是形态（防抖 + 三处触发点 + 会话状态与
文档状态分开），不是频率。

### 3. 增量 op log + 周期压实：Yjs 的 y-indexeddb

每次 update 往 store 追加一条记录，攒到阈值就把全部 update 合并成一个 snapshot、
清掉旧记录（compaction）。优点是写入极便宜（只写 delta），代价是需要一套可重放的
操作模型。

对我们来说这条路要求 sdkjs 的协作 changes 流能在离线单机被重放——**未验证**，风险高，
放三期。

### 4. 只存句柄，不存内容：VS Code Web 一类的"最近打开"

把 `FileSystemFileHandle` 存进 IndexedDB，列表只有元数据；重新打开时向用户要一次
读权限。零存储成本、零新增隐私面，但只有 Chromium 系有效（Safari/Firefox 无
File System Access 写句柄），而且**它不解决"刷新丢失未保存改动"**——句柄指向的是
用户磁盘上那份旧文件。

可以作为历史列表的补充维度（"最近打开过的本地文件"），不能作为主方案。

### 存储侧的通用共识

- 配额差异很大：Chrome 约给可用磁盘的 60%（跨源共享），Firefox 约 10%/eTLD+1，
  Safari 最保守，且**7 天没访问就可能整站清掉**。
- 写之前用 `navigator.storage.estimate()` 估，写的时候 catch `QuotaExceededError`。
- `navigator.storage.persist()` 可以把站点提升成持久化（不参与自动驱逐）；Chrome 按
  参与度自动判定，Firefox 会弹权限。web.dev 的建议是**只给"丢了就是重大损失"的数据
  申请**——本地文档恰好符合，但申请时机应该在用户第一次真的产生了历史之后，不是启动就问。
- 官方口径都强调：别把浏览器存储当唯一副本。我们没有第二副本，所以这句要翻译成产品语言
  写进 UI——"这是恢复点，不是备份，请照常导出到磁盘"。

## 三、放到本项目上，四个真问题

### 问题 1：我们的快照贵，而且 SDK 自带的那条路已经被我们焊死了

`lib/onlyoffice/guards/serverless-save.ts`（守卫 5）已经把 `autoSaveGap` /
`autoSaveGapFast` / `autoSaveGapRealTime` 全设成 0，并把 `asc_setAutoSaveGap` 钉死成
no-op。原因是无服务器下 SDK 的 autosave loop 会拿到假的保存成功，把
`isDocumentCanSave` 翻回 false，导致 Save 按钮和 Ctrl+S 永久变灰。

**所以自动保存不能靠"把 gap 调回去"来实现**，必须在应用层自己造节拍器，走
`requestSaveDocument`。改这里之前先读那个守卫的注释，别把它撤了。

触发信号有现成的：vendor 的 `api.js` 暴露 `onDocumentStateChange` 事件（我们目前
没有监听）。节拍应该是三重条件的合取，而不是单纯的定时器：

- 文档被改过（`onDocumentStateChange` 置脏位）
- 距上次快照超过 T（建议起步 60~120s，按实测调）
- 当前空闲（`requestIdleCallback` / 距最后一次输入 >2s），且没有 in-flight 的保存

再加两个必存点：`visibilitychange → hidden`、`beforeunload`（后者只能尽力，导出是
异步的，多半来不及——所以真正的保障是前两个，unload 只当兜底）。

**成本目前是未知数**，这是一期最该先量的东西。`bin/corpus-report.mjs` 的表里已经有
`save p50/p95 (ms)` 一栏，跑一轮语料就有分布。

可能的加速路径（**待验证，别当结论用**）：导出成内部 bin 格式而不是 docx。
`lib/file-types.ts` 里已经有 `DOCY: 4097` / `XLSY: 4098`（PPT 侧常量表里还没有）。
bin 是 SDK 自己的序列化产物，理论上不经过 x2t，重开时走 `openDocument({buffer})`。
要实测三件事：`asc_DownloadAs(DOCY)` 是否真的绕过 x2t、产物能否被重新打开、体积多大
（bin 通常比 docx 大，因为不压缩）。#113 那次已经确认过 file-stream 通道上能出现带
`DOCY` 头的字节，所以这条路至少不是凭空想的。

### 问题 2：保存通道是单例，而且没人接的字节会直接下载到磁盘

`lib/onlyoffice/save-stream.ts` 里 `embeddedSaveRequest` 全局只有一个；只读、打开失败、
已有 in-flight 请求都会立即 reject。更要紧的是 `routeSavedFile()`：当没有 in-flight
请求时，它会调 `saveFileToDisk` —— 也就是说**自动保存如果自己去调 `asc_DownloadAs`，
用户会莫名其妙收到一堆下载**。

所以自动保存必须：

- 走 `requestSaveDocument`，不自己碰 `asc_DownloadAs`；
- 用户手动保存优先，自动保存遇到 in-flight 就跳过这一轮（不排队，下一拍再说）；
- embed 模式（`isEmbedMode()`）一律不写历史——那是宿主页的文档，不该进我们的库；
- 只读、打开失败的文档不写。

### 问题 3：隐私面——已定调，靠显眼的删除与清空

站点现在的卖点是"文件从不离开你的设备"，隐含"关掉就没了"。加了历史之后，共享电脑、
演示机、公用机上多出一个泄露面。

**处理方式已经拍板：默认开启，用显眼的单条删除 + 一键全部清空来解决**，不靠默认关闭
或层层询问来回避（那会让功能对绝大多数人等于不存在，而痛点恰恰发生在用户还没去翻设置的时候）。

要做到"删了就是真删"，有三件事不能省：

1. **清空要连字节一起删**——`docs` 元数据、`blobs` 字节、存下来的 FSA 句柄、
   （如果日后用了）OPFS 文件，一次全清。只删索引等于没删，磁盘上的痕迹还在。
2. **不做标记删除**，删除即落库，并且删完立刻能在 UI 上看到条目消失。
3. **入口要显眼且随处可达**——历史页有"清空全部"，列表每条有删除，
   连启动时的恢复条上也要能直接"丢弃"，不能只藏在设置里。

另外保留一个总开关（关闭时同时清空），成本很低。无痕模式下 IndexedDB 会话结束即清，
本来就符合预期，不用特殊处理；IndexedDB 不可用时静默降级（`pending-open.ts` 已是这个写法，照抄）。

**已实施**：默认开启 + 历史页每行删除 + 一键清空 + 七天自动清除（见实施记录第四节）。

**顺带一提**：第 1 层（写回磁盘）从根上就不产生浏览器副本——能走那条路的用户，
泄露面比"存在浏览器里再提供删除"小一圈。这也是把它排在第 2 层前面的原因之一。

### 问题 4：两个标签页开同一篇，自动保存会互相覆盖

这是自动保存独有的新问题：没有自动保存时，两个标签页各改各的、谁按保存谁的算；
有了自动保存，两边会轮流把对方的快照盖掉，**比不自动保存更糟**。

业界标准答案是 Web Locks API：`navigator.locks.request('doc:<id>', …)` 拿文档级锁，
拿不到就退化（提示"另一个标签页正在编辑"，本页不写快照）。tldraw 那一派则用
BroadcastChannel 做跨标签同步。我们一期至少要有互斥 + 提示，同步可以不做。

## 四、数据模型

两个 store，**元数据和字节必须分开**——这是列表页快不快的分水岭，列表只读元数据，
不会把几十 MB 的 blob 拖进内存。

```
docs   (keyPath: id)
  id, title, titleLower, ext, docType, size, origin('local'|'url'|'new'),
  createdAt, updatedAt, lastOpenedAt, revCount
  index: by_updatedAt, by_titleLower

blobs  (keyPath: [docId, rev])
  docId, rev, savedAt, bytes(Blob), byteLength
  index: by_docId
```

~~存 `Blob` 而不是 `ArrayBuffer`~~ —— **实施时改成了 typed array**：字节从编辑器 frame
过来就是 ArrayBuffer、回去也是 ArrayBuffer，Blob 只是入口包一层、出口再异步拆一层；
而且它是所有 structured clone 实现都忠实往返的形状（fake-indexeddb 就还不出 Blob）。
见实施记录。

**分页别用 offset。** IndexedDB 没有便宜的 count-skip，正确做法是 `by_updatedAt` 上
`openCursor(range, 'prev')` + `advance(n)`，或 keyset（记住上一页最后的
`[updatedAt, id]` 作为下一页的 `IDBKeyRange.upperBound`）。不过元数据每条 <1KB，
几千条**全量读进内存再排序过滤也完全够用**——一期就这么做，别一上来上游标，量大了再换。

**标题搜索：IndexedDB 只能做前缀范围查询**（`IDBKeyRange.bound(q, q + '￿')`），
子串和中文分词都做不到。业界常规两条路：内存 `includes()` 过滤（几千条是微秒级），
或建 n-gram token 索引。一期直接内存过滤，别引 flexsearch 那一套。

**字节放 IndexedDB 还是 OPFS？** OPFS 对大二进制明显更快（不走结构化克隆，可流式与随机写），
现代浏览器都支持（Chrome/Edge、Firefox 111+、Safari 15.2+），业界拿它跑 SQLite WASM、
视频编辑、模型权重。但我们的写入是**分钟级、一次几 MB**，不是高频 I/O，IndexedDB 那点
结构化克隆成本完全吃得下；而 OPFS 要自己管目录、孤儿文件清理、以及与元数据的一致性。
建议一期全放 IndexedDB，把 OPFS 记成"实测发现写入卡主线程再换"的备选，别为了新技术提前上。
（iOS Safari 在存储压力下对两者都会激进驱逐，没拿到 `persist()` 谁也保不住。）

**保留策略是必须的，不是可选项**，否则迟早 `QuotaExceededError`：

- 每个文档最多留 N 个 rev（建议 3：最新 + 2 个恢复点），超了删最旧；
- 全库上限取 `min(500 MB, quota × 50%)`；
- 超限按 `lastOpenedAt` LRU 淘汰整个文档；
- 写前 `estimate()`，写时 catch 配额错误 → 先淘汰再重试一次，仍失败就关掉自动保存
  并提示用户（**不能静默失败**——静默失败的自动保存比没有自动保存更危险）。

## 五、历史页放哪

首页是不带 editor bundle 的静态落地页，这条不能破。历史页应该是**第三个 vite entry**
（`history.html` → `/history`），只依赖 IndexedDB 读元数据 + ranui 组件，几 KB，
不要塞进 `editor.html`，也不要塞进 `index.html`。

打开一条历史，最省的做法是复用现成的 `?open=local` 交接：历史页把选中的 rev 写进
`document-handoff` 的 `pending` key，跳 `/editor?open=local`，编辑器一行不用改。
但那样会丢掉"这是历史里的哪一条"的身份，之后的自动保存会新建一条记录。所以更好的是
加一条 `?open=history&id=<id>` 分支，`lib/pending-open.ts` 里多一个读法，编辑器侧记住
`docId` 后续覆盖同一条。

顺带要跟的（漏一个 CI 就红）：

- 双语（`public/zh-CN/` 那侧同名页）+ 首页卡片入口 + `sitemap.xml` + `llms.txt`，
  否则 `test/unit/landing-pages.test.ts` 先红；
- `history.html` 属于"固定名、随部署变化"的文件 → `_headers` 的 no-cache 组 +
  `sw.js` 的 `DEPLOY_COUPLED` 两处都要加（`hosting-contract.test.ts` /
  `sw-routing.test.ts` 钉着）；
- 镜像那侧的 `sws.toml` 同步。

## 六、分期建议

**第 0 步：`beforeunload` 未保存提示（现在就能做，独立于一切）**
零存储、零隐私成本、几十行代码，挡住"手滑关标签页"这一类最常见的丢失。不要等自动保存。

**一期：存储层（最终形态）+ 自动快照 + 找回入口**
两个 store、索引、rev、保留策略、配额降级全部按最终形态落地；UI 只做两件事——编辑器页的
恢复条、落地页的"继续上次编辑"；再加 Web Locks 的多标签互斥，以及恢复条上就能"丢弃"的删除入口。
不做路由页、不做分页搜索。这一步消掉"刷新/关页全丢"，
同时量出真实的导出耗时与内存曲线，为二期定频率、并回答要不要走 DOCY。

**一期半（可选，仅 Chromium）：留住 File System Access 句柄**
把打开/保存时拿到的句柄存进 IndexedDB，实现"继续编辑并写回原文件"。这一层能覆盖到的用户，
浏览器里根本不需要留副本，隐私面最小。Safari/Firefox 无此能力，所以它只能是增量。

**二期：`/history` 完整管理页**
路由页、分页、标题搜索、单条删除、清空、双语落地页契约（sitemap / llms.txt / 首页卡片）。
因为一期的数据层已经是最终形态，这一期基本只是 UI。

**三期（仅当一期数据说明全量导出太贵）**
DOCY/XLSY 内部格式，或 changes op log 重放（y-indexeddb 那一派）。

**另一种切法**：如果你觉得"没有列表页就等于没做完"，可以把二期的**骨架**并进一期——
路由页 + 双语 + SW/headers 契约是一次性成本，早做晚做一样贵，晚做还要再跑一遍那套契约
测试；只把分页和搜索留到条目真的多起来再补。代价是一期变长，且频率参数还没实测就要定。

## 七、要固化的用例（CLAUDE.md 约定 5）

- 单测：store 的 CRUD、分页（游标或内存路径）、搜索过滤、保留策略的淘汰顺序、
  `QuotaExceededError` 的降级路径、embed/只读不写历史的判定。
- E2E（真实编辑器）：编辑 → 等一拍自动保存 → reload → 恢复后内容一致；
  历史页的分页/搜索/删除/清空；`?open=history` 打开后继续编辑仍覆盖同一条。
- `beforeunload`：有未保存改动时拦截、无改动时不拦截（Playwright 可用 dialog 事件断言）。
- 多标签互斥：两个 page 开同一 id，只有一个在写快照。
- 删除与清空：删除后元数据与字节都取不到（不是只从列表里消失）。
- **反向验证**：把自动保存的写入摘掉，reload 恢复用例必须变红；把保留策略摘掉，
  配额用例必须变红。结论写进 PR 说明。

## 八、还没答的问题

1. 一次 `asc_DownloadAs` 在典型 docx/xlsx/pptx 上要多久、内存峰值多少（跑语料就有）。
2. `DOCY`/`XLSY` 是否绕过 x2t、产物能否重新打开、体积比 docx 大多少。
3. PDF、只读、新建空文档要不要进历史（我倾向：新建要，只读不要，PDF 看它是否可编辑）。
4. `visibilitychange → hidden` 那一拍在移动端到底还剩多少时间能跑完一次导出（要实测，
   不够的话移动端就得把快照间隔压短，用频率换成功率）。
5. 第 1 层（FSA 句柄）值不值得提前到一期——它对 Chromium 用户的收益比恢复点大，
   但对 Safari/Firefox 用户是零。

## 参考

- [Local Storage and Auto-Save | excalidraw/excalidraw (DeepWiki)](https://deepwiki.com/excalidraw/excalidraw/6.4-local-storage-and-auto-save)
- [Persistence • tldraw Docs](https://tldraw.dev/docs/persistence)
- [Architecture | yjs/y-indexeddb (DeepWiki)](https://deepwiki.com/yjs/y-indexeddb/2-architecture)
- [Storage quotas and eviction criteria — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Persistent storage — web.dev](https://web.dev/articles/persistent-storage)
- [Updates to Storage Policy — WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [AutoSave vs AutoRecover in Microsoft Office — Office Watch](https://office-watch.com/2025/about-microsoft-office-autosave-autorecover-and-other-save-options/)
- [Persistent permissions for the File System Access API — Chrome for Developers](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)
- [File System Access API — caniuse](https://caniuse.com/native-filesystem-api)
- [WordPress autosave / local backup restore prompt — WP Training Manual](https://wptrainingmanual.com/wordpress-tutorials/autosave-post-revisions/)
- [LocalStorage vs IndexedDB vs OPFS vs WASM-SQLite — RxDB](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html)
- [Window: beforeunload event — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [Web Locks API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
