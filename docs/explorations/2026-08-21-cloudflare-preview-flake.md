# Cloudflare Pages preview 偶发红：诊断、止血，以及真正的根治方向

日期：2026-08-21
分支：`ci/preview-smoke-wait-window`
起因：PR #163 的 `Cloudflare Pages` 与 `Preview smoke against Cloudflare Pages` 两项必需检查变红

## 先说结论

**不是代码问题。** 同一个 commit，改一次 SHA 重推，Cloudflare 构建就成功了。

诊断依据不止"重试好了"这一条——那只能说明它是偶发，说明不了偶发在哪。真正把范围
钉死的是这一条：

> `E2E (Cloudflare Pages semantics)` 的 **5 个分片全绿**。

这个 job 跑的正是 `sh ./bin/build.sh`（见 `playwright.pages.config.ts`），和 Cloudflare
在自己机器上跑的是同一个脚本。Docker 那 3 个分片也全绿。**构建脚本在 CI 的 Ubuntu 上
好好的，只有 Cloudflare 自己那次失败**——所以问题在 Cloudflare 的构建环境，不在仓库里
的任何一行代码。

## 为什么这条链路会偶发

量了一下这个仓库对 Cloudflare 意味着什么：

|                                                      |                        |
| ---------------------------------------------------- | ---------------------- |
| git pack                                             | **616 MiB**            |
| 工作树 `public/`（vendor：sdkjs + web-apps + fonts） | **625 MB**             |
| 构建产物 `dist/`                                     | **697 MB** / 2791 文件 |
| `bin/build.sh` 本身耗时                              | **约 7 秒**            |

构建脚本只要 7 秒，其余全是搬运：clone 616 MiB、checkout 625 MB、装依赖、上传 697 MB。
Cloudflare Pages 的构建有时间上限（20 分钟量级），而这次那个 check 从 PR 推送到
concluded 走了 **36 分钟**。

也就是说：**这条链路的耗时分布已经顶到上限附近，越线与否取决于当天的运气。**
`prod-smoke` 的历史里也能看到同类偶发（8 次里有 2 次 failure）。

## 顺带查出一个确定性缺陷

`preview-smoke.yml` 等 Cloudflare 的窗口是 `seq 1 75` × `sleep 20` = **25 分钟**，
而实测这次 Cloudflare 走了 **36 分钟**。

于是即使 Cloudflare **最终成功**，只要它慢一点，这道门也会先超时判红。这不是偶发，
是写死的窗口不够——两个数字（`75` 和消息里的 "25 minutes"）还得靠人去保持一致。

本次改动：

- 窗口 25 → **45 分钟**，由 `WAIT_MINUTES` 单一来源算出 `ATTEMPTS`，消息也引用同一个
  变量，不再有两处需要同步的数字。job 的 `timeout-minutes: 60` 仍给冒烟本身留出余量。
- 轮询日志带上 `status=`（`absent` / `queued` / `in_progress`），能一眼看出是"还没排到"
  还是"在构建"。
- **失败消息告诉人怎么判断和怎么处置**：如果 `E2E (Cloudflare Pages semantics)` 是绿的，
  那构建本身没问题（同一个 `build.sh`），是 Cloudflare 那边的事；而 Git 集成的部署
  **没有 API 可以重试**，只能再推一次。这句话此前不在任何地方，我这次也是靠推断才知道
  要重推。

契约钉在 `test/unit/workflow-contract.test.ts`：窗口必须 > 36 分钟（实测最坏值）、
job 超时必须比窗口多留 10 分钟以上、`ATTEMPTS` 必须是派生的、失败消息必须提到那两件事。
反向验证：把窗口改回 25 分钟 → 红；拿掉处置提示 → 红。

## 真正的根治方向（未做，需要决策）

上面是止血。**根因是 625 MB 的 vendor 躺在 git 里**，每一次构建——Cloudflare 的、CI 三套
E2E 的、Docker 的、以及每个新克隆的开发机——都要为它付一次全额搬运。

把 vendor 移出仓库（构建时从固定来源拉取 + 校验哈希）能一次性解决：

- Cloudflare 的构建从"顶着上限"回到"绰绰有余"，偶发消失
- clone 从 616 MiB 降到几 MB，新会话、CI checkout、Docker 构建全部受益
- 代价：需要一个可靠的分发源与完整性校验，且要同时改动 CI 三套 E2E、Dockerfile、
  `bin/build.sh` 与本地 dev 路径——**改动面覆盖所有构建入口，风险不低**

这是一件独立的、需要单独设计和验证的事，不适合塞进任何一个功能 PR。先记在这里。

## 一条流程观察

这次连着三个 PR 各红了一次，红的原因各不相同，但有个共同点：

- #162 红在 `format:check`——探索文档写在 `pnpm run format` 之后，提交前只补跑了 lint
  和测试
- #163 红在 Cloudflare——与代码无关

第一条是可以靠纪律根除的：**提交前跑完整的 CI lint 三件套**
（`format:check` + `lint:ts` + `test:coverage`），而不是挑着跑其中两个。已在
`2026-08-21-webmcp-completion.md` 里记过一次，这里重复一遍是因为它值得。
