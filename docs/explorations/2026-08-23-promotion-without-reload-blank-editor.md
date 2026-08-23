# 谁提升了 worker，谁就得负责那次 reload

日期：2026-08-23
现场：CI run 32620431825，`E2E shard 1` 的 @serial 那趟挂在
`sw-silent-update.spec.ts:92` 的 `settleEditor`，90s 超时。这条用例在本地 16s 通过，
在 CI 已经是第二次红了。

## 不是慢，是白屏

失败截图是**纯白页**。把 trace 拆开看，时间轴很清楚：

```
24.1  page.reload()            ← 测试写完新 sw.js 之后的那次刷新
24.2  console: SW registered
24.3  console: Creating new editor instance
24.35 GET /web-apps/apps/documenteditor/main/index.html  →  status -1（失败）
...   之后 90 秒什么都没有
114.3 超时
```

编辑器 iframe 自己的文档请求**失败了**，而且没有任何东西会重试它。页面就停在
"创建了编辑器实例、iframe 永远空着"的半成品状态。

请求为什么会失败：那一刻 service worker 换了人。激活新 worker 会终止旧 worker，
旧 worker 手上所有 in-flight 的 fetch 事件一起失败——其中就有这个 iframe 的导航请求。

**这本来不是问题**，因为换 worker 之后页面会 reload 一次，重新加载就好了。
问题是那次 reload 没有发生。

## 提升的判据和 reload 的判据，问的是同一个问题的两个时刻

`index.ts` 里两件事：

```ts
wireServiceWorkerUpdates(registration, hasOpenDocument, ownScriptURL);
// ...
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!shouldReloadOnControllerChange({ ..., hasOpenDocument: hasOpenDocument() })) return;
  window.location.reload();
});
```

`promoteWaitingWorker` 在 `register()` 一 resolve 就跑，而在编辑器路由上，
**那比编辑器实例存在早几百毫秒**（trace 里 SW registered 在 24.2、
Creating new editor instance 在 24.3）。于是它看到"没有文档打开"，提升。

等 `controllerchange` 真的到达时，文档已经打开了。`shouldReloadOnControllerChange`
重新问一遍 `hasOpenDocument()`，答案变成了 true，于是**拒绝 reload**——
可这时候页面早就被那次交接撕成两半了。

`promoteWaitingWorker` 的返回值一直被 `wireServiceWorkerUpdates` 丢掉，
所以页面从来不知道"是我自己让它换的"。

CLAUDE.md 里记着这条路径上相反方向的那个 bug（"打开流程排在 SW 注册之前，
`hasOpenDocument()` 永远为真，于是等待中的 worker 从不被提升"）。修好之后
竞态翻了个面：注册有时候赢，提升发生了，而修复它的 reload 被拒。

## 改法

**谁提升谁负责 reload。** `wireServiceWorkerUpdates` 多一个 `onPromoted` 回调，
真的发出 `SKIP_WAITING` 时通知调用方；`index.ts` 把标志位从 `healingStaleBuild`
改名成 `promotedFromThisTab`，两条路径（普通更新提升、静默自愈）共用它；
`shouldReloadOnControllerChange` 见到这个标志就 reload，**不再问有没有文档打开**——
只有未保存改动仍然一票否决。

理由不是偏好而是修复：交接已经发生了，拒绝 reload 不会把它撤回来，
只会把标签页留在白屏上。

## 只补第一半会变成"每次加载都刷新一次"

第一版只做了上面那件事，`E2E (Cloudflare Pages semantics)` 的
`autosave-recovery` "a reload comes back to the same document" 立刻红（重试也红，
同一分片在没有这个改动的另一个 PR 上是绿的）。

原因 CLAUDE.md 里其实写着：**"有 worker 在等"不等于"有新版本"**。厂商的编辑器 iframe
会往同一个 scope 注册它自己的 worker，一个 scope 只有一个 registration，于是脚本在
我们的 sw.js 与它之间来回换——**编辑器路由上我们的 worker 几乎每次加载都躺在
`waiting` 里，跟有没有新构建无关**。原先那条"有文档打开就不 reload"顺带当了刹车；
把它拆掉，每一次这种交接都变成一次刷新。

所以第二半：**文档在路上的时候根本不要提升**。`hasOpenDocument()` 读的是 store，
而 store 要等编辑器实例建好才有值——比 `register()` resolve 晚几百毫秒。URL 早就知道了：
`?new=` / `?file=` / `?src=` / `?open=` / `?saved=` 任意一个在，就是"这一页要开文档"。
`?embed=`／`?embedded=` 也算，而且理由更硬：嵌入模式下宿主随时可能推一个文档进来，
那次 reload 扔掉的是宿主页面的东西。

这些路由上等待的 worker 就老老实实等着——这不是丢失更新，正是静默自愈存在的那个场景，
而自愈这条路**会先用 `isUnseenBuild()` 确认真的是另一个构建**才交接，不会被厂商 worker
的来回切换骗到。

## 前两版都只猜对了一半：换掉 controller 的根本不是我们

