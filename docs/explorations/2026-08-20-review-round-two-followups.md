# Review 第二轮：#144 那批改动的七条追补（2026-08-20）

第一轮追补见
[2026-08-20-review-followups.md](2026-08-20-review-followups.md)；那之后又对整个
分支通读了一遍，记下这七条。CDN 抖动那条单独成文
（[2026-08-20-x2t-wasm-fetch-transient-retry.md](2026-08-20-x2t-wasm-fetch-transient-retry.md)），
这里是其余六条 + 一条纯文案回退。

## 1. 圆形按钮靠宿主页的 reset 撑着，包自己不自足

拆掉 Tailwind 后补的 `button { padding: 0; box-sizing: border-box }` 修好了
`.agent-launcher` 的 60×50 椭圆。但同样形状的 `.cui-send` /
`.cui-scroll-bottom` 住在 `@ranuts/chat-ui` 里——它们「定宽高 32px +
border-radius: 50%」，圆不圆取决于**宿主页**有没有那条 reset。生态里另一个站点
引这个包、没有同样的 reset，就会原样复现同一个椭圆，而且没有任何东西会提醒它。

修法：把 `box-sizing: border-box; padding: 0` 写进这两条规则自身。本仓的全局
reset 保留，作为页面级兜底（`.agent-launcher` 等本仓元素仍然靠它）。

## 2. `@ranuts/converter` 的 `loadScript` 把失败原因吞了

```ts
} catch (error) {
  const errorMsg = 'Failed to load X2T WASM script';
  console.error(errorMsg, error);
  throw new Error(errorMsg);   // ← 原因没了
}
```

这次改动刚刚立下的契约是「失败消息要带得动原因，宿主的
`classifyOpenFailure` 按消息文本分类」。而 `Failed to load X2T WASM script`
一个关键词都不匹配，落到默认分支 `document`——于是 buffered 兜底路径上的
CDN 500 或者内存拒绝，会被当成「文件可能已损坏」报给用户，还不重试。
vendor 那份 helper 是原样重抛的，两份实现说好语义一致，这里破了。

修法：`throw new Error(\`Failed to load X2T WASM script: ${cause}\`, { cause: error })`。

## 3. 内存诊断探测自己要 283 MB，而且一次失败会探两遍

`probeX2tMemory` 的 commit 半段是真向浏览器提交 x2t 的整个堆——跑在一台刚刚
拒绝过这笔分配的机器上。`skipCommit` 只挡住「重开在飞」那条路，而一次失败的
打开**会两次走到 toast**（守卫把 rejection 送进 `asc_onError` 一次，vendor 自己
再为同一个失败报一次 -82），所以最终报错那一刻会连着要两次 283 MB。

修法：浏览器一旦拒绝过 commit，本 session 内不再问（`commitRefused`），直接复用
那个结论；`registerOpenAttempt` 在用户发起新的一次打开时清掉它——那是新情况，
用户可能刚照提示关了几个标签页，值得重新问。

## 4. 「只要还有第二个窗口就不提升 worker」太粗

落地页提升等待中的 worker 前会问 active worker「你控制着几个窗口」，只有回答
1 才提升。可它拒绝的其实是**任何**第二个窗口，包括另一个落地页标签——而落地页
没有任何会被激活毁掉的会话。习惯常开两个本站标签页的人，因此永远拿不到新版本。

worker 侧本来就拿得到 `client.url`。现在回答里多带一个 `editors`（路径匹配
`/editor` 或 `/editor.html` 的窗口数），落地页只在 `editors === 0` 时提升；
是否开着文档仍然不可知，所以任何编辑器窗口都算拦。旧 worker 的回答里没有这个
字段，那种情况回落到原来的「我是不是唯一窗口」。

## 5. install 的判据与 activate 之间有一道缝

`wouldDiscardVendorAssets` 在 **install** 求值，`activate` 紧接着就删掉名字不
匹配的 runtime cache。这中间旧构建的页面完全可能刚把第一批 vendor 条目写进
它自己的 cache——install 那一刻看到的是空的，于是放行；到 activate 就把它删了，
正是这条判据要防的混版。

修法：删之前再问一次（`holdsVendorAssetsForOpenWindow`）。代价是每个陈旧
cache 一次 `keys()`，把窗口缩到「这次读」和「这次删」之间。没有窗口打开时照删
不误——那时没人会被伤到。

## 6. i18n 里混进了与本次改动无关的润色，韩语那条还改错了

`API가` 被改成 `API 가`（韩语助词不空格），新加的韩语文案也带同样的
「括号后加空格」习惯。日语几处 `: `→`：` 无害但同样无关。全部回退/修正，
新韩语文案改成 `메모리(약 {mb} MB)를` / `64비트`。

## 7. `VENDOR_VERSION` 其实是「路径 + 内容」哈希

`shasum` 会把路径打印在摘要旁边，而 `find "$DIST_DIR/sdkjs" ...` 传的是带
`$DIST_DIR` 前缀的路径——于是同一棵 vendor 树，构建到 `dist/` 和构建到
`dist-e2e-4174/` 会得到两个不同的 runtime cache 名。生产只有一个 DIST_DIR，
所以不影响线上，但注释和 CLAUDE.md 都写的是「内容哈希」。改成
`cd "$DIST_DIR" && find sdkjs web-apps fonts ...`，名副其实。

## 用例与反向验证

| 修复 | 用例                                                                                    | 去掉修复后    |
| ---- | --------------------------------------------------------------------------------------- | ------------- |
| 1    | `styles-contract`：包内两条规则各自声明 border-box + padding 0                          | 2 red         |
| 2    | `converter-wasm-loading`：buffered 路径 404，`loadScript` 的消息要带原文                | 1 red         |
| 3    | `onlyoffice-wasm-memory`：拒绝过就不再问；`resetMemoryProbe` 后再问                     | 1 red         |
| 4    | `sw-register`：editors>0 拦、第二个落地页照提升、旧回答回落；sw.js 源钉 + `sw-warm` E2E | 1 red（源钉） |
| 5    | `sw-update`：陈旧 cache 有 vendor 条目且有窗口时不删；没窗口照删；core cache 照删       | 1 red         |
| 7    | `sw-update`：`VENDOR_VERSION=$(cd "$DIST_DIR" && find …)`                               | 1 red         |

第 4 条的页面侧行为（第二个落地页照提升）用假 controller 测，去掉 sw.js 那半不会
让它变红——变红的是钉 sw.js 源的那条，加上 `sw-warm` 里对真实 worker 回答
`{count, editors}` 的断言。第 6 条是纯文案回退，没有用例。
