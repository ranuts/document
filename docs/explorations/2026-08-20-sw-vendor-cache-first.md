# 把整个 vendor 树改成 cache-first（热缓存下少发 46 个请求）

日期：2026-08-20
分支：`fix/sw-vendor-cache-layering`
改动：`public/sw.js`、`lib/onlyoffice/font-system.ts`、`test/e2e/sw-vendor-cache-first.spec.ts`、
`test/e2e/open-retry.spec.ts`、`test/unit/sw-routing.test.ts`、`test/unit/sw-update.test.ts`、
`test/unit/onlyoffice-editor.test.ts`

## 起因与测法

例行体检时实测 `/editor?new=docx` 的加载链路。这里的第一个坑是**怎么数**：

- `page.on('request')` 会把 SW 从缓存应答的请求也算进去——实测显示 72 个"请求"，
  其中 69 个是 SW 应答的，真正出网只有 3 个。
- 反过来，SW 内部的后台重验证 fetch **不会**出现在任何页面级事件里。
- `page.route` 在 SW 控制页面后根本不生效（CLAUDE.md 已经写过一次）。

所以唯一可信的办法是从**服务端**数：用一个会记账的静态服务器端出 `dist/`，
然后 Playwright 冷启动 → reload → reload。结果：

**SW 全热、文件全在缓存里的第二次访问，服务器仍收到 68 个请求：**

| 分组                                | 数量  |
| ----------------------------------- | ----- |
| sdkjs                               | 27    |
| web-apps                            | 19    |
| other（HTML / manifest / sw.js 等） | 19    |
| app assets                          | 3     |
| `fonts/NNN`                         | **0** |

字体是 0，因为它早就被特判成 cache-first 了（线上事故驱动：CJK 文档的串行字体
队列卡在 "Loading presentation" 好几分钟）。剩下的 sdkjs / web-apps 得的是同一种
病——SWR 分支的 `fetch(request, { cache: 'no-cache' })` 强制回源重验证每一个条目。

SWR 把这件事藏得很好：重验证发生在缓存副本已经交出去之后，用户看不到延迟。但在
慢链路上，这就是 46 个条件请求在和真正要紧的请求抢连接。

## 改法

把 `/sdkjs/`、`/web-apps/`、`/fonts/` 整体走 cache-first（复用仓库里已有的
`isVendorAsset`），spell 的 bypass 提到它前面。

**为什么 cache-first 在这里是对的**，靠的是 2026-08-20 早些时候 #144 那批改动打下的
基础：`RUNTIME_CACHE` 现在按 **vendor 内容哈希**命名（`bin/build.sh` 对
`sdkjs web-apps fonts` 三棵树做 shasum）。于是

> cache 名字变 ⟺ 这三棵树里有字节变了（**包括我们自己打进去的补丁**，
> 比如 `x2t_helper.js`——build.sh 哈希的是它实际服务的内容）

陈旧条目因此是**不可达的**：名字对上就意味着字节对上，vendor 一变就是一个空 cache
从头填。这比"按部署版本命名"的论证更强——后者在"我们 patch 了 vendor 但版本号没变"
时会失效。

顺带把 `cache.put` 的 rejection 吞掉（配额满不该把 `respondWith` 一起带崩，页面
已经拿到字节了），SWR 分支也走同一个 helper。

## 效果

同一套服务端计数：

|                      | 改前 | 改后  |
| -------------------- | ---- | ----- |
| 第二次访问总请求     | 68   | 25    |
| 其中 vendor 树       | 46   | 1     |
| 第三次访问 vendor 树 | 46   | **0** |

第二次剩的那 1 个是 `/web-apps/apps/api/documents/api.js`：首次导航时页面还没被 SW
控制，它是顶层 `<script src>` 发出的，所以那一轮才补进缓存。第三次剩的 2 个 sdkjs
请求是 `/sdkjs/common/spell/`——**故意 bypass**，冷 profile 下让它经过刚激活的 SW
会永久挂起。

## 反向验证（约定 3）

把 vendor 分支的条件写死 `false`（退回 SWR），`sw-vendor-cache-first.spec.ts` 变红：

