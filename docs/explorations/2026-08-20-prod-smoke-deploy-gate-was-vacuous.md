# 线上冒烟等的是一个不存在的文件名（2026-08-20）

日期：2026-08-20 · 相关：[#159](https://github.com/ranuts/document/pull/159) 合并后 main 的两处红

#159 合并进 main 之后，`Production smoke` 与 `CI` 各红一条。两条都不是被合并的代码坏了，
但其中一条是**长期存在、这次才被看见**的真 bug。

## 一、Production smoke：部署门禁一秒放行

红的是 #159 新加的用例：

```
✘ app-smoke.spec.ts › the editor page fits the viewport and renders in the ranui typeface
  Expected: 700    Received: 724
```

24px 正是那个 `visibility: hidden` 的 file input——也就是说**它测到的是旧构建**。

`prod-smoke.yml` 的「等这次提交上线」那一步是这么写的：

```sh
ASSET=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1)
LIVE=$(curl -s "$PROD_URL/"      | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
[ "$LIVE" = "$ASSET" ] && exit 0
```

**2026-08-16 路由拆分之后，`/` 是不带 bundle 的静态落地页**，`index.html` 里根本没有
`assets/index-*.js`。于是 `ASSET` 是空串、`LIVE` 也是空串，第一轮就相等：

```
expecting
live after 20s
```

从路由拆分那天起，每一次 push main 之后的线上冒烟，**都是对"当时碰巧还在线上的那个构建"**
跑的。之前一直绿，是因为没有任何一条用例能分辨新旧构建；#159 加了两条能分辨的，
它立刻显形——而且显形的方式是"新代码在线上是坏的"，最容易把人带偏。

修法：

- 盯 **editor 页**的入口资源（`assets/editor-<hash>.js`，取自 `dist/editor.html`，
  轮询 `$PROD_URL/editor`）——那是真正带构建产物的页面；
- `ASSET` 为空直接 `::error::` 退出，不再"空等于空"地免费通过。一个说不出自己在等什么的
  门禁没有存在价值。

`workflow-contract.test.ts` 把两条都钉住了，并且顺带钉住前提：editor 页有 module script、
落地页没有。反向验证：把这一步换回旧写法，两条用例变红。

## 二、CI（e2e-pages 分片 5）：wrangler 中途崩了

时间线（同一个分片，日志里连着）：

```
14:33:19  ✓ visual-roundtrip docx（存回再打开，多 MB）
14:33:21  [WebServer] ✘ [ERROR]           ← workerd 挂了，日志写进 wrangler 的 log 文件
14:33:23  ✘ visual-roundtrip pptx          "The document failed to open: Failed to fetch"
14:33:24  ✘ 同一条 retry #1（345ms）        ERR_CONNECTION_REFUSED
14:33:44  ✓ visual-roundtrip xlsx           ← 服务器已经自己回来了
```

`bin/serve-pages-dev.sh` 的重启循环工作正常（约 20 秒回来），CLAUDE.md 里也早写了
「并发下 workerd 会被大文件 abort 打崩」——所以那套才是单 worker。缺的是**另一半**：
Playwright 的 webServer 就绪检查只在启动时做一次，重试又是立刻发出的，于是崩溃的那一下
同时带走"当时那条用例"和"它的重试"，整片红给一个 20 秒后就恢复的服务器。

修法：`test/e2e/lib/l0.ts` 里加一个 auto fixture，在每条用例开始前先问一次端口；答得上来就
什么都不做（一个请求的成本），答不上来才等（最多 60s）。由 `playwright.pages.config.ts` 设
`E2E_WAIT_FOR_SERVER=1` 打开——**只对这一套**。别的套由不会中途消失的服务器托着，在那儿等
只会把"服务器根本没起来"藏起来。

**等待的时间要额外补给用例，不能从它自己的预算里扣**：默认超时 30s，重启要 20s，扣完只剩
10s 去打开一篇文档，用例照样红，只是理由更难看。所以进入等待前先
`testInfo.setTimeout(testInfo.timeout + 60s)`。实测（把 baseURL 指向一个死端口）：
补预算之前失败信息是 `Test timeout of 30000ms exceeded while setting up "serverUp"`，
补之后是 fixture 自己的 `server at … did not come back within 60000ms`——等满了 60 秒才放弃。

`workflow-contract.test.ts` 把重启循环与等待 fixture 钉成一对（缺任一半，红）。
