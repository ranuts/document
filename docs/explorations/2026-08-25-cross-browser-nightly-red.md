# 2026-08-25 — 夜间 cross-browser 那 11 条红，是两个真 bug 加三处跑道问题

`Nightly corpus` 的 `Cross-browser (WebKit + Firefox)` job 从建起来就没绿过，
每晚 11～12 条失败、名单几乎完全一致（不是 flake，是稳定复现的欠账）。
这次把它们全部定位、修完、验完。起点：run 32770230528。

跑道：`playwright.browsers.config.ts`（webkit + firefox，workers=2，retries=1），
本地全部用 `E2E_PORT=4176` 复现。

## 一、结论先行

| 类别                               | 条数 | 根因                                                                        | 归属         |
| ---------------------------------- | ---- | --------------------------------------------------------------------------- | ------------ |
| WebKit 落地页交接全灭              | 5    | Safari 不能把 `File`/`Blob` 结构化克隆进 IndexedDB                          | **产品缺陷** |
| WebKit 离开落地页报 uncaught error | 1    | 预热 fetch 在 unload 时被浏览器取消，任何 `.catch` 都来不及跑               | **产品缺陷** |
| Firefox `sw.js:336` console.error  | 3～4 | 同一件事的 Firefox 说法：被取消的请求，怪到正在应答它的 service worker 头上 | 浏览器噪声   |
| Firefox open-retry "Error"         | 1    | Firefox 把 `console.error(err)` 交给 driver 时只剩一个 "Error"              | L0 盲点      |
| Firefox landing-prefetch 7/8       | 1    | 断言自己把被测的东西饿死了（默认 100ms 轮询 Cache API）                     | 用例缺陷     |
| WebKit save-to-file                | 2    | 这个引擎的 OPFS 没有 writable stream，用例的 picker stub 根本立不起来       | 引擎缺能力   |

## 二、Safari 不能把 File 存进 IndexedDB（P1，线上真坏）

静态落地页没有 app bundle，所以"打开文件"是：`public/open-local.js` 把选中的
`File` 塞进 IndexedDB，跳到 `/editor?open=local`，`lib/pending-open.ts` 取出来。

WebKit 实测（`put(File)` / `put(Blob)` / `put({bytes: Uint8Array})`）：

```
RESULT file  tx error: null
RESULT blob  tx error: null
RESULT plain ok
```

put 被接受，**事务随后以 `error === null` 失败**。于是 `stashFile` 的 reject 分支
走 fallback，把 `open=local` 从 URL 里删掉——用户刚选完文件，落到一个空编辑器。
`entry-paths.spec.ts` 里那条 `page.evaluate: null` 就是这个 null error 的原样。

WebKit 上因此连挂 5 条：`entry-paths ?open=local`、`main-site` 两条、
`save-to-file` 两条、`autosave-recovery`（它们都走 hero → 落地页交接）。

**修法**：先按引用存 `File`，**写完读回来确认**，确认不到才读字节存
`{ name, type, lastModified, bytes: Uint8Array }`；读侧两种形状都接受。

三处都是 review 逼出来的，不是第一版：

- **不能无条件读字节**。app 打开文件走的是 `createObjectURL(file)`，从不把文档读进
  内存；无条件 `arrayBuffer()` 等于在"选完文件"和"跳转"之间插一段没有任何反馈的
  停顿，而文件够大时它直接 reject——落到的正是这次要修的那个空编辑器。
- **不能只信"put 没抛"**。fake-indexeddb 会把 File 静默存成 `{}` 而不是报错；真
  Safari 是响亮地失败（`tx error: null`），但一个安静失败的引擎会绕过任何只检查写
  入的判断，症状一模一样。读回一个引用不花什么，所以读回来确认。
- **判型用 `ArrayBuffer.isView`** 而不是 `instanceof Uint8Array`——跨 realm 的类型化
  数组 `instanceof` 恒 false。

写侧与读侧是两个文件、靠注释维系，所以补了
`test/unit/pending-open-handoff.test.ts`：eval 真的 `public/open-local.js`，
用 fake-indexeddb 写进去，再用真的 `takePendingFile()` 读出来，并断言
**存的值不是 Blob**。反向验证：把 `put(record)` 改回 `put(file)`，4 条里红 3 条。
E2E 那条也改成调页面自己的 `__openLocal.stashFile`，不再手抄第三份形状。

## 三、离开落地页时的 uncaught error（P2，Safari 控制台每次都脏）

`landing-prefetch.js` 在访客读页面的整段时间里串行预热 ~34 MB。所以点 CTA 的
那一刻几乎总有一个几 MB 的 fetch 挂着，而**浏览器**在 unload 时取消它的方式，
两个引擎都报成错误：

