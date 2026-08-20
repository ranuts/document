# Review 追补：#144 那批改动收口（2026-08-20）

对当日三条主线（x2t 内存链路、SW 更新投递、拆 Tailwind）做分支 review 后追补的
修复。样式那条记在
[2026-08-20-drop-tailwind-for-ranui-tokens.md](2026-08-20-drop-tailwind-for-ranui-tokens.md)
的补记里，本文记其余四条。

## 1. 流式加载失败会静默转圈到 60 秒

`x2t_helper.installStreamingInstantiate` 把 x2t 改成边下边编译之后，
`loadScript()` **在 fetch 之前就 resolve 了**——准备阶段成了
`Promise.resolve()`。于是失败的报告通道从"reject `loadScript()`"变成"在
`instantiateWasm` 钩子里 reject"，而钩子的 reject 只能靠 frame 的
`unhandledrejection` 被 `installOpenFailureGuard` 捡起来。

问题出在它的准入条件：

```js
const OPEN_FAILURE_PATTERN = /Document conversion failed|Conversion failed with code|X2T module/i;
```

分配失败能进（走 `isWasmAllocationFailure` + `WASM_ALLOCATION_CONTEXT` 那一支），
**其余全都进不去**——`x2t.wasm.gz` 404、传输中断、`instantiateStreaming` 拒绝
一个非 wasm 响应，消息里一个关键词都不带。守卫直接 return，
`successCallback` 永远不会被调用，用户盯着转圈，直到 `doInitialize` 的
`INIT_TIMEOUT = 60000` 才落地。缓冲路径上同一个失败是**立刻**报出来的。

修法：catch 里带前缀重抛，前缀用守卫本来就认的 `X2T module`，原文接在后面。

```js
throw new Error('X2T module failed to instantiate: ' + ((error && error.message) || String(error)));
```

**拼接而不是替换**是关键：前缀决定守卫认不认，后面那段决定
`classifyOpenFailure` 读出什么——OOM 仍然判 `environment` 并触发重开，
404 仍然被 `Failed to fetch` 那条规则命中。两件事同时成立。

钉法：`vendor-contract.test.ts` 把 `X2T module failed to instantiate` 加进
x2t_helper 的符号清单（重新 vendor 时会掉，掉了就红）；
`onlyoffice-open-failure.test.ts` 加两条——守卫认下带前缀的 404，
以及带前缀的 OOM 仍然分类为 `environment`。

顺带把 `sniffAndRebuild` 的嗅探改成**先拼接再取头两字节**。原来是
`prefix[0][1]`／`prefix[1][0]`，reader 把两个魔数字节拆到不同 chunk、或先给一个
空 chunk 时会读成"不是 gzip"，然后把压缩字节直接喂给引擎。

## 2. `packages/converter` 的第二份加载器没跟上

`X2TConverter` 有两份：vendor 侧的 `x2t_helper.js`（编辑器 iframe 跑的那份）与
`packages/converter/src/document-converter.ts`（发布出去的包）。流式路径只加在
前者，后者仍然把 40 MB 解压副本握在手里、握到 WebAssembly 向浏览器要 283 MB
的那一刻——正是 #144 的那一刻。

本站不受影响（`lib/converter.ts:24` 的实例只走 SheetJS，页面侧从不加载 x2t），
但这个包是给生态另外两处站点用的，两份实现语义不该分叉。所以把同样的两条路径
搬了过来：`canStreamWasm()` / `sniffAndRebuild()` / `installStreamingInstantiate()`，
`prepareWasmBinary` 降级为兜底。错误前缀抽成 `x2tInstantiateError()` 导出——
钩子那条 reject 在设计上就是"无人 catch 的"（它要变成
`unhandledrejection`），拿它做断言只会污染测试运行；把消息构造单独导出，测试
就能直接钉契约。

新用例 `test/unit/converter-wasm-loading.test.ts`：`sniffAndRebuild` 四种输入
（已解压 / 仍是 gzip / 跨 chunk 含空 chunk / 空 body）、两条路径的选择、
钩子同步返回 `{}`（同步抛会被 `createWasm()` 变成致命的 `false`）、
以及前缀 + 原因并存。

