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

## 用例与反向验证

`test/unit/sw-update.test.ts` 新增四条：`onPromoted` 在到达时提升、在稍后安装后提升、
留在 waiting 时不报；以及那条竞态本身——"在提升与交接之间打开的文档也要 reload"。

另加三条钉住 `documentIsExpected`：认得每个会挂文档的路由、把 embed 也算进去、
没东西可开的页面照常接更新。

反向验证：`git stash` 掉 `lib/sw-update.ts` 与 `index.ts`，前四条同时变红
（两条因为 `onPromoted` 不存在，两条因为标志位读不到）；单独 stash `lib/sw-update.ts`，
`documentIsExpected` 三条变红。E2E `autosave-recovery`（三条）+ `sw-silent-update` +
`sw-warm` 本地全绿——其中 `autosave-recovery` 的 reload 那条正是只补第一半时红的那条。
