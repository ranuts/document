# 等待中的 Service Worker 从不被提升——修好的东西发不出去

日期：2026-08-20 · 分支：main · 相关：[#144](https://github.com/ranuts/document/issues/144)、

> 状态与"别再试这些"清单看一页纸：[docs/changelogs/2026-08-20-issue-144-memory-and-delivery.md](../changelogs/2026-08-20-issue-144-memory-and-delivery.md)
> [同日的 x2t OOM 排查](2026-08-20-x2t-wasm-oom-misclassified.md)

## 一句话

`sw.js` 刻意不在 install 里 `skipWaiting()`，改由页面在安全的时机请求切换；
但那个"页面"在 2026-08-16 路由拆分之后**不存在了**。等待中的 worker 于是从不被
提升：用户要关掉本站所有标签页才会拿到新版本。

## 怎么发现的

不是从代码读出来的，是被 #144 逼出来的：那位报告人 08-19 说"我已重拉 Docker
镜像，但错误依旧"，08-20 只有在**无痕窗口**里才拿到带真实原因的新提示。既然
无痕能看到新代码、正常窗口看不到，就得回答一句："这次修完，他还要不要再来一次
无痕？"顺着这个问题查下去，才发现闸门根本没人开。

## 机制

`sw.js` 的 install 里写得很清楚（这段注释是对的，问题在别处）：

> No skipWaiting() here. Activating immediately deletes the previous build's
> runtime cache while pages of that build are still open ... The page asks for
> the switch (SKIP_WAITING below) only when no document is open.

所以"谁来请求切换"是这套设计的关键一环。三条证据说明它本来该由落地页承担：

1. `index.html` 里那段注释：_"the update policy lives with the editor
   (lib/sw-update.ts), where a document may be open"_；
2. `sw-update.test.ts` 有一条用例就叫 _"promotes a worker that finishes
   installing later (**landing page**, nothing open)"_；
3. `sw-update.ts` 的注释：_"activates on the next visit, when **the landing
   page** calls this again"_。

而实际情况：

| 页面                  | 现状（修复前）                                        |
| --------------------- | ----------------------------------------------------- |
| `/`（index.html）     | 只有一句裸 `register('./sw.js')`，**从不提升**        |
| `/zh-CN/`（中文首页） | **连 register 都没有**                                |
| `/editor`（index.ts） | 有 `wireServiceWorkerUpdates`，但闸门永远关着（见下） |

编辑器页那道闸为什么永远关着——是顺序问题：

- 打开流程在 [index.ts:129-155](../../index.ts#L129-L155)，SW 注册在**第 160 行之后**；
- `?new=` 走的 `onCreateNew` **同步**就 `setDocmentObj({fileName})`；
- `hasOpenDocument = () => Boolean(getDocmentObj().fileName)` 于是在
  `register().then()` 的回调里已经为真（`?file=` / `?open=local` 是竞态，同样不可靠）；
- 且 `/editor` 空手进来会 `location.replace('/')`，所以"编辑器页没有文档"这个
  状态基本不存在。

路由拆分（2026-08-16）把 `/` 变成不带 bundle 的静态页，`lib/sw-update.ts` 只剩
编辑器页在跑——**意图和实现就在那次拆分里分叉了，而且没有任何用例会因此变红**。

## 修法

把落地页那一侧补上：新增 `public/sw-register.js`（纯 JS——落地页不带 bundle），
`/` 与 `/zh-CN/` 各挂一行 `<script src="/sw-register.js" defer>`。

它做三件事：register、提升已在等待的 worker、以及监听 `updatefound` →
`installed` 后再提升。

**提升前多问一句。** 落地页自己没有文档，但**别的标签页可能有**，而激活会删掉
那一版的缓存。页面看不见别的 client，worker 能——所以 `sw.js` 新增一条
`CLIENT_COUNT` 应答（经 `MessageChannel` 的 port 回话，`clients.matchAll({type:
'window'})`），落地页只在"我是唯一窗口"时才提升；问不到答案（没有 controller、
或超时 1s）就不提升。这样既让更新发得出去，又保住了当初移除 `skipWaiting()` 想
保护的东西。

两个容易踩的点：

- **必须用绝对路径 `/sw.js`**：从 `/zh-CN/` 用 `'./sw.js'` 会把 worker 的 scope
  变成 `/zh-CN/`。
- `sw-register.js` 是"固定名、随部署变化"的文件，**必须同时**进 `_headers` 的
  no-cache 组与 `sw.js` 的 `DEPLOY_COUPLED`——否则这个脚本自己被缓存住，修复
  自我失效。`sws.toml` 的默认 `**` 已是 no-cache，无需另加。

## 用例（全部反向验证过）

`test/unit/sw-register.test.ts` **直接 eval 出货的那个文件**，而不是抄一份逻辑
（`sw-routing.test.ts` 就是靠手抄副本保持同步的，抄本一漂移就什么都测不到）。
文件因此暴露一个 `__createSwUpdater` 接缝，注释里写明了原因。

| 用例                                                                                        | 反向验证结论                                                     |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `maybePromote`：唯一窗口才提升 / 有第二个窗口拒绝 / 数不出来拒绝 / 没有 waiting 是 no-op    | 删掉 `count === null \|\| count > 1` 判断 → 2 条红               |
| `countClients`：有 controller 报数、无 controller 为 null、worker 不应答超时也为 null       | —                                                                |
| `wire`：页面加载后才装好的 worker 也会被提升                                                | —                                                                |
| `start`：注册的是绝对 `/sw.js`；注册失败不影响落地页                                        | —                                                                |
| 契约：两个首页都加载 `sw-register.js`，且不再有裸 `serviceWorker.register`                  | 落地页回退成裸 register → 2 条红                                 |
| 契约：`sw.js` 应答 `CLIENT_COUNT`                                                           | 删掉应答 → 单测红 **且** E2E 红（`Expected: 1, Received: null`） |
| `sw-warm.spec.ts`：真实 worker 上跑 `CLIENT_COUNT`——独自为 1、开第二个窗口 >1、关掉又回到 1 | 同上                                                             |
| `hosting-contract.test.ts`：`/sw-register.js` 在 no-cache 组                                | —                                                                |

## 影响

这次的 x2t OOM 修复（以及以后每次修复）会在**下一次访问落地页**时到达用户，
不再需要无痕窗口或关掉全部标签页。对 #144 的报告人：请他仍用无痕窗口验证**这
一次**（他现在跑的旧构建里没有这个提升逻辑），此后就不必了。

## 彻底修复：runtime cache 按 vendor 内容命名，而不是按构建戳

上面那半是把"谁来提升"补回来。但**为什么每次部署都需要有人提升**才是根：

```js
const CACHE_VERSION = 'SW_VERSION_PLACEHOLDER' ...;               // bin/build.sh 注入时间戳
const RUNTIME_CACHE = `document-editor-runtime-${CACHE_VERSION}`; // ← 根在这一行
```

`activate()` 会删掉所有名字不匹配的 cache。runtime cache 按**构建时间戳**命名，
意味着**每次部署都换名字、都要删掉上一版的 vendor 缓存**——所以"激活会抽走开着的
编辑器的引擎资源"这件事在每次部署都成立，即使这次一个字节的 vendor 都没动。安全
约束被无条件地施加到了所有部署上，协调需求是这么被凭空造出来的。

**修法**：core cache 继续用构建戳（HTML 走 network-first，删了无害），runtime cache
改用 **vendor 树内容哈希**：

```js
const CORE_CACHE = `document-editor-core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `document-editor-runtime-${VENDOR_VERSION}`;

const wouldDiscardVendorAssets = (names) => names.some((n) => n.startsWith(RUNTIME_PREFIX) && n !== RUNTIME_CACHE);
```

install 里据此决定：

| 情形                                          | 判据                                 | 行为                 |
| --------------------------------------------- | ------------------------------------ | -------------------- |
| 首次安装 / 只看过落地页（没有 runtime cache） | 没有别的 vendor 缓存                 | **立即接管**         |
| 改了 app 代码、没动 vendor（绝大多数部署）    | runtime cache 名字与我相同           | **立即接管**         |
| 只剩旧的 core cache                           | core 可随时丢弃                      | **立即接管**         |
| vendor 真变了（v9 bump，很少）                | 存在别的 vendor 版本的 runtime cache | 等待，走上面那条慢路 |

**关键性质：这个判断不需要旧 worker 配合。** 跨 worker 的协议在引入它的那次部署上
必然失效——旧的一侧从没带过它——所以 `CLIENT_COUNT` 握手不可能是唯一机制。新 worker
只看 `caches.keys()`，自己就能判断，于是从此每次普通部署都自动生效。

`VENDOR_VERSION` 由 `bin/build.sh` 注入：对 `dist/{sdkjs,web-apps,fonts}` 排序后逐
文件内容哈希再总哈希。三个细节都是踩出来的——

- 取**内容**而不是路径+大小：我们自己的补丁就住在 vendor 树里（`x2t_helper.js`），
  只看大小会漏掉。
- `find -exec … +` 而不是管道给 xargs：vendor 里真有带空格的文件名
  （`05_green leaf.pptx`）。
- 只用 POSIX 构造：`package.json` 用 `sh` 跑它，而 Cloudflare 镜像上 `/bin/sh` 是
  dash（build.sh 里已有一条被 bashism 坑过的注释）。

实测：2610 个文件 / 616 MB 约 1.8 s；同一份 vendor 连续两次构建得到同一个值，而
timestamp 在变（`1787204432` → `1787204443`，vendor 均为 `739c3b553007`）——
这正是必须验证的性质，否则又退化成时间戳。

用例（同样反向验证）：`sw-update.test.ts` 把出货的 `sw.js` **eval 进一个假的
ServiceWorkerGlobalScope**，直接驱动真实 install 处理器跑上表四种情形，比切源码字符串
强得多（旧那条 "install 里没有 skipWaiting" 的文本断言已被它取代）。
`sw-warm.spec.ts` 再在真实浏览器里钉一条：runtime cache 的名字必须等于从
`/sw.js` 读出的 vendor 戳——退回按构建戳命名时它报
`Received: "document-editor-runtime-dev-1787204831554"`，时间戳漏进缓存名一眼可见。
另有契约钉住 `bin/build.sh` 确实替换了 `VENDOR_VERSION_PLACEHOLDER`（漏替换的话
所有部署会共用字面量 `dev`，真的 vendor 变更反而会被旧 vendor 的缓存服务）。

## 没做的事

- **这一次仍要迈过去**：带来"以后自动接管"能力的那个 `sw.js` 自己得先激活一次。
  任何改 sw.js 的方案都躲不开第一次——所以给 #144 报告人的建议不变（无痕，或关掉
  全部标签页一次）。从下一次部署起才是全自动。
- 更激进的一条路评估过并**放弃**：干脆不用 runtime cache，让 vendor 只靠 HTTP 缓存
  （`/fonts/*` 与 x2t.wasm.gz 已是 `immutable`）。那样 activate 永远没有危险可言，
  但编辑器失去离线能力，且 `sdkjs/web-apps` 的 JS（`no-cache`）每次都要回源校验。不值。
- 其余 15 个落地页（帮助页、SEO 功能页、404）仍不注册 worker。两个语言首页是
  文档里认定的入口，先覆盖它们；要不要铺开是产品决定，不是技术必需。
- 编辑器页那道闸没有改动。它现在是纯粹的保险（几乎总是关着），而更新由落地页
  负责——这正是原设计的分工。
- "另一个标签页是否真的开着文档"仍然只用"是否只有一个窗口"来近似。要精确就得让
  各 client 向 worker 报告文档状态，那是更大的协议改动，收益有限。

## 落地后的 review 修了三处（2026-08-20 同日）

三条都做了反向验证（撤掉修复 → 新用例变红 → 恢复）。

### 1. 落地页漏掉"已经 installed"的 worker

`wire()` 只处理两种到达方式：调用瞬间已 `waiting`，以及 `updatefound` 之后再
`statechange` 到 `installed`。但 `statechange` 只报**此后**的迁移：若监听挂上时
`installing.state` 已经是 `installed`（安装很快，或更新是在 `register()` 自身过程中
发现的、`updatefound` 早于 `.then(wire)`），或 `updatefound` 时 worker 已经越过
installing 进了 `waiting`（`registration.installing` 为 null），这一页的整个生命周期
内就再没人提升它——正是这个文件存在要解决的症状。

现在抽出 `watchInstalling(registration, worker)`：worker 为 null 或已 `installed` 就直接
`maybePromote`，否则挂 `statechange`；`wire()` 另外补一次"注册时已在安装中"的接管。

反向验证：恢复旧 `wire()` → 三条新用例（already installed / installing 已结束 /
wire 时安装在飞）全部变红。

### 2. runtime cache 跨部署存活了，但没人清理死条目

cache 名改成 vendor 内容哈希之后它不再随部署清空——好处正是本文的主题，代价是**再
没有人清空它**。`/assets/<hash>` 属于刚退场的构建，永远不会再被请求，却一次次部署
往里堆，顶向 `MAX_RUNTIME_ITEMS = 2000`；而 `limitCacheSize` 删的是 `keys[0]`，
`keys()` 按写入顺序，`keys[0]` 恰好是首次打开时取的 vendor 树——于是淘汰的第一批就是
x2t.wasm.gz 和字体 catalog，正是 cache-first 分支要保的那几 MB。

两处补偿：`activate()` 末尾 `pruneAppAssets(RUNTIME_CACHE)` 删掉全部非 vendor 条目
（代价是每次激活后 app 资源各一次校验请求，而部署本来就要重取）；`limitCacheSize`
淘汰时优先挑非 vendor 条目，只有全是 vendor 时才退回 `keys[0]`。`VENDOR_ASSET` 的目录
列表与 `bin/build.sh` 参与 `VENDOR_VERSION` 的目录由用例钉在一起。

反向验证：去掉 activate 的 prune → "drops the outgoing app build from the runtime
cache" 变红；把淘汰改回 `keys[0]` → "trims an app asset rather than the vendor binary
the trim was protecting" 变红。

### 3. 两处注释还在说"sw.js 不会 skipWaiting"

`lib/sw-update.ts` 与 `public/sw-register.js` 的文件头都还写着旧不变式，而 `sw.js`
这次刚改成"不会丢弃 vendor 资产时就直接 `skipWaiting()`"。这两段注释是三处协作策略的
入口说明，说错了会误导下一次改动，已改为按 `wouldDiscardVendorAssets` 描述。

### 附：prune 自己带出来的二阶问题

第一版 `pruneAppAssets` 直接 `caches.open(name)`——而 `open` 会**创建**。于是只逛过
落地页、本来没有 runtime cache 的访客，激活后凭空多出一个空的；下一次 vendor 真的
变更时，`wouldDiscardVendorAssets` 读到"存在别的 vendor 版本的 runtime cache"，
判定有东西可丢而继续等待——正好把本文要终结的失败模式，重新装到最没有东西可丢的那类
访客身上。现在先问 `caches.has(name)`，不存在就什么都不做。

反向验证：去掉 `has` 判断 → "does not conjure a runtime cache for a visitor who has
none" 变红。

## Review 复盘（同日，改动尚未提交）

上面三处落地后又过了一遍 diff，SW 这一侧还有三个问题，都是"修复本身留下的"。

### A. 判据按名字看，两个方向都错

`wouldDiscardVendorAssets` 原本只比 cache 名字：存在别的 vendor 版本的
`document-editor-runtime-*` 就等待。两个方向都会误判：

1. 上面"附"那一节的推理只对了一半。落地页**确实会**建 runtime cache——指纹化的
   `ran-tokens.<hash>.css`、`/ran-fonts/fonts.css`、`open-local.js`、
   `landing-prefetch.js` 全走 SWR 分支。`caches.has` 那个判断防的是"凭空创建"，
   但 `pruneAppAssets` 会把这个真实存在的 cache **清空而不删除**，留下的空壳按名字
   判仍然是"有 vendor 资产要丢"。只逛落地页的访客于是照旧被卡住。
2. 更要紧的是**引入这套命名的那次部署**：旧 worker 的 runtime cache 还叫构建戳，
   名字必然与新的 vendor 哈希不同 → 判定要丢 → 不 `skipWaiting()`。而"附"里那句
   "这一判断不需要旧 worker 配合"在这里也不成立：它不需要旧 worker **发消息**，
   但它读的是旧 worker **起的名字**。同一次部署上 `sw-register.js` 的
   `CLIENT_COUNT` 握手也必然失效（旧 worker 没有 handler → 1s 超时 → `null` →
   拒绝提升）。两条路一起哑掉，本文这次修复本身就发不出去，用户还是要关掉所有标签页。

改成**看内容**：对每个别的 runtime cache 取 `keys()`，有命中 `VENDOR_ASSET` 的条目
才算"有东西可丢"；读不出来算有（等待是安全答案）。空壳与旧构建戳的纯 app cache 都
不再挡路，真的 vendor 树仍然挡。

反向验证：改回按名字判 → "takes over past an emptied runtime cache" 与
"takes over on the very deploy that introduces this scheme" 两条变红。

### B. prune 在活页面底下删掉它正在用的 chunk

vendor 未变的部署现在 install 就接管，于是 `activate()` 是在**页面还开着**的时候跑的
——而开着文档的编辑器页刻意不在 `controllerchange` 时 reload。`pruneAppAssets` 这时
删掉 `/assets/<hash>`，删的是世上最后一份：新部署不再提供退场构建的文件名，SWR 分支
对 hashed asset 的 404 会返回 `Response.error()`，于是那页之后的
`import('./lib/agent-plugin')`（agent 面板）与 `import('./lib/pending-open')` 直接失败，
功能再也打不开。改动前不会发生，因为那时激活只在所有标签页关闭后才来。

现在 prune 先问 `clients.matchAll({ type: 'window', includeUncontrolled: true })`，
有窗口就跳过。`includeUncontrolled` 是必须的：`activate` 阶段 `clients.claim()` 还没
落定，默认的 `matchAll` 看不到任何 client，门就等于没有。等待也不欠账——期间由
`limitCacheSize` 的"vendor 最后淘汰"顶着，下一次没有窗口的激活再清。

反向验证：去掉窗口判断 → "leaves the app half alone while a window of the outgoing
build is open" 变红。

### C. 落地页两个脚本从路由拆分起就漏在 SWR 上

`open-local.js` 与 `landing-prefetch.js` 是固定名、内容随部署变的落地页脚本，却既不在
`_headers` 的 no-cache 组，也不在 `sw.js` 的 `DEPLOY_COUPLED`——正好落进
`DEPLOY_COUPLED` 注释自己描述的那个坑（SWR 先给旧副本，后台 revalidate 又可能被浏览器
HTTP 缓存应答，旧字节写回 SW cache，跨部署永不收敛）。改这两个文件的部署，落地页会
一直跑旧的那份。b0bebff（路由拆分）引入，本次一并补上；`sws.toml` 的 `**` 默认已是
`no-cache`，Docker 侧不需要改。

顺带发现 `sw-routing.test.ts` 里那份 `DEPLOY_COUPLED` 手抄副本**没有任何东西校验**：
反向验证时把 `sw.js` 改回去，41 条路由用例全绿——它们问的一直是副本。已加一条用例把
副本与 `sw.js` 里的字面量钉在一起。

反向验证：从 `_headers` 去掉两条 → hosting-contract 的 "keeps deploy-coupled files
uncacheable" 变红；从 `sw.js` 的正则去掉 → "is the regex the shipped worker actually
uses" 变红。
