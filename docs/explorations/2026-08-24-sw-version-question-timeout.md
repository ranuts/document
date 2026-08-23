# 一次白屏：修复 controllerchange 之后那次刷新，被 1 秒问答判死

2026-08-24

## 现场

PR #202 合进 main 之后，main 的 CI 红了一次（PR 那次全绿），挂的是
`sw-silent-update.spec.ts`——`@serial` 那批，本地 `pnpm run test:e2e` 用
`--grep-invert @serial` 跑不到它。失败截图是**整页纯白**。

从 trace 里读出的事实链：

- console 里 `Creating new editor instance` 出现 3 次，`Document loaded` 只有 2 次；
  第三次启动之后，12 条 `[OO] …` 守卫日志**一条都没有**——它死在 `onAppReady`
  之前，也就是任何守卫装上之前。（这条同时说明与 #202 的授权改动无关：那批代码
  连跑都没跑到，且没碰任何 SW 代码。）
- 测试等 `vendorVersion === 'e2e-next'` 那一步**是过的**（挂在它后面一行的
  `settleEditor`），所以 controller 确实换过去了。
- 而 console 里再没有第四次启动——**controllerchange 之后那次 reload 从未发生**，
  页面就一直白着，直到 90 秒超时。

## 根因

`shouldReloadOnControllerChange` 的四个条件里，把它拦下的是 `isNewBuild`。
它来自 `isUnseenBuild()`，而后者第一句是：

```ts
const version = await askVersion(waiting); // 1000 ms
if (!vendorVersion || !cacheStorage) return false; // cannot tell -- do nothing
```

worker 是在 message handler 里回答 `VERSION` 的，而它在**被问到的那一刻恰好最忙**：
刚被激活、正在终止上一个 worker、页面正在重新取一整棵它还没缓存的 vendor 树。
1 秒没答上来，沉默就被当成了答案，于是"这不是新构建"→ 不刷新 → 那半个被交接
撕碎的页面永远留在白屏上。

同一个 worker，测试自己用 **3 秒**问同样的问题，是问得到的。

这个坑本身在文件里已有记载（"a worker under load does not answer within a
timeout"），但当时的教训写在**要不要提升**那一侧，改成了用缓存名做证据；
**controllerchange 这一侧仍在用 1 秒问答**，而这一侧的错误代价是不可恢复的白屏。

## 改动

新增 `askVersionPatiently()`：3 次 × 2 秒，`isUnseenBuild` 改用它。

沉默最终仍然可以决定，只是不许它提前决定。选这个而不是别的方案的理由：

- **不能改判据本身。** "有没有文档打开"早就被证明是错的判据（见
  2026-08-23-promotion-without-reload-blank-editor.md），"有没有未保存改动"在这里
  也不是原因——第三次启动是一次完整的页面重载，脏位是 false。
- **不能靠缓存名兜底。** 页面被撕碎时可能一次 vendor 请求都没成功，新 worker
  的 runtime cache 还没建出来，"出现了新缓存名"这条证据此刻并不存在。
- **多等几秒没有成本。** 这条路上唯一在等的就是一个已经白了的页面。

## 用例与反向验证

`test/unit/sw-update.test.ts` 三条新用例（用假定时器，不占实际时间）：
busy worker 漏答第一次仍被正确识别为新构建；连续不答到底仍然回落到"不动"；
默认预算不少于 3 秒。原来那条 "does not answer" 用例也改用假定时器——放弃现在
要 6 秒，会撞上 5 秒的默认用例超时。

**反向验证**：把 `askVersionPatiently` 改回 `askVersion`，只有
"keeps asking a worker that was too busy to answer the first time" 变红，其余 52 条
照常绿；改回来 53 条全绿。E2E `sw-silent-update` + `sw-warm` 本地 3 条全过。

## 遗留

CI 上那次是抖动（重跑即过），所以这条改动没有一个能稳定复现的 E2E。真正想钉死
它需要能在测试里让 worker 忙到答不出话，目前没有这样的钩子；单测那三条覆盖的是
判定逻辑本身，白屏那一段仍然只有 `sw-silent-update` 这条端到端用例在守。