## 3. `@serial` 的排除只写在 CI

`--grep-invert @serial` 原来是 CI 命令行参数，于是本地
`pnpm run test:e2e:docker`、本地跑 pages 配置，**测的集合和它们要复现的那个 job
不一样**——会去测一条 CLAUDE.md 明说这两套不测的时序预算。挪进配置：
`playwright.pages.config.ts` 与 `playwright.docker.config.ts` 各加
`grepInvert: /@serial/`，CI 那两处参数删掉。
`workflow-contract.test.ts` 的断言也从"CI 命令行含该参数"改成"两个配置含
`grepInvert`"——钉在唯一真源上。

主套件保持原样（`package.json` 的 `test:e2e` / `test:e2e:serial` 一对），因为
同一个 `playwright.config.ts` 要同时服务并行那趟和独占那趟。

## 4. runtime cache 的余量从"估计"变成"量出来"

按 vendor 内容命名 runtime cache 之后，**日常部署路径上没有任何东西会清空它**：
`pruneAppAssets` 有窗口就跳过，而 vendor 未变的部署现在在 install 期就接管，
`activate()` 必然在有窗口时跑。退役构建的 `/assets/<hash>` 会一直堆到"某次所有
标签页都关掉之后的激活"。撑住这件事的是 `limitCacheSize` 优先淘汰非 vendor
条目——**但这只在 vendor 那一半本身远低于上限时才成立**。

`MAX_RUNTIME_ITEMS = 2000` 原注释自称"informed estimate, not a measured figure"。
现在 `sw-warm.spec.ts` 在真实打开之后把数字量出来并设界：从 `sw.js` 里读
`MAX_RUNTIME_ITEMS`（不硬抄），断言 vendor 条目数 < 上限的一半。界放得松，
它要抓的是"某次 vendor 升级把工作集翻倍"，而不是日常波动。

## 验证

- 单元 725/725（37 文件）、`lint:ts`、`format:check` 全过
- 反向验证：抽掉原生控件的 `box-sizing` / `.agent-panel` 的 border-box →
  `styles-contract` 两条红；删掉 `playwright.docker.config.ts` 的 `grepInvert`
  → `workflow-contract` 红；去掉 x2t_helper 的错误前缀 → `vendor-contract` 红。
  恢复后全绿。
- E2E 未在本轮跑（sw-warm 的余量断言、wasm-memory 的流式断言需要真实编辑器）。

## 第三轮 review：这批追补自己带出来的三条（2026-08-20，同日）

上面四条落地后又过了一遍 diff。三条，都在流式路径上。

### 5. 守卫 10 在缓冲路径上什么都没释放

`releaseWasmBinary` 清的是 `Module.wasmBinary`。但 x2t.js 是**未包裹的 classic
script**，它自己第 254～255 行是：

```js
var wasmBinary;
if (Module['wasmBinary']) wasmBinary = Module['wasmBinary'];
```

`var` 在 classic script 顶层就是 frame 的 window 属性，而这一份引用**从头到尾没人
清**。所以清掉 Module 上那个属性之后，同一个 40.2 MB ArrayBuffer 仍然以
`window.wasmBinary` 活到 frame 结束——这条守卫在缓冲路径上等于没写。合成单测看不见
（它只造 `Module`），E2E 那条也看不见（它跑的是流式路径，压根没有这个缓冲区）。

emscripten 只在 `createWasm` 里读它（`getBinary` / `instantiateAsync`，都在启动
路径上），而 `calledRun` 严格晚于那里，所以两份引用都可以在同一时刻置空。

反向验证：新用例 "drops x2t.js's own global reference too" 与 "drops both references
when the release comes from the calledRun watcher"——只清 Module 那一份时两条都红。

### 6. 流式失败会把 initialize() 挂到超时