- WebKit：uncaught `Fetch API cannot load <url> due to access control checks.`
- Firefox：`Failed to load '<url>'. A ServiceWorker intercepted the request and
encountered an unexpected error.`（指着 `sw.js:336`，也就是 vendor cache-first 分支）

**先证伪了两个顺手的解释**：

1. "WebKit 是同步抛，所以 `.catch` 没挂上"——不是。在 `pagehide` 里探针式地调
   `fetch()` 并立刻挂 rejection handler，三次全部 `returned-promise`，而三条
   uncaught error 照样出现。文档先死了，微任务没机会跑，谁都接不住。
2. "让 sw.js 的 `respondWith` 不 reject 就行"——不行。分别让它回缓存副本、回
   合成 504、回 `Response.error()`，Firefox 那行**一字不差地照出**。它报的是
   请求被取消，不是 worker 出错。

**能修的只有一件事：别让浏览器来取消，我们自己先取消。** `beforeunload` /
`pagehide` 时 abort（`AbortController`），rejection 在文档还活着的时候被 `.catch`
接住。WebKit 实测由 5 条 pageerror 变 0 条；Firefox 大幅减少但仍有残留（abort 和
unload 抢时序），所以那条消息进 L0 白名单。

**`beforeunload` 是必需的，`pagehide` 太晚。** review 提出 `beforeunload` 对**没有
发生的导航**也会触发（外部 scheme、下载链接、被取消的 unload），而 `stopWarming`
是一扇单向门——访客继续读着这一页，预热已经悄悄永久关掉了。改成只挂 `pagehide`
之后实测：WebKit 那 5 条 uncaught error 全回来了。所以正确的答案不是换事件，是
**把这扇门做成双向**：`pointerdown` / `keydown` / `scroll` / bfcache 恢复，任何一个
"文档还在被用"的信号都重新开始预热（真的走掉了它们就再也不会触发）。
刻意不用定时器：慢导航会让它恰好在 unload 前触发，把刚取消的请求又发一遍。

顺带这也是对的行为：不再为一个正在离开的页面烧带宽。

`test/unit/landing-prefetch.test.ts` 钉住：每个请求都带 signal、`beforeunload`
之后在飞的被 abort 且不再排新的、bfcache 回来恢复。反向验证：去掉那两行
listener，该条立刻红。

## 四、L0 的两个盲点

1. **Firefox 把 `console.error(new Error(...))` 交出来只剩 "Error"**——消息在参数
   对象里，而那个 frame 通常正在被拆（open-retry 就是编辑器 iframe 报完就重建），
   `jsHandle.evaluate` 拿不到（实测 `Execution context was destroyed`）。于是
   `open-retry.spec.ts` 明明写了 `l0.allowConsole(/Document conversion failed/)`，
   却匹配不到自己注入的那个故障。修法：init script 里包一层 `console.error`，
   把 Error 参数在**调用点**转成 `name: message`，所有引擎一致。
2. **被取消的请求**：Chromium 的 `net::ERR_` 早就在白名单里，Firefox 的
   `A ServiceWorker intercepted the request` 是同一类东西，补进去，并把上面
   三次证伪写在注释里。

## 五、断言把被测的东西饿死了

`landing-prefetch.spec.ts` 两处 `expect.poll(..., { timeout: 180_000 })` 用的是
Playwright 默认的 100ms 起步节奏，而每次轮询都要 `caches.keys()` + 每个 cache
`keys()`。Firefox 上这把 worker 自己那次 9.4 MB 的 `cache.put` 挤到永远做不完：
整整 180 秒卡在 7/8。改成 `intervals: [1000]`，同一台机器上 3 秒就到 8/8。

（同一个文件里另一条早就写了"polled, not asserted outright"的注释——这次是同
一个坑的第二种形态：不是"问得太早"，是"问得太密"。）

## 六、WebKit 没有 OPFS writable stream

`save-to-file.spec.ts` 的 picker stub 发的是真的 origin-private file handle，
所以整条用例依赖 `createWritable()`。这个引擎上它对**任何** payload 都 reject：

```
file: FAIL UnknownError   blob: FAIL UnknownError   u8: FAIL UnknownError
ab:   FAIL UnknownError   str:  FAIL UnknownError
```

写失败 → `saveToDiskFile` 返回 `unavailable` → 回落到下载 → ranuts 的
`saveFileToDisk` 又去开一次 picker，于是 `pickerCalls` 是 2 不是 1（两条调用栈
一条在 `save-target`、一条在 `input-*.js`，这才看清）。

真 Safari 根本没有 `showSaveFilePicker`，`canWriteToDisk()` 为 false，整个功能
按设计回落到下载——**产品侧没有 bug**。用例改成运行时探测能力后 skip，而不是
按浏览器名写死：WebKit 哪天补上 writable stream，它自己就开始跑。

