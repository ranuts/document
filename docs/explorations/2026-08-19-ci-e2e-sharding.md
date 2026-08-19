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

## 结果

| 阶段 | 关键路径                        |
| ---- | ------------------------------- |
| 改前 | ~14 min                         |
| 改后 | ~5 min（预期，以首次 run 为准） |

## 没做的（留着，需要拍板）

pages 和 docker 这两层真正要证明的是"托管语义"和"镜像可用"，却各自跑了全部 36 个
`embed-regression` 真实编辑器用例。PR 只跑该层相关子集、push main / nightly 跑全量，
能再省 ~2 min 并砍掉一半 runner 时间。但这两层抓到过 PDF 被 308 卡住、字体目录缺
缓存头这类真实缺陷（见 CLAUDE.md 托管语义回归一节），缩范围是产品判断，不是性能
判断，所以这次没动。
