# wrangler 的默认 compatibility date 是个定时炸弹

2026-08-19

## 症状

2026-08-19 00:47 UTC 起，`E2E (Cloudflare Pages semantics)` 在**每个分支**上都红，
main 也不例外（PR #152 合并后 main 的那次 CI 就是这么挂的）。Playwright 报的是：

```
Error: Timed out waiting 300000ms from config.webServer.
```

这条信息毫无用处。真正的原因在它上面两百行，而且重复了十五遍：

```
✘ [ERROR] service core:user:<uuid>: This Worker requires compatibility date
  "2026-08-19", but the newest date supported by this server binary is
  "2026-08-18".
```

## 根因

`playwright.pages.config.ts` 里是 `pnpm dlx wrangler@latest pages dev dist ...`，
仓库里没有任何 wrangler 配置文件，也没传 `--compatibility-date`。wrangler 本人
把这件事说得很清楚：

```
▲ [WARNING] No compatibility_date was specified. Using today's date: 2026-08-19.
```

而它自带的 workerd 二进制只支持到**它自己发布那天**为止的日期。于是每当日期
翻到一个比当前 workerd 发布日更新的一天，"今天"这个默认值就越界，workerd 直接
拒绝启动。这不是抖动：它跟代码无关、跟分支无关，只跟日历有关，而且当天之内
必然 100% 复现。

本地一条命令即可复现（wrangler 4.123.0）：

```
$ pnpm dlx wrangler@latest pages dev <任意目录> --port 8791 --ip 127.0.0.1
▲ [WARNING] No compatibility_date was specified. Using today's date: 2026-08-19.
✘ [ERROR] ... but the newest date supported by this server binary is "2026-08-18".
```

加上固定日期就正常：

```
$ pnpm dlx wrangler@latest pages dev <任意目录> --port 8792 --ip 127.0.0.1 \
    --compatibility-date=2026-08-01
[wrangler:info] Ready on http://127.0.0.1:8792
$ curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8792/   # 200
```

## 为什么它伪装成超时

原来的 serve 命令是个无条件重启循环：

```sh
until pnpm dlx wrangler@latest pages dev dist --port $PORT --ip 127.0.0.1; do
  echo "wrangler pages dev exited, restarting"; sleep 1
done
```

这个循环本身有正当理由：workerd 在 CI 上会在浏览器中断 sdk-all.js 这种大文件
下载时**跑到一半崩掉**，崩了之后所有用例 ECONNREFUSED；重启循环让一次崩溃只
损失一个重试的用例，而不是整个 job。

但它不区分"跑着跑着崩了"和"压根没起来"。启动错误被它每秒重试一次，直到
Playwright 的 300 秒 webServer 超时，最后呈现给人的就是一句和真实原因毫无关系的
`Timed out waiting 300000ms`。调查成本几乎全花在这上面。

## 修法

新增 `bin/serve-pages-dev.sh`，两件事：

1. **固定 compatibility date**（`COMPATIBILITY_DATE=2026-08-01`）。老日期永远
   被支持，且本项目是纯静态资源、没有 Pages Functions，所以具体取哪天不影响
   行为，重要的是它写在提交里而不是由日历决定。
2. **重启循环会放弃**。活不过 10 秒的进程算"没起来"，连续 3 次就带着真实错误
   退出；活过 10 秒才崩的按原意重启，并把计数清零。

顺带把这段 shell 从 TS 模板字符串里搬进 `bin/`——模板字符串里写 `${}` 的 shell
变量要转义，是纯粹的雷区，而且 `bin/` 本来就是这个仓库放脚本的地方。

## 用例固化

`test/unit/workflow-contract.test.ts` 增三条：脚本必须传 `--compatibility-date`
且日期写死、必须有放弃阈值、`playwright.pages.config.ts` 不许再内联
`wrangler@latest pages dev`。反向验证：三条各自撤掉都会变红，恢复后 31 绿。

脚本本身在本地验证过四种情形：真实 wrangler 起得来并返回 200、日志里不再出现
`Using today's date`、启动即失败时 3 次后 `exit 1`、跑够 10 秒才崩时只重启不放弃。

## 教训

CI 里任何"默认取今天"的东西都是定时炸弹，而且引爆时间和改动无关，所以第一反应
一定是"谁动了代码"——这次它同时点着了 main 和所有在飞的 PR。相关的一条：
`pnpm dlx wrangler@latest` 每次拉最新版，是同一类不确定性的另一半。仓库约定
不锁工具版本（见 CLAUDE.md），那就更要把**行为契约**（compatibility date）钉死。

另一条：容错重试必须能区分"运行中失败"和"启动失败"，否则它会把一个清晰的错误
熬成一个超时。

同批的 CI 加固见
[2026-08-19-ci-workflow-hardening.md](2026-08-19-ci-workflow-hardening.md)。
