# CI 提速：同一批用例跑三遍、并发只有 1~2，与分片改造

2026-08-19

## 起因

用户反馈 "GitHub 的 CI 执行非常慢"。先量，不猜。

## 慢在哪：量出来的

取 run `32204565815`（一次全绿的 PR 档），按 job 和 step 拆：

| job                              | 总时长 | 拆解                                                                          |
| -------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Lint and Validate                | 1 min  | 每一步都在 20s 以内                                                           |
| E2E                              | 7 min  | setup 41s + **测试 6.9 min**（95 用例 / 2 workers）                           |
| E2E (Docker image)               | 8 min  | setup 41s + docker build **45s** + **测试 6.3 min**（同 95 用例 / 2 workers） |
| E2E (Cloudflare Pages semantics) | 12 min | setup 44s + **测试 11.1 min**（同 95 用例 / **1 worker** + retries:1）        |

关键路径 = 等 lint 走完（~1.5 min）+ 最慢的 pages（12 min）≈ **14 min**。

结论只有一条：**慢的全部是 E2E**。安装、构建这些常见嫌疑人都不成立——

- `pnpm install` + 浏览器缓存命中：~40s（`.github/actions/setup` 已经缓存过了）
- `vite build`（e2e job 的 webServer 里）：~25s
- `docker build`（含完整 pnpm install + 构建）：**45s**，层缓存都省得加
- lint job 全程：1 min

真正的浪费是结构性的两条：

1. **同一批 ~95 个用例跑了三遍**，只有服务器不同（vite preview / 生产镜像 /
   wrangler pages dev）。
2. **并发度只有 1~2**。runner 4 核，Playwright 默认 `workers = 核数/2 = 2`；
   pages 那套还是 `workers: 1`（故意的，见下）。

## 改了什么

### 1. 三套 E2E 各切 3 个分片

仓库是公开的，Actions 额度无限，多开 runner 不花钱。

选分片而不是调大 `workers`：runner 只有 4 核，每个 worker 拖一个 WASM 编辑器
进程，加 worker 换来的多半是内存压力和 flaky；而 pages 那套的单 worker 是
`playwright.pages.config.ts` 里写明的缓解措施（并发下浏览器 abort 大文件会把
workerd 打崩）。分片是唯一不动各套并发语义的加速方式。

实测分片切得很均匀，重的 `embed-regression`（36 个用例、292s）也会被拆开：

```
shard 1/3: 33 tests in 10 files   (embed-regression 8)
shard 2/3: 33 tests in 11 files   (embed-regression 4)
shard 3/3: 32 tests in 12 files
```

### 2. e2e 不再 `needs: lint`

lint 只有 1 min，但 e2e 要等它整个 job 结束，白加 ~90s 在关键路径上。代价只是
lint 红的那次 e2e 白跑一轮——免费，而且那次顺带把 e2e 的结论也拿到了。

### 3. 汇总 job 顶住必需检查名

main 的分支保护按**名字**匹配六个必需检查。分片后 job 名会变成 `E2E shard 1`
之类，三个必需检查就永远 pending、PR 永远合不了。所以分片 job 叫
`... shard N`，另加三个只做一件事的汇总 job（`if: always()`，
`needs.<分片>.result != success` 就退 1），沿用原来的
`E2E` / `E2E (Docker image)` / `E2E (Cloudflare Pages semantics)`，分支保护一个字
都不用动。

`fail-fast: false`：一个分片红了不该掩盖另外两个的结论，一次 run 就应该把所有
失败都报出来。

## 踩到的坑：pnpm 会把参数吃掉

第一版把 docker 分片写成：

```yaml
run: pnpm run test:e2e:docker -- --shard=${{ matrix.shard }}/3
```

实测（`pnpm run test:e2e -- --list --shard=2/3`）——**参数根本没到 Playwright**，
`--list` 也没生效，它老老实实跑完了整套 98 个用例。这个 bug 的形态最恶心：三个
分片各自跑完整套件，工作量翻三倍、提速为零，而且**全绿**，没有任何症状。

改成直接调脚本，并给 `bin/test-e2e-docker.sh` 加上 `"$@"` 转发：

```yaml
run: sh ./bin/test-e2e-docker.sh --shard=${{ matrix.shard }}/3
```

## 用例固化

新增的不变量全部进了 `test/unit/workflow-contract.test.ts`，四条都做了反向验证
（改坏必须变红，已逐条实测）：

| 断言                                   | 改坏的方式                               |
| -------------------------------------- | ---------------------------------------- |
| 分片数 == `--shard=N/M` 的 M           | matrix 三片配 `/4` → 静默少跑 1/4 还报绿 |
| 三个汇总 job 的名字 == 必需检查名      | 改名 → PR 永远 pending                   |
| 汇总 job 在分片红时必须退 1            | 换成 `echo ok` → 绿得毫无意义            |
| docker 分片直接调脚本，不经 `pnpm run` | 换回 `pnpm run … -- --shard` → 分片失效  |
| 缓存命中时 apt 失败不判死              | 去掉 advisory 分支 → 镜像源抽风就红      |
| 冷缓存时 apt 失败必须判死              | 改成 `exit 0` → 没浏览器还报绿           |
| advisory 路径的预算 ≤ 180s             | 改回 3×300s → 一个不重要的尝试占 15 min  |

## 首轮实测（run 32268096879）

分片本身一次到位：

