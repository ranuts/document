# 自动保存与本地历史：实施记录

日期：2026-08-22
分支：`feat/autosave-history`
评估文档：[2026-08-22-autosave-history-evaluation.md](./2026-08-22-autosave-history-evaluation.md)

## 做了什么

评估里排的四层防线，这轮落了三层半：

| 层                           | 状态                                                                   |
| ---------------------------- | ---------------------------------------------------------------------- |
| 第 0 层 离开前拦截           | 已做（`lib/unsaved-guard.ts`），另带出 vendor 冲突一处（见下）         |
| 第 1 层 写回磁盘（FSA 句柄） | **未做**，留在评估文档里的"一期半"                                     |
| 第 2 层 浏览器内恢复点       | 已做（`lib/history/`，两个 store、保留策略、配额降级、Web Locks 互斥） |
| 第 3 层 找回入口             | 已做（编辑器恢复条、落地页"继续编辑"、`/history` 完整管理页）          |

外加评估当时没写、由用户在实施中提出的两条，都属于"没有它这个功能是错的"：

- **文档身份用 id，不用标题**（下面第三节）
- **七天自动清除**，且必须写在用户看得见的地方（下面第四节）

## 一、第 0 层带出的问题：vendor 也挂了 beforeunload

加完 `beforeunload` 守卫，E2E 的 L0 fixture 立刻红了一条：

```
Blocked attempt to show multiple 'beforeunload' confirmation panels for a single navigation.
```

查 vendor：`web-apps/apps/documenteditor/main/app.js` 在可编辑时会
`window.onbeforeunload = onBeforeUnload`——编辑器 iframe 里本来就有一个。

重复只是症状，真问题是**哪一个说的是真话**。vendor 那个读的是 SDK 自己的
"document modified" 账本，而守卫 5（serverless save）把 Save/Ctrl+S 改道到
`asc_DownloadAs`，SDK 的账本永远不知道文档已经保存了——于是用户存过盘之后它照样弹。
那是训练用户"闭着眼睛点确认"的最快方法。

所以加了**守卫 11**（`guards/unload-prompt.ts`）：用 `defineProperty` 吃掉 frame 里的赋值，
让宿主窗口成为唯一发声的一方；宿主那个是被真实导出清掉的。

## 二、存储层的两个非显然选择

**快照存 `Uint8Array` 而不是 `Blob`。** 评估文档原本推荐 Blob（浏览器可以不把它读进 JS 堆）。
写单测时发现 fake-indexeddb 不能忠实往返 Blob（读回来的对象没有原型），这本来只是测试问题，
但顺着想了一遍：字节从编辑器 frame 过来就是 ArrayBuffer，回去也是 ArrayBuffer，
Blob 只是在入口包一层、出口再异步拆一层。改存 typed array，少一次转换，
且它是所有 structured clone 实现都忠实往返的形状。评估文档已同步更正。

**标题搜索在内存里做。** IndexedDB 的 key range 只能前缀匹配——"report" 匹配不到
"Quarterly Report"，中文更是完全没戏。元数据每条不到 1 KB，全量读出来 `includes()`
既简单又更强。E2E 里专门有一条用中文子串钉住。

## 三、身份：id 而不是标题（实施中修正）

第一版用 `findDocByTitle` 复用行：同名文件继续写同一条历史。用户当场指出这不成立——
标题会重复。确实：两个人各有一个 `Report.docx`，一个人还有去年那份，而**每个新建空文档
都叫 `New_Document.docx`**。按名字复用等于把无关文档的历史合并到一行。

改成：会话在编辑器挂载之前就 mint 一个 id（`lib/history/session.ts`），
并 `replaceState` 写进地址栏 `?doc=<id>`。id 是编辑器、历史页、恢复条三方共同的"这一篇"，
标题退回成标签。

这条改动顺手修掉一个真实的丢失场景：**刷新 `?new=docx` 原本会新开一个空白文档**，
刚才的编辑只能靠恢复条找回；现在 `?doc=<id>` 直接把最新快照打开在原地。
E2E `autosave-recovery.spec.ts` 的第二条用例钉的就是这个（刷新后 id 不变、历史仍是一行、
输入的句子还在）。

**一行 = 一次编辑会话**，而不是"一个文件永远一行"。同一个文件今天明天各编辑一次会是两行。
这与恢复点的语义一致，也让"两个同名文件"永远不会撞车；行数由七天窗口 + 每篇 3 个 rev +
LRU 预算一起兜底。另外，**只打开不编辑不会留下任何行**——行是第一次快照才创建的。