## 七、两处"导航把 evaluate 掀了"的竞态（CI 里一直标 flaky）

同一份名单里还有两条常年 flaky、这次有一条两次重试都没过的：

1. `embed-api.spec.ts` 的三条 postMessage 用例。`page.goto('/?embed=1')` 在
   落地页自己 load 完就 resolve 了，而那些 embed 参数会让它**接着**跳到
   `/editor`；`page.evaluate` 起在这条缝里就是
   `Execution context was destroyed`。WebKit 输这场比赛的次数比 Chromium 多，
   但竞态不是 WebKit 的。补了个 `openEmbed()`，goto 之后 `waitForURL(/\/editor/)`。
2. `sw-vendor-cache-first.spec.ts` 挂在 `waitForEditorReady` 里。这次是
   **产品功能正常工作被报成失败**：`lib/sw-update.ts` 的 `healStaleController()`
   会把跑在本机没跑过的构建上的标签页悄悄 reload 一次，冷 profile 上每次首访
   都会发生。改法是让 `waitForEditorReady` 容忍一次导航——捕获这个错误、在同一
   个 deadline 内到新文档上重来，而不是在每条用例里绕。

## 八、验证

- 单测 51 files / 2709 passed，两条新用例都做了反向验证（见上）。
- Chromium 全量 E2E：151 passed / 16 skipped，绿。
- 之前失败的 8 个 spec 在 webkit+firefox 上：62 passed / 2 skipped，绿。
- 夜间那条完整命令本地跑了三轮：修完前 11 failed / 4 flaky；只剩两条竞态时
  2 failed / 1 flaky / 281 passed；竞态修完后 0 failed / 2 flaky / 282 passed，
  那 2 条 flaky 就是第九节那个 `@serial` 并发问题；拆成两趟之后全绿。

## 九、顺手把这个 workflow 的节奏改了

修完之后回头看这个 job 值不值得每天跑。结论是值得，但它当时的形态确实在浪费
注意力（仓库是公开的，runner 免费，花掉的不是钱）：

- **它是本仓库唯一的非 Chromium 覆盖**。分支保护的 6 个必需检查全跑 Chromium，
  Safari 和 Firefox 一条都不测。今天这个 Safari 缺陷已经在线上躺着了，正常 PR
  流程永远发现不了。所以 cross-browser + sweeps 保持每天。
- **corpus 改成每周日**。它 80 分钟，拉的是**静态**的 Apache POI 语料，产出的
  表几乎每晚一样；变的是本仓库，一周一次足够。
- **没有新提交就整晚不跑**。`schedule` 不管有没有改动都会触发。加了一个
  `gate` job 按 HEAD 的提交时间决定今晚跑什么，两个窗口各留一个周期加一小时
  的余量，`workflow_dispatch` 无视这两个判断。
- **gate 本身每晚都跑**（一次 checkout，不装工具链）。安静的夜晚也要留下一条
  run 说明为什么安静——否则"没有 run"和"workflow 坏了"在列表里长得一样。

判据那两行刻意写成 `if` 块而不是 `a || b && c`：后者在两个判断都为假时整体
返回非零，而 step 跑在 `bash -e` 下，于是一个安静的夜晚会以 gate 失败收场。
真值表在本地过了一遍（fresh/stale × 周三/周日 × manual）。

顺带修掉了最后两条 flaky，它们是同一个根因：**`sw-silent-update.spec.ts` 靠改写
被服务的 `dist/sw.js` 来模拟一次部署，那是整个源站可见的**。它自己早就标了
`@serial` 并把这个危险写在文件头，但**夜间那个 job 从来没做 `@serial` 分离**——
`ci.yml` 的 e2e job 做了，它没做。于是它并排跑的时候把别人的 worker 也换掉：
`sw-warm` 读到 `document-editor-runtime-e2e-next`，`sw-vendor-cache-first` 找不到
自己刚种下的哨兵（1296 字节的真文件，不是 sentinel）。补上 `--grep-invert` +
`--grep @serial --workers=1` 两趟，`workflow-contract.test.ts` 把这一对钉住
（两半各自反向验证过：去掉任意一半，该条变红）。

## 十、同一晚 corpus job 的 5 条红（未修，是信号不是门禁）

`47950_lower.doc` / `47950_upper.doc` / `Bug51944.doc` /
`2100a8d44da…ppt` 打不开（-82，x2t 读不了这几个老二进制格式），
`Bugs 184 deep-table-cell.docx` 把渲染进程压崩（`Target crashed`）。
这些是引擎能力问题，属于 v9 回归战役方向零的台账，本次不动。