| job                                | 分片耗时                 | 原耗时 |
| ---------------------------------- | ------------------------ | ------ |
| Lint and Validate                  | 1 min（与 e2e 同时起跑） | 1 min  |
| E2E shard 1/2/3                    | 2.4 / 3.5 / 4 min        | 7 min  |
| E2E (Docker image) shard 1/2/3     | 3.3 / 失败 / 4.6 min     | 8 min  |
| E2E (Cloudflare Pages) shard 1/2/3 | 3.7 / 7.4 / 7 min        | 12 min |
| 三个汇总 job                       | 各 0 min，红绿传递正确   | —      |

## 然后撞上 apt，两次

`E2E (Docker image) shard 2` 连挂两轮，形态完全一样：

```
15:32:12  Get:5 https://archive.ubuntu.com/ubuntu noble-security InRelease [126 kB]
          （此后 4 分半，零输出）
15:36:31  ##[warning] ... exceeded 300s (attempt 2/3)
```

三次尝试全卡在同一处，每次烧掉 ~17 min。日志里 `azure.archive.ubuntu.com` 的条目
全是 `Ign:`——runner 自带的 Azure 镜像没生效，退回公网 archive 然后停摆。就是
2026-08-19-ci-workflow-hardening.md 记的那个老问题。

**它不是分片造成的，但分片把它放大了**：跑 apt 的 job 从 3 个变成 11 个，一轮
run 撞上的概率同步翻倍。这条必须在同一个 PR 里处理，否则等于拿可靠性换速度。

### 第一步（止血）：缓存命中时，apt 的成败不再决定 job

`.github/scripts/install-playwright.sh` 分两条路：

| 路径     | 命令                  | 尝试     | 失败时          |
| -------- | --------------------- | -------- | --------------- |
| 缓存命中 | `install-deps`        | 1 × 120s | warning，继续跑 |
| 冷缓存   | `install --with-deps` | 3 × 300s | error，job 红   |

依据：缓存命中意味着浏览器二进制已经在盘上，apt 唯一还能补的是系统库，而 hosted
runner 镜像本来就带 chromium 那套。库真的缺，Playwright 启动浏览器时会原话说出来，
红在测试步骤——信息一点没少，只是不再需要一整轮 run 去换。冷缓存不动：那时候没有
浏览器，这步失败就是真的没法跑。

顺带把 3×300s 压成 1×120s——一个"输了也无所谓"的尝试不该占用 15 分钟预算。

### 第二步（根治）：缓存命中时根本不调 apt

止血之后回头问"为什么老是它"，去读一次**健康** run 的日志，才看清 `install-deps`
到底装了什么：

```
libasound2t64 is already the newest version ...
libatk-bridge2.0-0t64 / libnss3 / libgbm1 / libcairo2 / libx11-6 ... 全部 already
The following NEW packages will be installed:
0 upgraded, 9 newly installed, 0 to remove
Need to get 21.1 MB of archives.
Setting up fonts-wqy-zenhei / fonts-ipafont-gothic / fonts-unifont /
         fonts-freefont-ttf / fonts-tlwg-loma-otf / xfonts-encodings ...
```

**Chromium 需要的库一个都不用装——runner 镜像全带。apt 唯一真正在做的事是下载
21.1 MB 字体。** 而这套用例不经过系统字体：编辑器用自带的 XOR 字体 catalog
（`public/fonts/`），PDF 导出走 `PDF_FONT_MANIFEST`，落地页用 vendored Geist woff2；
`visual-roundtrip` 和 corpus 视觉比对是"同一浏览器里的原始 vs 存回再打开"两侧对比，
缺字形也是两侧同样缺。系统字体只够到 DOM 里的回退文本。

于是问题的真身是：**每个 job 在全新 VM 上，为没人读的字体，向 Ubuntu 源发一次网络
请求**。11 个 job = 一轮 run 掷 11 次骰子；而骰子是歪的（azure 镜像 `Ign:` → 退回公网
archive → 停摆）。这不是偶发 flake，是结构。

所以缓存命中直接 `exit 0`，连 apt 配置文件都不写（顺序也钉进用例了：一个还会
`sudo` 写 apt 配置的"跳过"，仍然能因为 apt 的理由失败）。`PLAYWRIGHT_INSTALL_DEPS=true`
留作逃生出口。冷缓存路径一个字没动。

**顺带记一笔打脸**：这两条断言的第一版是**假保护**——反向验证时把跳过块整个删掉，
用例照绿（正则里的 `PLAYWRIGHT_INSTALL_DEPS` 命中了逃生出口的注释，`exit 0` 命中了
后面 advisory 分支的那句）。改成"取出 `BROWSERS_CACHED` 分支体、断言 `exit 0` 出现在
第一个 `command=(` 之前"才真的红。反向验证不是走过场。

## 结果

| 阶段                          | 关键路径                            |
| ----------------------------- | ----------------------------------- |
| 改前                          | ~14 min                             |
| 分片后（实测，去掉 apt 那次） | ~7.5 min（瓶颈是 pages 的 7.4 min） |
| pages 3 → 5 片                | ~5 min（预期）                      |

pages 每片还要付 ~2 min 的 `build.sh` + wrangler 启动固定成本，所以再往上切收益
会被这块吃掉。

## 没做的（留着，需要拍板）

pages 和 docker 这两层真正要证明的是"托管语义"和"镜像可用"，却各自跑了全部 36 个
`embed-regression` 真实编辑器用例。PR 只跑该层相关子集、push main / nightly 跑全量，
能再省 ~2 min 并砍掉一半 runner 时间。但这两层抓到过 PDF 被 308 卡住、字体目录缺
缓存头这类真实缺陷（见 CLAUDE.md 托管语义回归一节），缩范围是产品判断，不是性能
判断，所以这次没动。
