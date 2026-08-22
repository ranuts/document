# 用户刷新拿不到新版本，以及加载时露出来的那排按钮

日期：2026-08-22
相关：`lib/sw-update.ts`、`lib/update-prompt.ts`、`index.ts`、`styles/base.css`
前情：[SW 更新从不提升](2026-08-20-service-worker-update-never-promoted.md)、
[字体替换](2026-08-22-font-substitution-solved.md)

## 起因

字体替换（PR #184）上线并实测通过之后，用户仍然看到满屏乱码：

```
Qjgbc rgjc / Qjgbc qs`rgjc / Ajgai rm_bb l mrcq
```

把 PR #170（当天早上被 revert 的那版）的 `public/` 检出到本地跑同一个页面，得到
**逐字相同**的乱码 —— 所以那不是当前线上，是**缓存在浏览器里的旧构建**。用户用无痕
窗口打开是正常的，普通窗口**刷新也没用**。

## 一、为什么刷新没用

`sw.js` 在 vendor 变化时刻意不 `skipWaiting()`：激活会删掉上一版 vendor 缓存，而
仍在跑旧版的页面之后惰性加载 sdk-all.js / 字体就会混版。所以提升等待中的 worker
需要有人主动请求，而现有的两条路都到不了这个用户：

| 谁负责提升                        | 条件                                  | 为什么没生效                                                                 |
| --------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| 编辑器页（`lib/sw-update.ts`）    | **没有文档打开**                      | 编辑器页几乎总是带着文档打开（`?new=` / `?file=` / `?saved=`），条件永远为假 |
| 落地页（`public/sw-register.js`） | **没有编辑器窗口**（`editors === 0`） | 用户直接进 `/editor`，根本没经过落地页                                       |

于是"直接进编辑器、开着文档"的用户没有任何出路：刷新只会让旧 worker 再服务一次旧
构建。这不是理论问题——被 revert 掉的构建就这样在用户屏幕上留了一整天，而它引用的
字体已经从源站删掉了，于是显示为乱码。

## 二、修法：让页面自己悄悄换过去

用户的要求是"尽量不要打扰，别弹提示"。这条路走得通，因为**卡住的标签页跑的其实是新
代码**：导航请求走 network-first，HTML 和 app bundle 都是新的；旧的只有 worker 从
自己缓存里 cache-first 喂出来的那棵 vendor 树。所以新代码有机会自己把这件事办了。

`healStaleController()`（`lib/sw-update.ts`）在启动时做三件事：

1. 等待中的 worker 得是**我们自己的**（比对脚本 URL，理由见下一节）；
2. 它得是**这台浏览器没跑过的构建**；
3. 满足前两条就 `postMessage(SKIP_WAITING)`，接管后 reload 一次。

**每个标签页只做一次**（sessionStorage 记住，杜绝 reload 循环），**有未保存改动时
不做**（`shouldReloadOnControllerChange` 里判），而这一切发生在启动那一刻——那时用户
还没输入任何东西，代价就是加载多一秒。

### "有 worker 在等"根本不等于"有新版本"

第一版通知在 E2E 里每次都弹，还带崩了两条用例。查下去发现一件之前没人注意的事：

**厂商的编辑器 iframe 会往同一个 scope 里注册它自己的 worker**
（`/document_editor_service_worker.js`，本仓库把它换成了一个空 stub）。一个 scope
只有一个 registration，于是这个 scope 的脚本在"我们的 sw.js"和"厂商的 stub"之间
来回换：

```
打开 /            active=/sw.js   waiting=null
打开 /editor      active=/sw.js   waiting=/document_editor_service_worker.js
再刷新一次        active=/sw.js   waiting=/sw.js      ← 我们自己又被装了一遍
```

两个后果，都真实存在：

1. **谁去提升等待中的 worker，就可能把整个源站交给那个空 stub**——
   `promoteWaitingWorker()`（编辑器页）与 `maybePromote()`（落地页）原本都只看
   "有没有 waiting"。空 worker 接管之后 vendor 树不再 cache-first，编辑器甚至可能
   直接加载失败。这是本轮之前就存在的隐患，现在两处都比对脚本 URL，不是自己的就不碰。
2. **"有 waiting"永远为真**，所以判据不能是它。

### 判据不是"问一句"，是"看证据"

第二版去问：给等待中的 worker 和**当前控制页面的 worker** 各发一条 `VERSION` 消息
（`sw.js` 新增的 handler，回 `cacheVersion` / `vendorVersion`），版本不同才算新构建；
控制方要是不回话，就当它老到还没有这个 handler。

**这一版是错的，而且错得很典型**：并发跑五个 WASM 编辑器时，控制方经常在 1 秒超时内
回不过来。沉默被读成"它是旧的"，页面于是自己 skipWaiting + reload，测试跑到一半整页
刷新——表现为"编辑器没起来"。全量 E2E 稳定挂 2 条，而基线（同一台机器、同样并发）
121 条全绿；把这段接线关掉，122 条全绿且快了两分半。

第三版不问对方，看**本地证据**：`sw.js` 的运行时缓存是按 vendor 内容哈希命名的
（`document-editor-runtime-<vendorVersion>`），所以"这台浏览器有没有那个构建的缓存"
本身就是答案。只问等待中的 worker（它是新代码，一定答得上），拿到 vendorVersion 后
在本地 `caches.keys()` 里找：

- 找得到 → 这个构建这台机器跑过 → 什么都不做（就是上面那种"同构建被重装"）；
- 找不到 → 没跑过 → 换过去；
- 它不回话，或者本地压根还没有运行时缓存 → **什么都不做**。宁可这一次加载还用旧的，
  下一次再说：默认值取"沉默 = 不动"，正是第二版翻车的教训。

## 三、加载时露出来的那排按钮

同一张截图里还有第二个问题：`?new=docx&saved=<id>` 加载期间，屏幕中间是
"View/Edit Document / New Word / New Excel / New PowerPoint"。

根因不是 CSS，是顺序：`createControlPanel()` 在 boot 时就把面板**可见地**建出来，
只有等文档接管后才 `hideControlPanel()`。实测：

```
?new=docx                 t+0ms  opacity=0     （几乎看不见）
?new=docx&saved=<id>      t+0ms  opacity=1     t+200ms 才开始淡出
```

`?saved=` 那条路要先动态 import `history/store` 与 `history/recovery` 再决定开什么，
于是可见窗口被拉长；线上冷加载更长，就成了截图里那样。

修法：**URL 已经指明要打开什么时，面板从一开始就不渲染**。index.ts 在建面板之前
读一次 query（`?file` / `?src` / `?new` / `?saved` / `?open=local`），给 body 加
`opening-document`，CSS 据此 `display: none`；真的回到主页状态时
`showControlPanel()` 再把这个类摘掉。

## 用例与反向验证

| 用例                                                                                                                     | 反向验证                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `test/unit/sw-update.test.ts` 的 `onWaitingWorker` 四条（三种到达方式 + 没有新 worker）                                  | 删掉 `updatefound` 那一支 → "reports one that turns up after the page has loaded" 变红         |
| `test/unit/update-prompt.test.ts` 五条（出现一次、点刷新会 SKIP_WAITING、接管后 reload 一次、超时兜底、忽略不动 worker） | —                                                                                              |
| `test/e2e/entry-paths.spec.ts` 的"the home-state panel never shows while a named document loads"（从首帧起连采 12 次）   | 去掉 `opening-document` 那一行 → 用例报 `the panel was painted while the document was loading` |

## 给下一个人

- 面板默认可见这件事本身是个坑：任何新的"启动时决定开什么"的入口（新的 query 参数、
  新的恢复路径）都要记得进 `opensSomething` 的判断，否则又会闪一下。
- **不要用"对方回不回话"当判据。** 超时只说明它忙，不说明它旧。这条一次就够贵了。
- 静默 reload 只在启动那一刻做，且有未保存改动时不做。要是以后想扩到"用户用到一半
  也自动换"，先想清楚丢的是谁的东西。
- **已经卡在旧构建上的用户，这段代码也救得了他们**——导航是 network-first，他们下一次
  刷新拿到的 HTML 和 bundle 就是新的，这段逻辑随之运行。真正救不了的是"从不刷新"的
  标签页。
- **删除 vendor 资源的部署仍然要额外小心**：老客户端的注册表指着已经不存在的文件，
  在它自愈之前那一屏就是坏的（本轮就是字体乱码）。删文件的那次部署，最好同时接受
  "所有老标签页会自动刷新一次"。
