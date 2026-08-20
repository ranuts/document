# x2t 拿不到内存，我们却说"文件可能已损坏"（GitHub #144 第三轮）

日期：2026-08-20 · 分支：main · 相关：[#144](https://github.com/ranuts/document/issues/144)

> 状态与"别再试这些"清单看一页纸：[docs/changelogs/2026-08-20-issue-144-memory-and-delivery.md](../changelogs/2026-08-20-issue-144-memory-and-delivery.md)

## 一句话

报告人的浏览器分配不出 x2t 的 wasm 堆，`WebAssembly.instantiate` 失败，
emscripten 包成 `Aborted(RangeError: ... Out of memory ...)`；而我们的
`classifyOpenFailure` 用 `Aborted\(` 一律判 `document`，于是**已有的自动重试
被跳过**、提示语告诉用户"文件可能已损坏、格式不受支持"——两件都是错的：
x2t 从未读到文件字节。

## 用户看到的原话

```
文档处理出错 (code -82, 打开文件时发生错误) 文件无法打开：可能已损坏、格式不受支持，
或内容与扩展名不符 [Aborted(RangeError: WebAssembly.instantiate(): Out of memory:
Cannot allocate Wasm memory for new instance. Build with -sASSERTIONS for more info.)]
```

方括号里那段是 2026-08-19 才加上的真实原因（`describeOpenFailure`）。没有它，
这一轮仍然只会是"又一个 -82 截图"。**这个设计救了这次排查。**

## 现场事实（issue 里给的，不是推断）

- 两台 Win11，Chrome 135 与 150 **都失败**；同机 **Edge 151 正常**。
- **新建文档正常，只有打开本地文件失败**——新建不经过转换，与 x2t 精确对应。
- 最新一次是在**无痕窗口**里复现的：冷 profile、首次打开，页面上不存在
  上一个编辑器 frame。
- 前两轮的诊断（字体竞态 #146/#148、镜像强缓存 #154）都不是他的问题；
  第二轮的强缓存确实存在且已修，但修完报错一字未变。

## x2t 到底要多少内存

从二进制里读出来的，不是从注释里抄的（`public/sdkjs/common/wasm/x2t/x2t.wasm.gz`
解压后 40.2 MB，memory section）：

```
initial = 4533 pages = 283 MB   （每个编辑器 frame 一上来就要提交）
maximum = 32768 pages = 2048 MB （需要被预留的地址空间；实际很少用到）
shared  = false
```

失败瞬间同一个 renderer 里叠着：`prepareWasmBinary` 解压出的 **40.2 MB
ArrayBuffer**（常驻 `window.Module.wasmBinary`）+ **283 MB** wasm 堆 + 40 MB
模块编译出的机器码，另有同 frame 的 `fonts.wasm`(3.6M)、`zlib.wasm`(1.6M)、
`spell.wasm`，PDF 场景再加 `drawingfile.wasm`(10M)。

这两个数字现在由 `test/unit/vendor-contract.test.ts` 直接解析二进制钉住，
与 `lib/onlyoffice/wasm-memory.ts` 的常量比对——否则 vendor 换版后，用户看到的
"约 283 MB"和探测用的 maximum 都会静默过期。

## 为什么 Chrome 挂而 Edge 通：不知道，所以让代码去问

只剩两个候选，都无法从 macOS 上复现验证：

| 候选                                      | 支持                                                                                                                                                  | 反对                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **A. 32 位 Chrome**                       | 32 位渲染进程只有 2–4 GB 地址空间，其中找 283 MB 连续内存很容易失败；Win11 的 Edge 只有 64 位。可解释"确定性失败、两台机器、两个版本都挂、与文档无关" | 两台 Win11 都装 32 位 Chrome 需要特殊原因      |
| **B. Chrome 进程占用 vs 近乎空载的 Edge** | Chrome 是他的日常浏览器；**无痕窗口不会关掉其他普通窗口**，系统内存压力照旧                                                                           | 不解释"两台机器都恰好如此"，除非两台都是日常机 |

**Chrome 135 与 150 相差约 15 个版本却都挂，这条排除了"V8 版本回归"**——
Edge 151 与 Chrome 150 的 V8 几乎同代。差异更像构建位数或运行时占用。

所以不猜，改成让失败现场自报：

- `probeX2tMemory()` 分两步问浏览器——先 `{initial: 1, maximum: 32768}`
  （**只问预留，只花一页**，不在内存最紧的时候再要 283 MB），失败即
  `reservation`；通过后再问 `{initial: 4533}`，失败即 `commit`；都通过是
  `ok`（说明当时是瞬时的）。
- `navigator.userAgentData.getHighEntropyValues(['bitness','architecture'])`
  直接给出那个 Chrome 是不是 32 位，用户不需要做任何操作。
- 两者都写进提示的方括号：`[memory: reservation, build: x86-32]`。

A 与 B 会被下一张截图一次性分开。报告人已经三次可靠地回传截图，这比加遥测快。

## 改了什么

| #   | 缺陷                                                                                                    | 位置                                                           | 修法                                                           |
| --- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `Aborted(` 无条件判 `document`，重试被跳过                                                              | `lib/onlyoffice/open-failure.ts:110`                           | 把分配失败的识别**前置**到 `Aborted(` 之前，返回 `environment` |
| 2   | `OPEN_FAILURE_PATTERN` 三个词都不匹配，guard 整个分支被跳过，-82 只能靠 vendor 自己的 window.onerror 抛 | 同文件 `OPEN_FAILURE_PATTERN`                                  | 新增 `isOpenConversionFailure`，并入分配失败的判定             |
| 3   | 只要 -82 就贴"可能已损坏"                                                                               | `lib/onlyoffice-editor.ts` 的 `onError`                        | 分配失败走新文案 `editorErrorOutOfMemory`（8 语言）+ 探测结论  |
| 4   | 40 MB `wasmBinary` 用完不放，每个 frame 常驻                                                            | 新增 `lib/onlyoffice/guards/wasm-binary-release.ts`（守卫 10） | `calledRun` 之后置空                                           |

`isWasmAllocationFailure` 刻意排除 `RuntimeError: memory access out of bounds`
——那是 x2t 走出自己的堆，**是**对字节的判决，必须继续算 `document`。

## 试过又撤掉的：重建时丢弃旧 frame 的 realm

原计划里还有一条"确定性释放"：重建前把旧编辑器 frame 导航到 `about:blank`，
让它的 283 MB 堆立刻回收，而不是等一个我们无法请求的 GC。

**撤掉了，理由是证据：**

1. **第一版是空操作。** `location.replace()` 只是*排入*导航，紧接着
   `destroyEditor()` 把 iframe 摘出 DOM，待处理的导航被取消。是新写的 E2E
   用例（捕获旧 frame 的 window 再检查 `Module`/`AscCommon` 是否还在）把它抓出来的
   ——而我最初那版"数 frame 数量"的用例在**没有修复时同样全绿**，因为
   `page.frames()` 根本不列出已分离但仍存活的 frame。CLAUDE.md 里"绿着的用例
   不等于测到了修复"，这次又中一发。
2. 改成 `await` 轮询到 realm 真的变空之后，用例转绿，反向验证也确认
   （去掉 `await`、只保留同步调用，用例照样红）。
3. **但它引入了真实回归**：整套 E2E 里 3 条挂了——vendor 的
   `createDelayedElements`/`injectSvgIcons` 在 document-ready **之后**还在取
   SVG 图标，被 `about:blank` 掐断，产生 `TypeError: Failed to fetch`，L0 判失败。
   代价落在每一次正常的文档切换上，而且"等加载完再拆"躲不开——那些请求本来就在
   ready 之后。
4. **而它对 #144 一点用都没有**：报告人是无痕窗口首次打开，页面上没有上一个 frame。

撤掉后整套 E2E 恢复（84 passed / 0 failed）。如果以后真要做，需要的是一个能
**取消而非掐断** vendor 在途请求的机制，不是导航。

## 用例（全部做了反向验证）

| 用例                                                                                                    | 反向验证结论                                                                                    |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `onlyoffice-editor.test.ts`："a refused wasm allocation is an environment failure"                      | 撤掉前置规则 → 红                                                                               |
| `onlyoffice-wasm-memory.test.ts`：探测两段、排除堆越界、40 MB 回收、常量钉死                            | 撤掉 `module.wasmBinary = undefined` → 红；把常量改错 → `vendor-contract` 红                    |
| `open-retry.spec.ts`："an out-of-memory abort is retried and reported as memory, not as a corrupt file" | 撤掉 guard 的 OOM 识别 → 红（重试不发生）；撤掉 toast 分支 → 红，且**原样复现了用户截图那句话** |
| `wasm-memory.spec.ts`："the inflated x2t binary is released once the module has run"                    | 撤掉守卫挂载 → 红（`hasBinary: true`）                                                          |

反向验证 B 打出来的字符串与报告人的截图逐字一致：

```
Document error (code -82, An error has occurred while opening the file.) The file could not be
opened: it may be corrupted, in an unsupported format, or not what its extension says
[Aborted(RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for
new instance. Build with -sASSERTIONS for more info.)]
```

## 一处 L0 让步（写下来，不藏）

那条 OOM 的 E2E 用 `l0.allowAscError(id === '-82')` 而不是 `expectAscError(-82)`：
注入的拒绝在 `Asc.editor` 一出现就触发，会跑在 L0 每 250 ms 的挂钩轮询之前，
所以"观测到"这个 -82 是有竞态的。-82 确实发生仍然被要求——由断言里的
`code -82` 保证，那段文字只能经 SDK 自己的 asc_onError 路径到达页面。

## 顺带记下的两件事（本次未改）

- `createEditorInstance` 里清 `#iframe` 子节点的那个循环是死代码：`api.js:603`
  用 `replaceChild` 把占位 div **换成** iframe，`destroyEditor()`（api.js:616-621）
  又换回一个全新的空 div，循环拿到的永远是空的。无害，但会误导下一个读它的人。
- `test/e2e/open-retry.spec.ts` 的"font system costs a fraction of a second"
  是 `< 2s` 的负载敏感预算断言。带本次改动整套跑 3 次挂 2 次（实测
  `waited = 3400 ms`），干净树 2 次都过——挂的原因不是代码路径，而是本次多加了
  一次真实编辑器启动，而这套用例在 4 核机上已经贴着并行上限。**已改为串行**：
  该用例打 `@serial` 标签，分片的并行那趟 `--grep-invert` 掉它，同一个 job 再用
  `--workers=1` 独占跑一趟（独占下复跑 3 次均 6.2~6.3 s 通过）。Pages 与 Docker
  两套托管语义回归直接不测它。两半由 `workflow-contract.test.ts` 钉成一对——
  单删任一半，契约测试都变红（已反向验证）。本地：`pnpm run test:e2e` +
  `pnpm run test:e2e:serial`。

## 削峰：把模块从网络上直接编译（已做）

先量了真实占用，再决定动哪里（合成语料，本机 Chromium）：

| 场景                     | 峰值堆 |
| ------------------------ | ------ |
| xlsx 50 行               | 340 MB |
| xlsx 20000 行 + 保存     | 408 MB |
| xlsx 40000 行 + 导出 PDF | 408 MB |

**声明上限 2048 MB，实测峰值 408 MB——超声明 5 倍。** 这说明候选 A 的修法（改小上限）
有空间；但它只对 32 位有效、我这里无法验证，且我的合成文档不是天花板（真实语料、CJK
字体的峰值未知），所以**上限一个字节都没动，等截图**。

能无条件做的是削掉失败那一刻的峰值。原先 `prepareWasmBinary` 把 9.4 MB 的 gz 解压成
**40.2 MB ArrayBuffer** 交给 emscripten，于是 `WebAssembly.instantiate` 向浏览器要
283 MB 堆、同时编译 40 MB 代码时，那 40.2 MB 还**压在同一个 renderer 里**——正是失败
的那一刻。守卫 10 是在实例化**之后**才放掉它，救不了这一刻。

改用 emscripten 自己的 `Module.instantiateWasm` 钩子（x2t.js 第 627 行）+
`WebAssembly.instantiateStreaming` 直接吃 `DecompressionStream`：解压后的副本**根本不
存在**，而且第一个 chunk 到达就能开始编译。

五个必须小心的点：

1. **钩子绝不能同步抛异常**——`createWasm()` 会把它变成 `return false`，那是致命失败。
   所有错误都在 promise 里处理。
2. **分配失败不回落到缓冲路径**。看起来"稳"的兜底其实有害：最可能的失败就是浏览器
   拒绝给堆，回落会在已经耗尽的 renderer 上再要 40 MB，把一次 OOM 变成两次、还推迟
   报错。所以按能力**预先判定**（`canStreamWasm`），流式路径自身失败就直接浮出。
3. **两字节嗅探不能靠缓冲全量**。服务器对 `.gz` 的处理不一致（有的带
   `Content-Encoding: gzip` 已经解好、有的原样给 gzip 字节），原代码是把整个
   ArrayBuffer 拿到手再看头两字节。现在读到前两字节就判定，再把已读的 chunk 重新
   enqueue 进一个新的 `ReadableStream` 接上剩余 body。
4. **自带 `Content-Type: application/wasm`**：`.gz` 在服务器上的类型是什么都有可能，
   而 `instantiateStreaming` 会拒掉非 `application/wasm`。
5. **错误措辞变了**：不再经过 emscripten 的 `abort()`（它是模块内私有函数，helper
   取不到），所以失败以引擎原话浮出，没有 `Aborted(...)` 外壳。`isWasmAllocationFailure`
   匹配的是 "Cannot allocate Wasm memory" / "Out of memory" 而非外壳，仍然成立——并已
   补一条针对 `WebAssembly.instantiateStreaming(): Out of memory` 措辞的用例。

用例：`wasm-memory.spec.ts` 现在钉的是**流式路径确实被走到**（`instantiateWasm` 已装、
`wasmBinary` 从不出现）——静默回落到缓冲路径会把 40 MB 放回峰值而其他任何用例都不会
发现。反向验证：强行让 `canStreamWasm()` 返回 false → 该用例红（`streaming: false`），
且**缓冲兜底路径本身仍能打开并保存文档**（顺手验了，不是死代码）。`vendor-contract`
另钉住 `instantiateWasm` / `canStreamWasm` / `instantiateStreaming` 三个符号，防止重新
vendoring 时把这个补丁静默丢掉。

## 试过并回滚：调小 `initial`（283 MB → 64 MB）

削峰之后，剩下的唯一方向是**少要一点**。看起来这一刀很干净：

- 构建**完整支持按需增长**——`growMemory` / `_emscripten_resize_heap` 已接进
  `wasmImports`（x2t.js:5433），几何 +20%、另有 4 次退让重试；
- 实测峰值 408 MB 本来就是**增长之后**的数字，283 MB 只是起点；
- memory section 里 `initial` 在偏移 144291、2 字节 ULEB，1024 页（64 MB）编码**同样
  是 2 字节**，可以原地改、不动 section 长度。

于是写了 `bin/patch-x2t-memory.mjs`，改完跑 E2E——**当场炸**：

```
x2t WASM instantiation failed: RuntimeError: memory access out of bounds
heap 停在 67108864（= 新的 64 MB），保存超时
```

**根因：`initial` 有下界，由模块自身的静态布局决定，而我漏了这一点。** 量出来的下界：

| 项                                     | 值                              |
| -------------------------------------- | ------------------------------- |
| data 段最高结束位置                    | 11.0 MB                         |
| **不可变 i32 global 里烧死的静态地址** | **280292472 等多个 ≈ 267.3 MB** |
| vendor 声明的 initial                  | 283 MB                          |

静态/BSS 布局一直铺到 **~267 MB**（data 段只占 11 MB，其余是未初始化的静态区，只占地址
空间不占文件体积）。283 MB = 267 MB 静态 + 16 MB 余量。把内存降到 64 MB，那些**编译期
就烧进代码的指针**立刻指到内存之外，第一次访问即越界——早于读到任何文件。

量这些数字的工具留在仓库里了：`node bin/x2t-memory-report.mjs`（只读），输出下界、
声明值与两者之间的余量。**vendor 升级后跑一次**就知道新构建是否还是这样，不必重新
考古。当前输出：

```
  initial  4533 pages = 283.3 MB   committed up front, per editor frame
  maximum  32768 pages = 2048.0 MB   hard ceiling; growth above it fails
  data segments        2, highest end 11.0 MB
  immutable i32 globals 2501, highest address 267.3 MB  <- includes BSS
floor: initial cannot go below ~4277 pages (267.3 MB).
slack: 256 pages (16.0 MB) ... nothing worth reclaiming.
```

**所以 283 MB 是这个构建的结构性要求，不是可调参数。** 已全部回滚（二进制、常量、
pinned 哈希、脚本一并删除），回滚后 `wasm-memory` / `embed-regression` /
`xlsx-features` 16 条复跑通过。

顺带记两个数字，供将来判断：

- 重新 gzip 的代价一开始是 +193 KB（Node 的 zlib level 9 得到 10,058,136），
  **后来解决了**：`brew install zopfli` 之后 `zopfli --gzip --i15` 得到 **9,483,006**，
  比 vendor 原始的 9,860,417 还小 **377 KB（−3.8%）**，解压后内容逐字节一致。所以
  "改二进制要付体积代价"这个顾虑不再成立，而且顺手把全站最大的下载压小了（见下节）。
- `maximum` 那一侧也别碰：它是硬上限（`_emscripten_resize_heap` 里
  `if (requestedSize > maxHeapSize) return false;`，注释原话 _"the wasm binary specifies
  it, so if we tried, we'd fail anyhow"_），调小等于砍掉大文档的能力；而且 glue 的
  `getHeapMax()` 硬编码 2 GB，单独抬高二进制声明也没有意义。

**结论：不重新编译 x2t，就无法降低这个内存要求。** 我们能做的到此为止——准确诊断、
自动重试、削掉 40 MB 峰值。真正的解法是换一个用更小 `INITIAL_MEMORY` 编译的 x2t
构建（需要上游/打包方配合），或长期看迁移到 MEMORY64。

## 顺带拿到的净收益：x2t.wasm.gz 小了 377 KB

为验证"改二进制要付体积代价"而装的 zopfli，结果直接给了一个与本 bug 无关的净收益：

| 压缩方式                          | 体积          | 相对 vendor          |
| --------------------------------- | ------------- | -------------------- |
| vendor 原始                       | 9,860,417     | —                    |
| Node zlib level 9                 | 10,058,136    | +193 KB              |
| `zopfli --gzip --i1`              | 9,515,400     | −345 KB              |
| **`zopfli --gzip --i15`（采用）** | **9,483,006** | **−377 KB（−3.8%）** |

解压后与 vendor **逐字节一致**（sha256 `7db02f5c…`），所以行为零风险；这是全站最大的
单个下载，慢链路上是实打实的收益。

顺势把契约测试改对了一件事：原先钉的是 **`.gz` 容器**的哈希，那等于把"是不是 vendor
的字节"这个不变量绑在了压缩器的选择上。现在钉**解压后内容**的哈希（真正的 provenance），
另加一条尺寸门（`< 9.6 MB`）作为提醒——zopfli 不是仓库依赖（一次性、约 15 分钟 CPU），
vendor 升级后需要手动重跑：

```bash
zopfli --gzip --i15 -c x2t.wasm > x2t.wasm.gz
```

反向验证：换回 Node zlib 的压缩结果 → 尺寸门变红。

## 顺带查出的另一个缺陷（已修，单独记录）

"这次修完他还要不要用无痕窗口"这个问题，把**等待中的 Service Worker 从不被提升**
挖了出来——修好的东西根本发不到用户手里。见
[2026-08-20-service-worker-update-never-promoted.md](2026-08-20-service-worker-update-never-promoted.md)。

## 还欠什么

等报告人回一张新截图。方括号里会是这样：

- `[memory: reservation, build: x86-32]` → 候选 A 成立，卡在 2 GB 预留。这是**唯一**
  还有牌可打的分支：把 maximum 改小能减少预留，但那是用"大文档打不开"换"小文档能
  打开"的取舍，要用真实语料定新上限，且必须让用户知情。
- `[memory: commit, build: x86-64]` → 候选 B 成立，真的凑不出 283 MB。降峰值那一刀
  （流式实例化）**已经做了**，见上一节；再往下就只剩改小声明上限。
- `[memory: ok, ...]` → 当时是瞬时的，重试本身就是修复（本次已让重试真正发生）。

## 落地后的 review 修了四处（2026-08-20 同日）

对整份改动做整体 review 时发现的，四条都在上面描述的机制里，且各自都做了反向验证
（撤掉修复 → 新用例变红 → 恢复）。

### 1. 诊断探测会挤死它正在报告的那次重开

`probeX2tMemory()` 在 OOM toast 里被同步调用，而第二段探测
`new Memory({ initial: 4533 })` **真的会提交 283 MB**。能走到这条路径的前提恰好是
"浏览器刚刚拒绝了这笔内存"，而环境类失败的重开此刻正在为新 frame 申请它自己的
283 MB——诊断于是和修复抢起了内存，可能让重开失败，甚至把渲染进程推过去。

修法不是把探测变便宜（提交 283 MB 就是它要问的问题），而是**让它在重开在飞时不问**：
`probeX2tMemory({ skipCommit: isOpenRetryInFlight() })`。reservation 那半只要 1 页，
永远照问（它才是 #144 的主要假设）；commit 那半改回 `deferred`。
`open-failure.ts` 里新增的 `openRetryInFlight` 在调度重开时置位，在
`releaseOpenAttemptBytes()`（成功）、重开启动失败、**以及终态失败发 `asc_onError`
之前**清位——所以最终那条 toast 仍然拿到完整探测。

反向验证：去掉 `skipCommit` 分支 → `probeX2tMemory` 单测里"does not commit 283 MB
behind a rebuild"变红；把调用点改回 `probeX2tMemory()` →
`onlyoffice-editor.test.ts` 的"does not commit 283 MB while the rebuild it reports
on is asking for its own"变红（它经真实 guard 触发重开，再模拟 vendor 自己的 -82）。

### 2. `Conversion failed with code` 必须排在 OOM 规则之前

OOM 规则当时排在最前，注释只说了"要在 `Aborted(` 之前"。但它也压过了
`Conversion failed with code`——而退出码正是 x2t **已经实例化并读过字节**的证据。
一份大到在转换中途耗尽堆的文档，消息里同时有退出码和 "Out of memory"，会被判
`environment`，换来一次无用重开加一句"请改用 64 位浏览器"。现在退出码第一、OOM
第二、`Aborted(` 第三。

反向验证：恢复旧顺序 → `Conversion failed with code: 90 (Out of memory)` 那条断言变红。

### 3. 守卫 10 在"x2t 晚于 onDocumentReady 加载"时永不生效

`releaseWasmBinary` 的返回值没有进 `fullyApplied`，`prepareEditorIframe` 的 200ms
轮询在其余 5 条守卫就位时就 `clearInterval` 了，之后只剩 `onDocumentReady` 补跑一次。
空文档（`?new=docx`）挂载时不加载任何转换器，x2t 要到**首次保存**才出现——那时两个
时机都过去了，40 MB 于是常驻整个 frame 生命周期，与守卫文件里"靠 timer 从未加载走到
已释放"的注释直接矛盾。

改成**订阅而非轮询**：给 frame 的 `Module` 属性和 module 上的 `calledRun` 装
accessor（`x2t_helper` 用 `Object.assign({}, window.Module, …)` 会换新对象，所以两级
都要看），`calledRun` 被置 true 时立刻释放；accessor 装不上才退回原来的轮询语义。
装上即返回 true，因此可以安全进 `fullyApplied`。

反向验证：换回纯轮询实现 → "releases when x2t loads long after the guard timer
stopped" 与 "follows the fresh object x2t_helper publishes for each Module rewrite"
两条变红。

### 4. 提示语里的 283 不再手抄八遍

`X2T_INITIAL_MB` 当时零调用点（只有再导出和单测），而 "283 MB" 硬编码在 8 条译文里
——`vendor-contract` 新加的二进制解析因此管不到用户看见的那个数字。现在 `t()` 支持
`{name}` 插值（`packages/shared/src/i18n.ts`），译文只写 `{mb}`，调用点传
`{ mb: X2T_INITIAL_MB }`。未知占位符保留原样而不是留空。

反向验证：让 `t()` 忽略 vars → i18n 单测"fills {name} from the caller in every locale"变红。

## Review 复盘（同日，改动尚未提交）

三处，都是"同一条消息在两个地方被读成两种意思"。

### 5. toast 与分类器对同一条消息给出不同答案

`classifyOpenFailure` 把 `Conversion failed with code` 排在
`isWasmAllocationFailure` **之前**是本文第 2 节的结论：有退出码就说明 x2t 已经实例化
并读过字节，那是它对文档的判决，哪怕消息里带 "memory"。但 toast 那一侧写的是
`code === -82 && isWasmAllocationFailure(failure)`，绕过了这个优先级——于是
"Conversion failed with code: 88 (Out of memory)" 会拿到"关掉别的标签页 / 换 64 位
浏览器"，把读者派去修一个本来没问题的浏览器，而那个文件无论怎样都转不出来。

改成先过 `classifyOpenFailure(failure) === 'environment'`，两个读法只有一处定义。

反向验证：改回只判 `isWasmAllocationFailure` → "does not blame the browser for an x2t
exit code that mentions memory" 变红。

### 6. 守卫的入口条件太宽

`isOpenConversionFailure` 直接复用了 `isWasmAllocationFailure`，而后者有一条裸的
`/Out of memory/i`——文档就绪之前任何恰好提到这几个字的 rejection 都会进这条分支，
代价是一个 `-82` toast 加一次整编辑器重建，记在一个本来加载正常的文档头上。收窄为
"像分配失败**且**带 wasm/emscripten 上下文"（`Aborted(` / `WebAssembly` /
`Wasm memory`），#144 那条真实消息三个都带。

反向验证：去掉上下文条件 → "ignores an unrelated rejection that merely says
\"out of memory\"" 变红。

### 7. commit 探针问的不是 x2t 真正声明的 descriptor

`probeX2tMemory` 的 commit 半问 `{ initial: 4533 }`，没有 `maximum`——而 x2t 声明的是
`{ initial: 4533, maximum: 32768 }`。两半各自单独成功、合起来失败的机器（地址空间紧张
的 32 位 renderer，正是本文第 1 节那个候选解释）会拿到 `ok`，也就是"偶发，再试一次"，
而它其实每次都失败。补上 `maximum`，成本不变（还是那 283 MB）。

反向验证：去掉 `maximum` → "asks the commit half with the descriptor x2t actually
declares" 变红。

### 8. `bin/x2t-memory-report.mjs` 的游标会静默错位

globals 段的循环只对 `0x41`（`i32.const`）消费操作数，却无条件跳一个 `end` 字节。
换成任何别的初始化 opcode（`i64.const`、`global.get`、扩展常量表达式），操作数字节
没人读，此后整段都是从任意字节解出来的——而段末的 `offset = end` 把错位完全盖住。
data 段同一个形状。

今天这个二进制是齐的（2501 个不可变 i32 全部 `i32.const`，游标差 0），但这个脚本
存在的意义就是**下次 vendor 升级后再跑**。那时一次错位会打印出一个偏低的 floor，
从而建议"可以降 `initial`"——正是本文档开头写明会致命的那个改动。这是它唯一绝不能
给出的错答案。

改法：认不出的 opcode 直接抛（带 opcode 值），并给每个解析过的段加
`expectExhausted(id, end)`——游标没有正好落在段末就报错，把"下面每个数字都来自任意
字节"这件事说出来，而不是印一个像样的数。

反向验证：删掉 globals 循环里那句 `offset++ // end opcode` → 立刻抛
`global 1: initialiser opcode 0x1 is not i32.const`，而不是继续打印。