```
the cached entry for /sdkjs/common/AllFonts.js was overwritten,
so the SW revalidated it over the network
```

**用例怎么区分 cache-first 和 SWR**：两者都先把缓存副本交出去，所以差异不在响应上，
而在**缓存条目之后怎么样**——SWR 会用网络响应覆盖它，cache-first 根本不碰网络。
于是往条目里塞一个哨兵，经 SW 请求该 URL，等 3 秒，再看哨兵是否还在。
（数请求数在这里行不通，理由见开头。）

## 连带回归：字体系统等待反转

改完后 `open-retry.spec.ts` 的 "waiting for the font system costs a fraction of a
second" 变红：期望 < 2000，实测 2600。这个用例现在带 `@serial` 独占 runner，所以
排除了并发压力的解释。

根因写在 `lib/onlyoffice/font-system.ts` 自己的注释里：

> the font system is ready about a second BEFORE the x2t module is
> (fonts at ~3.2 s, x2t at ~4.2 s), so the normal path waits zero

cache-first 让 x2t 从缓存瞬间返回，**把这一对的顺序颠倒了**：x2t 先到，于是
`awaitFontSystem` 的等待从"几乎不发生"变成了常态路径。

等待本身无害——实测总打开时间没变（3196 ms vs 3209 ms），只是等待从"x2t 加载"
转移到了"字体就绪"。**打满上限才有害**：`waited` 累加到 `FONT_SYSTEM_WAIT_MS` 时
`ready` 必然是 false，直接走 `cb([])`，也就是 #146 的无字体导入——文档里所有字体
被静默丢弃。（在改动的早期版本上，与其它 spec 并发时曾实测到 5000 打满。）

所以：

1. `FONT_SYSTEM_WAIT_MS` 5 s → 15 s。这个上限原本的含义是"兜住一个永远起不来的
   字体系统"，不是"兜住一个比 x2t 慢的字体系统"。新值只在真正故障时付出代价。
2. 用例改成断言**结果**而不是那个已经脱钩的代理指标：等待不得触及上限（= 没有
   降级）、没有 `without fonts` 警告、整体打开时间仍在界内。旧的 2000 ms 在新时序
   下不再代表任何东西。
3. 钉住该常量的单测原本是个没有推导过程的魔数 `<= 10_000`，现在绑到它声称保护的
   `SAVE_REQUEST_TIMEOUT_MS` 上（fetchFonts 与导出路径共用，所以这个等待也发生在
   保存里）。

## 测试 harness 的两个缺口

`test/unit/sw-update.test.ts` 在 jsdom 里直接执行 sw.js 源码，用的是手写的 fake
Cache。我的分支暴露了它与真实 Cache API 的两处偏差，都补上了：

- 没有 `cache.match`（旧代码只用全局 `caches.match`，新分支用 cache 句柄读）
- `put` 是 `vi.fn()` 返回 `undefined`，而真实 `Cache.put` 返回 Promise；新 helper
  链在它后面做配额容错，于是 fake 直接抛 TypeError

## 一条流程教训

这次工作差点做废：中途工作树被切回了 `main`（并行会话 / IDE 自动提交器所致，
CLAUDE.md 与记忆里都记过这个坑），commit 落在了本地 main 上，而 push 推的是还停在
起点的 topic 分支。更要紧的是，期间 `origin/main` 前进了 7 个 commit，其中
`b4b9d0b` **也在改 sw.js**，并且用"vendor 内容哈希"解决了我原本方案二想解决的问题
——比我用 OnlyOffice build id 的写法更好（build id 覆盖不到我们自己打的补丁）。

处理办法就是 CLAUDE.md 写的那条：把 topic 分支指向那个 commit、main 复位到
origin/main。然后**丢掉我方案里被上游更好方案覆盖的那一半**，只在新基础上重做
cache-first 那一半——而新基础恰好让它的正确性论证变得更强。

教训：长任务开始前后都要确认 `git branch --show-current`，并且在提交前
`git fetch` 看一眼 origin/main 有没有动过同一个文件。