## 四、七天，以及把它说出来

保留窗口从 `max(updatedAt, lastOpenedAt)` 起算七天，因此一份一直在用的文档不会在用户手里过期。
清除发生在三个地方，缺一个这条规则就名不副实：应用启动时、每次写快照时（同一事务内，
先清过期再算预算）、历史页打开时。

**说出来的地方比实现更要紧**，这一条是用户明确要求的：

- 首页（中英双语）hero 下面常驻一行：自动保存 + 保留 7 天 + `本地历史` 链接。
  **写在 HTML 里，不由脚本生成**——对用户数据的承诺必须对首次访问者、爬虫、
  关掉 JS 的人同样成立。`history-recent.js` 只负责在本机确实存有内容时补一段"继续编辑 X"。
- 历史页顶部重复规则，**每一行还各带自己的倒计时**（"3 天后清除"）。
  "这个能不能靠"是对着某一篇文档问的，不是对着功能问的。

## 五、四个踩到的坑（都会把"没测到"伪装成"绿"）

1. **fake timers 会卡死 fake-indexeddb**。它的事务走宏任务队列，`vi.useFakeTimers()`
   一开，`await putSnapshot()` 永远不 resolve，表现为测试超时而不是报错。
   过期用例改用 `vi.useFakeTimers({ toFake: ['Date'] })`，只伪造时钟。
2. **单调时钟跨测试泄漏**。`stamp()` 保证 `updatedAt` 严格递增（同毫秒批量写入时列表顺序
   才稳定），但它是模块级的，只增不减。一条把系统时间推后七天的用例，会让**之后每一条**
   用例写入的记录都带着未来的时间戳，于是再也没有东西看起来过期。加了
   `resetHistoryClockForTests()`，三个历史相关测试文件的 `wipe()` 都调它。
3. **E2E 的 120 秒窗口让用例失去意义**。`autosave-recovery` 第一版等快照等 120s，
   而周期性 tick 是 90s——所以无论 `visibilitychange` 那条分支在不在，用例都会绿。
   反向验证（删掉 hidden 快照）一次就抓出来了：删了还是绿，只是从 8 秒变成 1.6 分钟。
   窗口收到 45s（明确小于 SNAPSHOT_INTERVAL_MS）之后才真正钉住它要钉的分支。
4. **preview 服务器复用旧构建**（CLAUDE.md 早有记载，还是踩了）：四条新用例同时红，
   页面 DOM 是上一轮的。`lsof -ti :4176 | xargs kill -9` + 删掉 `dist-e2e-4176/` 后全绿。
   凡是"一改就全灭"，先怀疑跑道。

## 六、反向验证（约定 3）

每条都是"去掉修复 → 恰好一条用例变红 → 恢复 → 全绿"：

| 去掉什么                                           | 变红的用例                                                 |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `beforeunload` 里的 `preventDefault()/returnValue` | blocks unload once the editor reports an edit              |
| 每篇 3 个 rev 的裁剪                               | keeps only the newest revisions…                           |
| 预算淘汰                                           | evicts the least-recently-opened document…                 |
| `clearAllHistory` 里的 blob clear                  | clears the library, bytes included                         |
| 配额失败后的淘汰重试                               | makes room and retries once…                               |
| `getRecoverableDoc` 的 dismissed 判定              | remembers a dismissal…                                     |
| `getRecoverableDoc` 的 savedToDisk 判定            | says nothing about a document that was saved to disk       |
| `restoreDocument` 传回的 historyId                 | reopens the newest snapshot through the ordinary open path |
| `visibilitychange` 快照                            | E2E: edits survive the tab going away（45s 窗口下）        |
| 历史页的过期清扫                                   | E2E: deletes documents past the retention window           |

## 七、没做的和下一步

- **第 1 层（File System Access 句柄）没做**。对 Chromium 桌面用户，它的收益比恢复点还大
  （文件直接写回磁盘、浏览器里根本不留副本），Safari/Firefox 则完全没有。留作增量。
- **导出成本仍未量化**。评估里说"一期最该先量的东西"，这轮只观察到本地 preview 上一次
  `visibilitychange` 快照到落库是秒级；真实语料上的 p50/p95 还没跑（`bin/corpus-report.mjs`
  已有那一栏）。90s 的间隔是拍脑袋的起步值，量完再调。
- **DOCY/XLSY 内部格式**（跳过 x2t 的可能路径）仍未验证，条件同上。
- 移动端 `visibilitychange → hidden` 到进程被杀之间到底还剩多少时间，没测。