第 1 条给钩子的失败加了 `X2T module` 前缀，让它能被 `installOpenFailureGuard` 认出来。
但那只解决了"谁来报错"，没解决"谁来结束等待"：钩子跑的时候 `loadScript()` **早就
resolve 了**（`<script>` 本身加载正常，失败的是它背后的 wasm），emscripten 的
`successCallback` 永远不会被调用，`onRuntimeInitialized` 也永远不会触发——于是
`doInitialize` 里那个 Promise 没有任何人 settle，一直等到 `INIT_TIMEOUT`
（vendor 侧 60s，包侧 **300s**）。缓冲路径上同一个失败是立刻 reject 的。

编辑器里因为有守卫捡 `unhandledrejection`，用户还能较快看到 toast；但
`packages/converter` 那份**没有任何守卫**，纯 300 秒。

修法（两份对称）：钩子的 catch 里把失败记在实例上并通知在等的那一个，然后**照旧
rethrow**（rethrow 是给守卫看的，通知是给 `doInitialize` 看的，两件事都要）。
`doInitialize` 进来先看有没有已记录的失败，没有就注册通知回调；成功与失败路径都把
回调清掉。刻意是**粘性**的：x2t.js 在这个 frame 里已经跑过一次 `createWasm`，没法
让它再跑一次，所以同 frame 内不存在"重试成功"这种可能——恢复手段是新 frame，正是
编辑器的打开失败重试在做的事。

### 7. `loadScript()` 在已加载时返回 `undefined`

`if (this.hasScriptLoaded) return`（vendor 侧）——而 `doInitialize` 写的是
`this.loadScript().then(...)`。这一行是既有代码，但**流式路径让它变成常走的分支**：
`<script>` 加载成功 → `hasScriptLoaded = true` → 背后的 wasm 才失败，于是第二次
尝试直接 `undefined.then is not a function`，同步抛出 `initialize()`。改成
`return Promise.resolve()`。包侧的 `loadScript` 是 `async`，本来就没这个问题。

### 用例：`test/unit/x2t-helper-loading.test.ts`（新增）

vendor 侧那份此前只有 `vendor-contract.test.ts` 的**文本钉**，钉不到行为。新文件
直接 `new Function(readFileSync(...))()` 求值 `x2t_helper.js`（它是个自洽 IIFE，
发布 `AscCommon.x2t`），然后真的驱动 `installStreamingInstantiate` / `doInitialize`
——和 `sw-register.test.ts` 驱动真文件而不是抄一份是同一个理由。四条：钩子同步返回
`{}`、失败当场 reject 待决的 `doInitialize`、失败发生在 initialize 之前也当场
reject、已加载时 `loadScript()` 仍返回 promise。

包侧两条加在 `test/unit/converter-wasm-loading.test.ts`。

反向验证：去掉通知 → vendor 侧两条各挂 5s（vitest 超时）变红，包侧同样两条变红；
把 `Promise.resolve()` 改回裸 `return` → vendor 侧三条立刻红（`undefined.then`）。

**顺带一个坑**：`test/unit/converter-wasm-loading.test.ts` 从 `@ranuts/converter`
导入，而包的 exports 指向 `./dist/index.js`——本地跑的是**上一次构建的产物**，改了
`packages/converter/src/**` 不重新 `pnpm --filter @ranuts/converter run build`
就还在测旧代码（CI 上没这个问题：pnpm 安装 workspace 依赖时会跑包的 `prepare`）。
第三轮 review 就在这里先被骗了一次：改完源码用例照旧超时，看着像修复无效。

### 8. CI 里 `@serial` 那趟的注释低估了它的成本

`.github/workflows/ci.yml` 那步注释写"It is a single case -- seconds, not minutes"。
用例本身是秒级，但那一**步**不是：它是第二个 `playwright test` 进程，CI 里
`reuseExistingServer` 为 false，于是每个分片要再付一次完整的 `vite build` + preview
启动（约 1 分钟）。这个代价该不该付是另一回事（不付就没有任何东西再测那个预算），
但注释不该把它说成秒级。已改成实话。
