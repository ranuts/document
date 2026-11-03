# 夜间跨浏览器全红：浏览器缓存没带发行版

2026-11-03 的 Nightly corpus（run 41561076181）cross-browser 红：WebKit 三个分片 + serial
全部 1ms 失败，Firefox 分片 2 有 4 条失败。

## 根因（WebKit）

日志里每条 WebKit 用例都是同一句：

```
MiniBrowser: error while loading shared libraries: libicudata.so.74: cannot open shared object file
```

- `ubuntu-latest` 从这周起指向 **ubuntu-26.04**（10-30 那次跨浏览器还是 24.04，全绿；
  中间两晚 gate 判定没有新提交、跨浏览器没跑，所以这是 26.04 上第一次跑）。
- Playwright 1.64 对每个 Ubuntu 版本发一套独立构建（`coreBundle.js` 里有
  `ubuntu24.04-x64` / `ubuntu26.04-x64` 两套下载项），WebKit 链接的是那个版本自己的 ICU。
- `.github/actions/setup` 的缓存 key 是 `playwright-Linux-1.64.0-webkit`——没有发行版。
  26.04 的机器命中了 24.04 时存进去的缓存，拿到的是 24.04 的 WebKit，而 26.04 上没有 ICU 74。
- 命中缓存时安装脚本直接 `exit 0`（不跑 apt，见 CLAUDE.md CI 一节），所以也没有任何一步会
  发现版本对不上。

## 改动

- 缓存 key 加上 `/etc/os-release` 的 `$ID$VERSION_ID` 与 `runner.arch`：
  `playwright-Linux-ubuntu26.04-X64-1.64.0-webkit`。换镜像就是冷缓存，走完整安装
  （含 `install-deps`），之后再命中的才是同一发行版的构建。
- `test/unit/workflow-contract.test.ts` 钉住 key 里的发行版段。反向验证：只撤
  action.yml 的改动，这条用例变红；恢复后 68/68 绿。

## Firefox 那 4 条

`agent-interface-affordances.spec.ts:65`：`Tab` 再 `Shift+Tab` 之后
"Import structured result" 按钮没拿到焦点（`inactive`），4 个视口/主题组合全挂、重试也挂。
Firefox 能启动，但跑的同样是 24.04 的构建，跑在 26.04 上。是不是同一个原因，本地（macOS）
复现不了；以修复后在分支上手动触发一次 nightly（`skip_corpus`）的结果为准，若仍红再单独查。

## 还没验证的一点

缓存命中时不跑 apt，前提是 runner 镜像本来就带齐浏览器要的库——这是 24.04 上读日志得出的
结论，26.04 上没验证过。验证方法：在分支上手动跑两次 nightly（第一次冷缓存，第二次命中），
第二次 WebKit 也能起来才算闭环。