补完上面两半，CI 还是红，同一条用例、同一处白屏。这次把网络时间轴对齐着看：

```
25.68  reload 的文档（旧 worker 服务的）
25.74  GET /sw.js            ← 浏览器例行比对，字节变了，开始 install
25.79  install 预缓存 / /index.html /editor /editor.html …
25.83  测试问 controller 是谁 → 已经是 e2e-next（reload 完成后仅 50ms）
25.96  GET .../documenteditor/main/index.html → -1
```

交接发生在 reload 之后 50 毫秒，比它杀掉的那个请求早 170 毫秒。而那时候
`promoteWaitingWorker` 因为 `documentIsExpected('?new=docx')` 根本没跑——
**换人的不是我们**。能换的有三个，只有一个跟本页面有关：

1. `sw.js` 自己在 install 里 `skipWaiting()`（`wouldDiscardVendorAssets` 为假时）；
2. 别的标签页经落地页提升；
3. **浏览器自己**——等待中的 worker 会在旧 worker 控制的客户端全部消失时自动激活，
   而一次 reload 正好安排了这件事。

所以"这一页有没有请求过这次交接"是个错的判据，它恰好漏掉了真正会发生的那几种。
`promotedFromThisTab` 与 `onPromoted` 这套管线一起删掉了。

**判据有两条，缺一条都会立刻出事。**

第一条：**必须是另一个构建**。"controller 换了"是常态——厂商 worker 的来回切换让我们的
sw.js 在普通加载里就被重装并留在 waiting，浏览器会在下一次导航时自己把它激活，
同一个构建、同一批缓存、没有任何事情发生。只按"换了就刷"做，等于每隔一次页面浏览就刷一次
（实测：一次普通 reload 之后 80 毫秒就换了人，`sw-vendor-cache-first` 当场
`Execution context was destroyed`）。判据用的还是 `isUnseenBuild` 那一条：
运行时缓存按 vendor 内容哈希命名，**在启动时**拍一张缓存名快照（不是等交接发生时再读，
那时新 worker 已经建好自己的那个了；也不去问旧 worker，它可能已经被终止）。

第二条：**不能盖掉未保存的工作**。除此之外没有别的拒绝理由。原先那条"有文档打开就不刷"
听着谨慎，其实不是：交接已经发生，拒绝刷新撤不回它，只会把人留在白屏上；
而被撕成两半的页面根本没加载完，里面没有任何未保存的东西——两者不会撞车。

**谁请求的交接不是判据**，这是第一版栽的地方：能换人的有三个，只有一个跟本页面有关
（`sw.js` 自己在 install 里 skipWaiting、别的标签页经落地页提升、
浏览器在旧 worker 的客户端全没了时自动激活）。

`documentIsExpected` 留着，它另有其用：不要往一个正在开文档的页面里塞提升（嵌入模式
理由更硬，宿主随时可能推文档进来）。

## 用例与反向验证

`test/unit/sw-update.test.ts`：`shouldReloadOnControllerChange` 现在只有两条
（有文档打开也刷新、有未保存改动不刷新），另三条钉住 `documentIsExpected`
（认得每个会挂文档的路由、把 embed 也算进去、没东西可开的页面照常接更新）。

"有文档打开也刷新"那条**特意还是把 `hasOpenDocument: true` 传进去**（经一次 cast），
因为那正是旧判据下返回 false 的那个输入——不传的话它在新旧两版实现下都是绿的，
等于没测。

反向验证：`git stash` 掉 `lib/sw-update.ts`，`shouldReloadOnControllerChange` 两条
与 `documentIsExpected` 三条分别变红。E2E `autosave-recovery`（三条）+
`sw-silent-update` + `sw-warm` 本地全绿。

E2E 这一侧两个方向都验过，**都在本地**（前几版复现不了，是因为它们碰巧没触发；
把判据写死才逼出来）：

- `isNewBuild` 恒为 `false`（等于旧的"不刷"）→ `sw-silent-update` 变红；
- 恒为 `true`（等于"换了就刷"）→ `sw-vendor-cache-first` 变红
  （`Execution context was destroyed`）。

两条都恢复正常值时，`sw-silent-update` / `sw-vendor-cache-first` / `sw-warm` ×2 /
`autosave-recovery` ×3 / `font-cache` 共 8 条全绿。

## 试过又撤掉的：让 sw.js 别为同一个构建接管

中途改过 `public/sw.js`：install 时先问 `caches.has(CORE_CACHE)`，已经装过这个构建
就不 `skipWaiting()`——理由是同一构建的接管什么也不换，却会终止旧 worker、打断它手上
的请求。单测反向验证是过的，但**本地整套 SW 用例在有没有它的情况下都全绿**，证不出必要性；
而它有一处真实代价：**回滚到这台浏览器跑过的构建**（vendor 未变那种）会因为核心缓存
同名而不再自动接管，投递就哑了——那正是字体那次 revert 踩过的场景。证不出收益、
却动了投递路径，所以撤掉。
