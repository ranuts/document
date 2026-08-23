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

## 用例与反向验证

`test/unit/sw-update.test.ts` 新增四条：`onPromoted` 在到达时提升、在稍后安装后提升、
留在 waiting 时不报；以及那条竞态本身——"在提升与交接之间打开的文档也要 reload"。

反向验证：`git stash` 掉 `lib/sw-update.ts` 与 `index.ts` 的改动，四条同时变红
（其中两条是因为 `onPromoted` 根本不存在，另两条是因为标志位读不到）。
E2E `sw-silent-update` + `sw-warm` 本地全绿。
