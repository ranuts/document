# Changelog — issue #144：x2t 内存 + 发布投递（一页纸）

日期：2026-08-20 · 分支：main（PR 制）· 相关 issue：[#144](https://github.com/ranuts/document/issues/144)

给新开会话看的一页纸：**#144 现在什么状态、别再试什么、数字在哪、怎么验证、下一步等谁。**
逐步细节见 [x2t OOM 排查](../explorations/2026-08-20-x2t-wasm-oom-misclassified.md) 与
[SW 更新从不提升](../explorations/2026-08-20-service-worker-update-never-promoted.md)。

## 一句话结论

**#144 没有解决，而且真因是结构性的。** 报告人的浏览器分配不出 x2t 的 wasm 堆；
x2t 要 **283 MB 起步**，而这个数字**动不了**（模块静态/BSS 下界 267.3 MB）。本轮修掉的
是围绕它的一切——误诊、被跳过的重试、40 MB 峰值、以及"修好的东西根本发不到用户手里"
——但没有、也无法降低那个内存要求。**下一步等报告人的截图**（新提示会在方括号里带回
`[memory: reservation|commit|ok, build: x86-32|x86-64]`），那串字决定还有没有牌可打。

## 现场事实（issue 里给的，不是推断）

- 两台 Win11，Chrome 135 与 150 **都失败**；同机 **Edge 151 正常**（→ 他手上已有可用绕行）。
- **新建文档正常，只有打开本地文件失败**——新建不走转换，与 x2t 精确对应。
- 最新一次在**无痕窗口**复现：冷 profile、首次打开，不存在"上一个 frame 占着内存"。
- 前两轮诊断（字体竞态 #146/#148、镜像强缓存 #154）都不是他的问题。

## 数字（全部实测，不是估计）

| 项                 | 值                                                           |
| ------------------ | ------------------------------------------------------------ |
| x2t 声明 initial   | 4533 页 = **283 MB**（每个编辑器 frame，实例化时一次性提交） |
| x2t 声明 maximum   | 32768 页 = 2048 MB（硬上限）                                 |
| **静态/BSS 下界**  | **4277 页 = 267.3 MB** ← `initial` 不可能低于它              |
| 声明与下界之间余量 | 256 页 = 16 MB（没什么可回收）                               |
| 实测峰值堆         | 340 MB（打开）／**408 MB**（2 万行保存、4 万行导出 PDF）     |
| x2t.wasm.gz        | 9,483,006 字节（zopfli `--i15`；vendor 原始 9,860,417）      |

`node bin/x2t-memory-report.mjs` 现场重新量，别抄这张表。

## 别再试这些（负面知识，最容易被重新踩）

| 想法                                                 | 为什么不行                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 调小 x2t 的 `initial`（283 MB → 64 MB）              | **试过、炸了、已回滚**。静态/BSS 铺到 267.3 MB，2501 个不可变 i32 global 里烧死了那些地址；内存变小后第一次访问就 `RuntimeError: memory access out of bounds`，**在读到任何文件之前**             |
| 调小 `maximum` 省预留                                | 硬上限（`_emscripten_resize_heap` 直接 `return false`），砍它 = 砍大文档的能力；且 glue 的 `getHeapMax()` 硬编码 2 GB。**只在截图显示 `reservation` 时才值得作为取舍讨论**                        |
| 抬高 `maximum` 到 2 GB 以上                          | 需要重新编译（32 位指针符号问题），我们用的是第三方编译包                                                                                                                                         |
| 重建编辑器前把旧 frame 导航到 `about:blank` 释放内存 | **试过、已回滚**。确实释放，但掐断 vendor 在 document-ready 之后仍在取的 SVG 图标请求 → 每次文档切换 `TypeError: Failed to fetch`，整套 E2E 挂 3 条；而且对 #144 无用（首次打开没有上一个 frame） |
| 用 brotli 替换 x2t.wasm.gz                           | `DecompressionStream` 只支持 gzip/deflate/deflate-raw，**没有 br**                                                                                                                                |
| 用 Node zlib 重压 x2t.wasm.gz                        | +575 KB。用 `zopfli --gzip --i15`（不是仓库依赖，vendor 升级后手动重跑）                                                                                                                          |
| 把 SW 的 runtime cache 按构建戳命名                  | 那样**每次部署**都像要抽走引擎资源 → 每次都要协调 → 谁都没协调成 → 用户永远跑旧代码。按 vendor 内容哈希命名才对                                                                                   |
| 只在编辑器页做 SW 更新提升                           | `/editor` 的打开流程排在 SW 注册**之前**，`hasOpenDocument()` 永远为真，闸永远关着。提升必须由落地页负责                                                                                          |

## 本轮修了什么

| #   | 缺陷                                                         | 位置                                                                                        |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | `Aborted(` 无条件判 `document` → 重试被跳过                  | `lib/onlyoffice/open-failure.ts`                                                            |
| 2   | `OPEN_FAILURE_PATTERN` 不匹配分配失败 → guard 整个分支被跳过 | 同上                                                                                        |
| 3   | 只要 -82 就说"文件可能已损坏"                                | `lib/onlyoffice-editor.ts` 的 `onError` + 8 语言新文案                                      |
| 4   | 40.2 MB 解压副本压在失败那一刻                               | `x2t_helper.js` 改流式实例化；无流式能力时回落缓冲 + 守卫 10 回收                           |
| 5   | **等待中的 SW 从不被提升**（修好的东西发不出去）             | 新增 `public/sw-register.js`；`sw.js` 加 `CLIENT_COUNT`；runtime cache 改按 vendor 内容命名 |
| 6   | 顺带：最大下载小 377 KB                                      | zopfli `--i15`；契约改钉**解压后内容**的 sha256                                             |

## 东西在哪

- 内存声明/探测/分类：`lib/onlyoffice/wasm-memory.ts`、`lib/onlyoffice/open-failure.ts`
- 40 MB 回收守卫（守卫 10）：`lib/onlyoffice/guards/wasm-binary-release.ts`
- 流式实例化：`public/sdkjs/common/wasm/x2t/x2t_helper.js`（我们的补丁，`vendor-contract` 钉住）
- SW 投递：`public/sw-register.js`、`public/sw.js`、`lib/sw-update.ts`、`bin/build.sh`（两个版本戳）
- 只读诊断：`node bin/x2t-memory-report.mjs`
- 用例：`test/unit/onlyoffice-wasm-memory.test.ts`、`test/unit/sw-register.test.ts`、
  `test/unit/sw-update.test.ts`、`test/e2e/wasm-memory.spec.ts`、`test/e2e/sw-warm.spec.ts`、
  `test/e2e/open-retry.spec.ts`（含 OOM 那条）

## 怎么跑

```bash
pnpm run test                    # 全部单测（当前 733）
pnpm run test:e2e                # 默认套件（不含 @serial）
pnpm run test:e2e:serial         # 时序预算用例，单 worker 独占——本地要跑全须两条都跑
node bin/x2t-memory-report.mjs   # 重新量 initial / maximum / 静态下界
```

`@serial` 那条跑道是本轮新建的：时序预算用例（目前只有 open-retry 的字体等待）从并行池里
`--grep-invert` 掉，再独占跑一趟。两半由 `workflow-contract.test.ts` 钉成一对——单删任一半都变红。

## 下一步（等谁）

1. **等报告人的截图**，看方括号：
   - `reservation, x86-32` → 32 位 Chrome。让他装 **64 位 Chrome**（立刻可用）；我们这边唯一的牌是调小 `maximum`（取舍，需真实语料定新上限并让用户知情）。
   - `commit, x86-64` → 真的凑不出 283 MB。关标签页/其他程序；**我们无解**，除非换 x2t 构建。
   - `ok` → 当时是瞬时的，重试已覆盖。
2. **升级本身仍需一次硬动作**：本轮动了 vendor 树（流式补丁 + 重压缩），`VENDOR_VERSION` 变了 → 按新机制属于"真换了引擎资源"，走等待路径。所以**这一次**仍要无痕或关掉全部标签页；从下一次不动 vendor 的部署起才全自动。**这是机制在正确工作，不是遗留 bug。**
3. 真正的根治只有两条，都不在本仓库：换一个 `INITIAL_MEMORY` 更小的 x2t 构建（需上游/打包方配合），或长期迁 MEMORY64。

## 一处让步（写下来，不藏）

OOM 那条 E2E 用 `l0.allowAscError(id === '-82')` 而非 `expectAscError(-82)`：注入的拒绝在
`Asc.editor` 一出现就触发，会跑在 L0 每 250 ms 的挂钩轮询之前，观测到它有竞态。-82 确实
发生仍被要求——由断言里的 `code -82` 保证，那段文字只能经 SDK 自己的 asc_onError 路径到达页面。
