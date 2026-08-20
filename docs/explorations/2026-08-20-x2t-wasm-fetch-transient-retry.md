# x2t.wasm.gz 拉取失败一次 = 整篇文档打不开（PR #159 的红检查）

日期：2026-08-20
相关：PR #159（issue #144 的投递与内存修复）、`.github/workflows/preview-smoke.yml`

## 现象

PR #159 的 6 个必需检查里，只有 `Preview smoke against Cloudflare Pages` 红：

```
1) embed-regression.spec.ts:138 › runtime readonly toggle ...
   Error: page.evaluate: Error: The document failed to open:
   X2T module failed to instantiate: Failed to fetch x2t WASM at
   '../../../../sdkjs/common/wasm/x2t/x2t.wasm.gz' (500)
```

紧接着的两个用例各在 120 s 超时（`opens a docx from a buffer` 首跑超时、
retry 通过；只读切换 retry 也超时），窗口过去之后剩下的 20 多个用例全绿。

## 判定：不是 PR 的缺陷，是 CDN 那一下抖动

- 同一个 commit、同一个 preview 部署，**重跑该 job 全绿**，且耗时从 9m32s
  降到 3m26s——说明第一次那 4 分钟里 preview 本身在返 500 / 拉不动。
- 事后对该 preview URL 直接 curl 那个资源，连续 200，尺寸正确
  （9,483,006 字节，与仓库里 zopfli 压的那份一致）。
- 这条链路每跑一次 smoke 要把这 9.4 MB 取 34 遍（每个用例一个全新 context，
  SW 缓存不跨 context），本来就是整套里最容易撞上边缘故障的一环。

## 但它暴露了一个真实缺口

一次 500，用户看到的就是"文档打开失败"。当时这条路上唯一的补救是
`lib/onlyoffice/open-failure.ts` 的**整个编辑器重开**（environment 分类 →
重建 frame → 所有资源重下一遍）——代价大得多，而且那次连重开也落在同一个坏
窗口里，没救回来。

所以补一层最便宜的：**拉取本身重试**。

## 改动

`X2TConverter.fetchWasmResponse`（两份实现，语义保持一致）：

- `public/sdkjs/common/wasm/x2t/x2t_helper.js`（编辑器 iframe 里真正跑的那份）
- `packages/converter/src/document-converter.ts`（页面侧加载 x2t 的消费者用的那份，
  同时导出给单测驱动）

策略：

| 答复                        | 处理                                     |
| --------------------------- | ---------------------------------------- |
| 5xx / 408 / 429             | 重试（共 3 次，线性退避 0.5 s、1 s）     |
| fetch 本身 reject（断网等） | 重试                                     |
| 404 / 403 等                | 立即失败——那是部署事实，重试只是拖延错误 |

两条路径（streaming 与无流式能力时的 buffered 兜底）都走这个函数，所以行为一致；
converter 侧的 buffered 路径因此从 ranuts 的 `fetchMaybeGzip` 改成
`fetchWasmResponse` + `gunzipMaybe`（嗅探解压那半仍然是生态的）。

几点边界：

- **不保留任何跨次引用**，所以不会加重 streaming 路径专门要压下去的那个内存峰值；
  「分配失败绝不回落到缓冲路径」的既有约束原样保留——这里重试的是 fetch，不是
  instantiate。
- SW 的 cache-first 分支只缓存 `status === 200`，500 不会被写进 runtime cache，
  重试的第二次请求会真的再走一遍网络。
- 退避总共最多 1.5 s，比重开一个编辑器便宜两个数量级。

## 用例与反向验证

- `test/unit/x2t-helper-loading.test.ts`：直接 eval 线上那份 vendor 文件，新增
  4 条（5xx 重试成功 / fetch reject 重试成功 / 三次用尽报最后的状态码 / 404 只问一次）。
- `test/unit/converter-wasm-loading.test.ts`：同样 4 条，打包侧用 fake timers 跑完退避。
- `test/unit/vendor-contract.test.ts`：把 `WASM_FETCH_ATTEMPTS` 加进 x2t_helper 的
  符号钉子——重新 vendor 一次会像丢掉 streaming 补丁一样悄悄丢掉它。

反向验证（去掉修复后确认变红）：把两处 `fetchWasmResponse` 各自换回"一次 fetch、
非 ok 就抛"的原版，vendor 侧 3 条变红（`3 failed | 5 passed`）、converter 侧 3 条变红
（`3 failed | 12 passed`）；"404 只问一次"那条两边都仍然绿，符合预期——它钉的是
不该重试的一侧。恢复后两边全绿。

顺带改了两条既有用例的状态码（vendor 侧 503→403、converter 侧 503→403）：它们断言的是
"钩子失败时立刻 settle 掉在等的 doInitialize，而不是等到 INIT_TIMEOUT"，用可重试的
5xx 会把 1.5 s 退避混进这个断言里，用一个服务器会一直给的状态码才干净。

## 为什么不是 E2E

要在 E2E 里造这个 500，只能拦 vendor 树的请求，而 `page.route` 在页面被 SW 控制之后
就不生效（跑道三坑之一，见 CLAUDE.md）；单测直接驱动**线上那份真文件**，钉得比伪造
一次 CDN 故障更实。真实的 5xx 由 preview smoke 自己兜着——它已经抓到过一次了。
