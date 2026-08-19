# CI 加固：六小时挂死、缺失的 timeout，与一份共用 setup

2026-08-19

## 起因

PR #152 的六个必需检查里五个绿，`E2E (Docker image)` 显示 `CANCELLED`，
`mergeStateStatus` 卡在 `BLOCKED`，PR 挂了一整晚没合进去。

翻日志发现它不是失败，是**挂死**：

```
16:53:49  job 开始
16:55:01  Get:5 https://archive.ubuntu.com/ubuntu noble-security InRelease [126 kB]
          （此后 5 小时 59 分钟，零输出）
22:54:02  ##[error]The operation was canceled.
```

`22:54 - 16:53 = 6h01m`，正是 GitHub 对单个 job 的硬上限。没有任何一方主动
取消，是被平台掐掉的。

## 这不是孤例

查最近 40 次 CI run：26 成功 / 7 失败 / 6 取消，**其中 4 次是 361 分钟的同一处
挂死**（另加 #152 这次 466 分钟）。而且挂的 job 每次都不一样：

| run         | 挂住的 job         | 时长    |
| ----------- | ------------------ | ------- |
| 32154679924 | E2E (Docker image) | 360 min |
| 32157110583 | E2E                | 360 min |
| 32162464632 | E2E                | 360 min |
| 32162614979 | E2E (Docker image) | 361 min |

对每一次取消的 job 抓最后几行日志，签名完全一致——都停在
`playwright install --with-deps chromium` 里 apt 拉完 `noble-security InRelease`
之后。三个 e2e job 跑的是同一个 install 步骤，所以谁中枪纯随机，看起来像"到处
都在坏"，实际是同一个点。

`--with-deps` 会 shell out 到 `apt-get`。runner 的 sources 里
`azure.archive.ubuntu.com`（内网镜像）全部 `Ign:`，回落到
`archive.ubuntu.com`，然后连接停住不动。apt 的 `Acquire::http::Timeout` 管的是
单次连接/读取，一个"连上了但不给字节"的镜像可以让它永远等下去，而 apt **没有
任何总时长上限**。

## 三层问题

1. **没有 timeout**：`ci.yml` 的四个 job 一个都没写 `timeout-minutes`。
   较新的 `preview-smoke` / `prod-smoke` / `nightly-corpus` 都写了，最老、
   却承载 6 个必需检查里 4 个的 `ci.yml` 反而没有。于是一次网络停滞的代价是
   6 小时 runner 额度 + 一个通宵堵住的 PR + 一次人工重跑。
2. **没有重试**：即便 apt 偶发失败，也只能靠人回来点 re-run。
3. **同一段 setup 抄了 9 遍**：8 个 workflow 里 9 处重复
   `pnpm/action-setup` + `setup-node` + `pnpm install`，其中 8 处各自内联
   `playwright install --with-deps`。任何加固都得改 8 个地方，下一个新
   workflow 还会再漏一次。

## 做法

### 1. `.github/scripts/install-playwright.sh`——把安装限时并重试

每次尝试用 `timeout --kill-after=30s 300s` 包住，失败或超时就重试，最多 3 次。
两个细节不能省：

- `timeout` 只对 `pnpm` 发信号，**停住的 `apt-get` 是孙进程会活下来**，所以
  重试前要 `pkill`。用 `pkill -9 -x <名字>` 按进程名精确匹配，**不能用
  `pkill -f 'apt-get|dpkg'`**——那样模式串会匹配到正在执行它的 `sudo` 自己的
  命令行，把脚本自己杀掉。
- 被杀的 apt 会留下 `/var/lib/dpkg/lock-frontend` 等锁，不清掉的话重试会秒失败
  在 `Could not get lock`，重试逻辑就成了纯装饰。清完再 `dpkg --configure -a`。

顺带写死 `Acquire::Retries` / `Acquire::http(s)::Timeout` —— 这一条**救不了**
这次的挂死（那是零字节的静默停滞），但能让"慢镜像"也快速失败。

最坏情况：3 × 5 min = 15 min 后 job 红掉，而不是 6 小时后被平台杀掉。

### 2. `.github/actions/setup`——一份共用的 composite action

pnpm + Node `lts/*` + pnpm 缓存 + `pnpm install --frozen-lockfile`，
`browsers:` 非空时再走上面的脚本装浏览器。9 处重复收敛成一处，
`release.yml` 除外的所有 workflow 都改用它。

浏览器二进制额外进 `actions/cache`，key 是 **Playwright 版本号**而不是
lockfile——按 lockfile 会在每次依赖升级时白白失效重下。命中时只需要跑
`install-deps`（系统库永远不在缓存里）。正常 install 步骤耗时 44～108s，
命中后省掉其中的下载部分。

### 3. 全部 8 个 workflow、14 个 job 补 `timeout-minutes`

按实测耗时留 2～3 倍余量（e2e 9 min → 30；e2e-pages 18 min → 45；
docker 8 min → 30；lint 1.5 min → 15）。

### 4. `ci.yml` 加 concurrency

PR 收到新 push 时取消旧 run；push 到 main 的 run **不取消**——那是部署和线上
冒烟要判定的提交：

```yaml
cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

### 5. 顺手修掉 `release.yml`

它用 `npm install` 装一个 pnpm workspace 仓库，而根 `package.json` 里有四个
`"workspace:*"` 依赖——npm 不认 `workspace:` 协议，这个手动 release 流程在
install 那步就不可能成功。改走共用 setup。

## 用例固化

`test/unit/workflow-contract.test.ts`（28 个断言）钉死四条不变量：

1. 每个 workflow 的每个 job 都有 `timeout-minutes`，且 ≤ 300；
2. 任何 workflow 都不许再内联 `playwright install`，必须走共用 action；
3. 共用 action 走的是重试脚本，缓存 key 按版本号而非 lockfile；
4. 脚本里 `timeout` 包裹与 apt 锁清理都在；`ci.yml` 的 concurrency 只对 PR 取消。

反向验证（逐条撤掉修复，确认变红）：

| 撤掉的东西                    | 结果      |
| ----------------------------- | --------- |
| e2e job 的 `timeout-minutes`  | 1 failed  |
| 改回内联 `playwright install` | 1 failed  |
| 删掉 `concurrency` 段         | 1 failed  |
| 去掉 `timeout` 包裹 + 锁清理  | 2 failed  |
| 全部恢复                      | 28 passed |

安装脚本本身在本地用打桩（`sudo` / `pnpm` / `timeout` / `sleep`）跑过五个分支：
缓存未命中走 `install --with-deps`、命中走 `install-deps`、多浏览器参数、
无参数默认 chromium、持续失败重试到上限后 `exit 1`。

## 没有做的

- **给 `e2e-pages` 分片**（它 18 min，是最长的一条）：分片会改变 check 名字，
  而分支保护里必需检查是按名字匹配的，改名会让 PR 永久卡在"等待缺失的检查"。
  要做得先改分支保护，属于另一件事。
- **给 Docker 构建加 buildx 缓存**：实测镜像构建只占 46s（16:50:21 → 16:51:07），
  该 job 的 8 分钟基本都是测试本身，缓存省不下什么。
- **提高 Playwright worker 数**：runner 4 核，默认 2 worker。这些用例每个都要
  拉起真实编辑器 + x2t.wasm，是内存敏感型；为了省几分钟去换新的偶发失败，
  和这次要解决的问题正好相反。`playwright.pages.config.ts` 的 `workers: 1`
  是有意为之（多 worker 会让 wrangler 中断 sdk-all.js 这种大文件下载）。
