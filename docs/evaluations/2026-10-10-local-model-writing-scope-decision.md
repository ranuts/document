# 本地浏览器模型的写作职责收窄（决策记录）

日期：2026-10-10 · 分支：`feat/local-multilingual-assistant` · 状态：已实施，待 PR 门禁

## 一句话结论

**浏览器本地模型（WebLLM / wllama）不再默认承担"改写 / 摘要 / 翻译"这类自由文本写作**。
写作默认路由到用户自己的本机服务（loopback），本地浏览器写作降级为**显式实验开关**；
对话、结构化工具计划、离线兜底仍由浏览器本地模型承担。

## 依据（不重复罗列，只给指针）

本分支此前的评估已给出结论，本次收窄是执行那个结论、不是新增判断：

- [写作模型决策索引](2026-10-04-writing-model-decision-index.md)：16 个候选（Qwen3 / Qwen3.5 /
  Qwen2.5 / Llama / Gemma / Phi-4 / Hy-MT2，1B–14B）**全部**未通过七语言事实性写作验收。
- [浏览器本地模型能力实测](2026-09-27-model-capabilities.md)：失败类型是改日期、改人名、漏施事者、
  反转否定与情态（"未批准"→"已批准"）；4B 被浏览器缓存配额拦住；CPU 3B 时延 17–57s、
  Gemma 4 E2B 约 127–129s。
- [本地 IM 质量改进设计](2026-09-27-im-quality-design.md)：结构合法率不能当任务成功率。

提示工程、few-shot、JSON schema、采样参数、分段、事实台账、示例顺序都试过了，没有修好——这是能力墙，
不是调参问题。而"把生成结果写进用户的文档"是零容错的场景，因此不能让一个未达标的引擎当默认。

## 收窄口径

| 任务                                              | 收窄前                     | 收窄后                                                                                 |
| ------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| 对话（chat）                                      | 浏览器本地                 | 不变                                                                                   |
| 结构化工具计划（tools，schema + 确认 + 写后读回） | 浏览器本地                 | 不变                                                                                   |
| 改写 / 摘要 / 翻译                                | **浏览器本地（静默默认）** | **已连接的本机服务优先**；否则需显式勾选实验性本地写作；两者都没有则明确拒绝并说明原因 |

"本机服务"= 用户自己电脑上运行的原生服务（默认 Ollama，`http://localhost:11434`）。
它保持同样的"文件不出设备"性质（只接受回环地址），但能跑浏览器装不下的大模型。
这是把质量要求交给合适的位置，而不是放弃隐私定位。

## 实现

**agent-core（策略与接线）**

- `packages/agent-core/src/llm/writing-route.ts`（新增）— 纯策略 `resolveWritingRoute`：
  loopback 优先 → 有 consent 才用浏览器本地（并标记 `experimental`）→ 否则 `blocked`。
  非法绑定直接抛错，不做静默回退。
- `packages/agent-core/src/llm/loopback.ts` — 补齐 timeout / 连接失败 / 取消 / 工具拒绝 / 未完成响应用例。
- `packages/agent-core/src/llm/factory.ts` — `ProviderId` 增加 `loopback`；`createProvider('loopback')`
  必须显式给 `model`，没有可猜的默认模型。`LoopbackProviderOptions` 以 `Partial` 参与交叉类型，
  以免把必填 `model` 传染给其它 provider 的选项。
- `packages/agent-core/src/llm/index.ts` — 导出 loopback 与 writing-route。

**agent-plugin（面板）**

- `lib/agent-plugin/ui/loopback-settings.ts`（新增）— 地址 / 模型 / consent 的读写；
  只持久化**校验过的回环 origin 与模型名**，带凭据或非回环的地址在读取时丢弃、写入时抛错。
- `lib/agent-plugin/ui/panel.ts` — 设置区新增本机服务入口（地址、模型、连接/断开、状态）；
  consent 复选框；写作分支改用 `resolveWritingRoute`，按策略选择 provider，
  被拒绝时抛出稳定 key `agentWritingNeedsLocalService`。
- `lib/agent-plugin/ui/presentation.ts` — 把该 key 映射成用户可读文案（仓库既有约定：
  错误以 key 抛出、由 `displayError` 决定能否展示）。

**i18n** — 11 个新词条 × 7 语言（en/zh-CN 为完整表，其余按 `test/unit/i18n-locales.test.ts`
的要求同样不得回退英文）。

## 明确不做（本轮）

- **长文档分段写作**（原计划 Task 5）：独立大周期，不混进本次收窄。
- **云端兜底**：不自动启用云端、不自动连局域网或远程服务；默认仍是浏览器本地优先。
- **把 loopback 用于对话/工具**：`LoopbackProvider.chat()` 在带工具时直接拒绝，
  面板只把它当写作后端——这是刻意的范围限制，不是缺口。
- **改 CSP**：`public/_headers:132` 与 `vite.config.ts:115` 的 `connect-src` 已含 `http:`，
  回环地址本来就可达，无需放宽。

## 反向验证（仓库约定）

临时把 `writing-route.ts` 的 consent 门禁改为恒不触发：

- `test/unit/agent-writing-route.test.ts > blocks writing when no loopback service is connected and consent is absent` **变红**；
- 重建 `@ranuts/agent-core` 后 `test/unit/agent-panel-loading.test.ts > refuses browser-local writing until a service is connected or consent is given` **变红**。

恢复门禁后两级复绿，说明用例确实测到了这次收窄，而不是被别的改动顺带覆盖。

既有写作用例（翻译路由、写回历史、迟到 resolve/reject 等 7 条）改为在挂载前显式写入 consent——
这正是新契约要求的"显式选择加入"，不是放宽断言。

## 操作注意（踩过的坑）

`lib/**` 与部分单测经由**包名**导入 `@ranuts/agent-core/*`，解析到的是 **gitignored 的 `dist/`**。
因此改了 `packages/agent-core/src/**` 后，本地必须重建包（`pnpm --filter @ranuts/agent-core build`）
才会被面板与那些用例看到；CI 由安装时的 `prepare` 脚本重建，所以 CI 不受影响。
本次因此把新增的工厂断言放在走 `src` 的测试文件里，避免断言对着过期 dist 通过。

## 未验证 / 遗留

- **真实本机服务连通性**：本机没有可用的 Ollama 实例，未做真机连接与真实生成验证；
  面板的"连接失败"路径只有单测覆盖。这属于已知未验证项，不能当作已验收。
- **真机浏览器的写作流程**：同样未做；本次的浏览器侧证据只有 jsdom 单测。
- 手机实机、离线重启、长文档等原有未完成项不受本次影响，继续列为未完成。

## 如何验收

```bash
pnpm --filter @ranuts/agent-core build      # src 改动需要重建包（见"操作注意"）
pnpm exec vitest run test/unit/agent-writing-route.test.ts \
  test/unit/agent-loopback.test.ts test/unit/agent-loopback-settings.test.ts \
  test/unit/agent-panel-loading.test.ts
pnpm run lint:ts && pnpm run format:check && pnpm run test && pnpm build
```
