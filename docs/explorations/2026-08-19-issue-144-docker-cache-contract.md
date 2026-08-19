# issue #144 续：为什么"重拉镜像"之后错误一模一样 —— 自托管镜像的缓存契约

日期：2026-08-19
相关 issue：[#144](https://github.com/ranuts/document/issues/144)
前一轮：[2026-08-18-issue-144-open-conversion-environment-retry.md](2026-08-18-issue-144-open-conversion-environment-retry.md)

## 一、新的事实

08-18 我们改了三处（字体系统就绪后再转换 / 环境类失败自动重开一次 / toast 带上真实
原因），并在 issue 里请报告者刷新重试。08-19 回复：

> 我已重拉Docker镜像，但错误依旧，提示出错信息也是一样的。

"**一模一样**"这四个字是本轮唯一的硬证据。上一轮的改动只要真跑起来，界面就必然不同：

| 上一轮改动         | 用户可见的差异                         |
| ------------------ | -------------------------------------- |
| 环境类失败自动重开 | 先弹一条 info toast（"正在重试打开…"） |
| toast 带上真实原因 | 错误 toast 末尾多一段 `[TypeError: …]` |

两者都没出现 → **报告者的浏览器压根没在跑新代码**（或者跑到了、但失败走的是另一条
根本不经过我们那条 guard 的路径 —— 见第四节，两件事都要修）。

## 二、镜像换了，浏览器没换：static-web-server 的默认缓存头

`Dockerfile` 的运行阶段是 `joseluisq/static-web-server`，它**不读 `dist/_headers`**
（那是 Cloudflare Pages 的格式，只对线上生效）。它按扩展名给默认值。实测（2.42.0，
挂一个样本目录）：

```
/                    cache-control: max-age=86400
/editor.html         cache-control: max-age=86400
/assets/app.*.js     cache-control: max-age=31536000
/sdkjs/sdk-all-min.js cache-control: max-age=31536000
/sw.js               cache-control: max-age=31536000
/fonts/000           cache-control: max-age=86400
```

注意全部**没有 `no-cache` / `must-revalidate`**：在有效期内浏览器根本不会问服务器。
于是自托管链路上出现一个致命组合：

- `editor.html` 缓存 **1 天**，而它引用的是**哈希化**的 bundle
  （`./assets/editor-C4gAPO3j.js`）；
- 只要浏览器手上还有昨天的 `editor.html`，它就会去加载**昨天那个哈希名**的 bundle；
  而 `/assets/*.js` 被服务器标了 **1 年**，那份旧 bundle 也正躺在同一个浏览器缓存里
  —— 于是**两个文件都不经过服务器**，页面完整跑起来，跑的却是旧代码。新镜像里
  根本没有那个哈希名的文件，但浏览器压根没去问；
  （另一半概率是旧 bundle 已被浏览器淘汰：那就变成 404 + 白页，也是这条链路的
  经典症状，`public/_headers` 开头那段注释记的就是它。）
- `Ctrl+F5` 只对**当次导航**绕过缓存。报告者从落地页 `/` 强刷，再点进 `/editor`
  是**一次新的导航**，仍然吃那 1 天的缓存 —— 强刷了，也还是旧的。
- `sw.js` 被标了 1 年（浏览器规范把 SW 脚本的缓存上限压到 24 小时，所以没有更糟，
  但新 SW 最长也要一天才被发现）。
- 厂商 JS（`sdkjs/**`、`web-apps/**`，其中 `x2t_helper.js` 带着我们自己的补丁）标 1 年
  且不校验 —— 一旦哪次升级动了它，自托管用户可以抱着旧文件跑一年，还会和新的
  `AllFonts.js` / 字体目录混搭，正是"半初始化 → -82"的温床。

线上没这个问题（`public/_headers` 把契约钉死了），**只有自托管中招**，而报告者正是
自托管。这一条足以解释"重拉镜像 + 强刷 = 完全一样的报错"。

## 三、修法：给镜像一份和 `_headers` 对等的契约

新增仓库根目录 `sws.toml`（static-web-server 的 `[[advanced.headers]]`），
`Dockerfile` 里 `COPY sws.toml /sws.toml` + `ENV SERVER_CONFIG_FILE=/sws.toml`。
规则按"后面的覆盖前面的、按 header 合并"的语义写：

| source                            | Cache-Control                              |
| --------------------------------- | ------------------------------------------ |
| `**`（兜底）                      | `no-cache`（每次校验，命中就是 304）       |
| `/assets/**`、`/ran-tokens.*.css` | `max-age=31536000, immutable`（内容寻址）  |
| `/fonts/*`、`x2t.wasm.gz`         | `max-age=31536000, immutable`（随 vendor） |
| `/ran-fonts/**`                   | `max-age=604800, must-revalidate`          |

即：**默认全部校验，只有名字里带内容哈希、或随 vendor 整体更换的大文件才长缓存** ——
和 `public/_headers` 一字不差的取舍。实测 static-web-server 支持 `Last-Modified`
条件请求，校验的代价是一个 304，不是重新下载。

## 四、-82 这张截图本身信息量为零

顺带钉死上一轮没覆盖到的一条：厂商在编辑器 frame 里**自己装了**全局错误钩子
（`sdkjs/*/sdk-all-min.js`，`asc_docs_api._init`）：

```js
u = function (msg, script, ...) {
  ...
  r.isLoadFullApi &&
    (r.isDocumentLoadComplete
      ? r.sendEvent('asc_onError', EditingError, NoCritical)
      : r.sendEvent('asc_onError', ConvertationOpenError /* -82 */, Critical));
};
a.onunhandledrejection = ...; a.onerror = ...;
```

也就是说：**文档加载完成之前，frame 里任何一个没被接住的错误 —— 不管来自哪 ——
都会变成同一个 -82 + 同一个"打开文件时发生错误"对话框**。我们的
`installOpenFailureGuard` 只认 `Document conversion failed|Conversion failed with code|X2T module`
这几种 message，其它一律不记 `documentOpenError`，toast 里的 `[原因]` 就是空的 ——
**和修复前逐字节相同**。所以"提示一样"也可能是"走了另一条路"，两种可能都得堵上：

- `installOpenFailureGuard` 现在同时监听 frame 的 `error` 与全部
  `unhandledrejection`，把**文档就绪前的第一条**错误记进 `lastFrameError`
  （过滤扩展程序与跨域脚本，和厂商自己的过滤口径一致）；
- toast 的 `[原因]` 优先用 guard 抓到的转换失败，没有就用 `lastFrameError`
  （`describeOpenFailure`，纯函数，已单测）；
- 厂商自己报的 -82（没经过我们的 guard）现在也会 `markDocumentOpenFailed`，
  于是打开失败后的保存**立刻拒绝**，不再等满超时。

## 五、用例与反向验证

- `test/unit/hosting-contract.test.ts` 新增 `sws.toml` 一节：兜底必须是 `no-cache`、
  immutable 集合必须与 `_headers` 一致、厂商目录不许 immutable、`Dockerfile` 必须真的
  加载这份配置（"配置文件在仓库里但服务器不读"是最容易骗过评审的一种绿）。
- `test/e2e/docker-cache-headers.spec.ts`（仅 `E2E_DOCKER=1`，由
  `playwright.docker.config.ts` / `bin/test-e2e-docker.sh` 设置）：对**真容器**断言
  `/`、`/editor`、`/sw.js`、`/home.css` 为 `no-cache`，哈希 bundle / 字体目录 /
  x2t wasm 为 immutable，并验证一次校验换回 304。
- **反向验证（已跑）**：`docker pull ghcr.io/ranuts/document:latest`（正是报告者拉到
  的那个镜像）→ `docker tag ... document:e2e` → 同一条 spec 立刻变红：

  ```
  ✘ every unhashed path revalidates …   Expected: "no-cache"  Received: "max-age=86400"
  ✘ hashed and vendor-versioned payloads stay immutable
        Expected pattern: /max-age=31536000.*immutable/  Received: "max-age=31536000"
  ✓ a revalidation costs a 304, not a re-download
  ```

  换成本次修复构建的镜像：3/3 全绿。也就是说，**报告者手上的镜像确实在用
  `max-age=86400` 发 HTML** —— 浏览器一整天不会回来问一次。

- `describeOpenFailure` / `noteFrameError` 的取舍（截断、只留第一条、跳过
  `chrome-extension://` 与 `Script error.`）在 `test/unit/onlyoffice-editor.test.ts` 覆盖。

## 六、给报告者的话

镜像已修，但**已经中过招的浏览器需要一次真正的清理**才能跳出旧缓存：无痕窗口、
或清掉该站点的缓存（DevTools → Application → Clear site data，含 Service Worker）。
之后若仍报错，新 toast 会在方括号里写明真实原因，那才是可以继续查的输入。
