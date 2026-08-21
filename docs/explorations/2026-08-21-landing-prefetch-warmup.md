# 首页空闲时预热编辑器：分层、量化，以及一个差点交付的假成功

日期：2026-08-21
分支：`perf/landing-warmup`
起因：用户反馈"进入首页后，第一次打开文档都很慢"，期望后台默默加载，加载过一次之后走 SW

## 先把数字量出来

自建记账服务器 + Playwright，模拟一个真实访客：

| 阶段             | 请求数 | 字节         |
| ---------------- | ------ | ------------ |
| 停在首页         | 21     | **0.51 MB**  |
| 接着打开一个文档 | 75     | **34.12 MB** |

首页 0.5 MB，随后的第一次打开 34 MB——而首页在这整个下载过程中是**闲着的**，且它是每个访客的必经之路。

打开时的大头：

| 字节     | 文件                                      |
| -------- | ----------------------------------------- |
| 13.67 MB | `/sdkjs/word/sdk-all.js`                  |
| 4.13 MB  | `/fonts/022`                              |
| 3.45 MB  | `/sdkjs/common/libfont/engine/fonts.wasm` |
| 2.07 MB  | `app.js`                                  |
| 1.91 MB  | `sdk-all-min.js`                          |
| 1.50 MB  | `ChartStyles.js`                          |
| 1.15 MB  | `code.js`                                 |

（打开**已有文件**还要再加 9.4 MB 的 `x2t.wasm.gz`——`?new=` 不走转换，所以上表没有它。）

原来的 `landing-prefetch.js` 只在 hover 时预取 4 个 JS，**最大的两块二进制根本没覆盖**：
`fonts.wasm` 和 `x2t.wasm.gz`。

## 字体：先量再决定预取哪些

用户提到字体也该提前加载。字体目录整个 341 MB / 267 文件，显然不能全预取。
所以先量"三种编辑器各自加载哪些 catalog 条目"：

| 格式         | 条目数 | 字节         |
| ------------ | ------ | ------------ |
| docx         | 14     | 7.49 MB      |
| xlsx         | 5      | 2.52 MB      |
| pptx         | 21     | **18.22 MB** |
| **三者交集** | **4**  | **0.95 MB**  |

交集是 `/fonts/072 074 075 076`——**0.95 MB，命中率 100%**，无论访客打开什么都要用。
这个值得无条件预热。

格式特定的部分差异太大（xlsx 2.5 MB vs pptx 18 MB），而且 catalog 索引会随 vendor 升级
漂移，硬编码一大串索引很脆弱。这部分留给按需加载 + SW 缓存。

## 分层

**Layer 1 — 后台，不需要意图。** 所有格式都要的那部分：API loader、字体引擎
（`fonts.js` + `fonts.wasm`）、上面那 4 个公共 catalog 条目、以及 `x2t.wasm.gz`
（首页的主 CTA 就是打开已有文件）。约 14 MB。

**Layer 2 — 意图。** hover / focus / touch 某个 CTA 时，补上该格式的 shell 与 SDK
（`app.js`、`code.js`、`sdk-all-min.js`、`sdk-all.js`），也就是剩下的大头。
顺带发现 `code.js`（1.15 MB，每次打开都要）此前不在清单里，而它旁边的 `app.js` 在。

门槛分开：意图层沿用旧规则（非 Save-Data、非 2G）；后台层要求更严
（`effectiveType === '4g'` 或 API 不可用），因为**没人要求过它**，不该花掉计费或慢速连接。

顺序按编辑器真实加载顺序、**串行**执行：一个被点击打断的预热，已完成的部分正好是最先
要用的；而并发拉满连接的"预热"不叫预热。

## 一个差点交付的假成功

第一版实现看起来是对的，E2E 也绿了。跑对比基准时却是这个结果：

```
cold visitor:   28.25 MB
warmed visitor: 32.77 MB      ← 预热之后反而多下了 4.5 MB
```

诊断下去：`CORE held: 2 | missing: 6`——**只有两个小文件进了 cache**，
`fonts.wasm`、4 个字体、`x2t.wasm.gz` 全都没有。

根因是 `fetch()` 之后**没有消费 response body**。SW 缓存这些文件的方式是
`response.clone()` 然后 `cache.put(clone)`，而一个没人读的流可以在克隆复制完成之前
就被丢弃——于是 `cache.put` 永远完不成。小文件在单个 chunk 内侥幸成功，大文件必然失败。
**恰好是反的**：预热最该覆盖的就是大文件。

修法是把响应读到底再丢弃，用 reader 逐块读而不是 `arrayBuffer()`，免得为了扔掉 9.4 MB
而先把它放进内存：

```js
var reader = response.body.getReader();
(function pump() {
  return reader.read().then(function (r) {
    return r.done ? undefined : pump();
  });
})();
```

**这个 bug 差点被我自己的测量掩盖过去。** 用来判断"预热完成"的
`page.waitForFunction(async () => ...)` 对 async predicate 的处理不可靠（返回的 Promise
本身就是 truthy），所以它立刻返回了 true，基准脚本以为预热完成就开始计量。改成用
`page.evaluate` 直接 await 暴露出来的 `warmSerially(CORE)`，数字才是真的。

E2E 里用的是 `expect.poll(async () => ...)`，那个会正确 await，所以用例本身是可信的——
但它也因此没能替我拦下这个 bug，因为在 E2E 环境下预热最终确实完成了。真正拦下它的是
**做了一次端到端的字节对比**，而不是只断言"东西在 cache 里"。

## 修好之后

```
cold:   74 requests, 34.12 MB, ready 2366 ms
warmed: 67 requests, 29.60 MB, ready 2300 ms   (8/8 核心文件已缓存)
saved:  4.52 MB
```

4.52 MB = `fonts.wasm` 3.45 + 公共字体 0.95 + 两个小文件。`x2t.wasm.gz` 的 9.4 MB 在
`?new=docx` 这个场景下体现不出来（不走转换），**打开已有文件时才生效**——那正是首页
CTA 的主路径。

首页自身没有退化：FCP 84 ms / 52 ms，与改动前的 80 ms 一致（idle 触发 + 串行 + 低优先级）。

## 用例

`test/e2e/landing-prefetch.spec.ts` 三条：

1. 不做任何交互，核心资源最终全部进入 **SW cache**（不是 HTTP cache——worker 对 vendor
   树是 cache-first，它没有的条目即使浏览器还留着副本也会重新请求，这正是"第二次访问
   免费"的前提）
2. 预热的每个字体条目，都必须是三个编辑器真实请求过的——**vendor 升级重新编号 catalog
   时，这条会红**。否则预热的是四个没人要的文件，而真正要用的仍然是冷的，且预取失败
   没有任何可见症状
3. 预热之后打开文档，核心文件不再走网络

反向验证：关掉后台层 → 第 1 条红；把 `/fonts/072` 换成一个没人请求的索引 → 第 2 条红，
报错信息直接指向"catalog 大概被 vendor 升级重新编号了"。

## 没做的

自动预取格式特定的引擎（每种约 20 MB，三种加起来 50 MB+）。意图层已经覆盖它，而无条件
下载 50 MB 是拿访客的流量赌他会打开文档。真要再快，方向是让 `sdk-all.js` 那 13.67 MB
本身变小，那是 vendor 侧的事。
