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
pnpm exec vitest run test/unit/agent-endpoint.test.ts \
  test/unit/agent-endpoint-settings.test.ts test/unit/agent-writing-route.test.ts \
  test/unit/agent-loopback.test.ts test/unit/agent-panel-loading.test.ts
pnpm run lint:ts && pnpm run format:check && pnpm run test && pnpm build
```

## 追加（同日）：写作终点从 loopback-only 扩展为可配置端点

用户提出"加 baseUrl 和 key 更好，本机 loopback 也可以保留，不冲突"。评估结论：**技术上确实是加法**
（`OpenAIProvider` 早有 `baseURL`/`apiKey`，`OllamaProvider` 早有 `ollamaBaseURL`，
`PROVIDER_LABEL_KEY` 里 Claude/OpenAI/Gemini 的标签一直都在），但**与站点对外承诺有冲突**：
loopback 与浏览器内推理守得住"文件不出设备"，自带 Key 的云端端点守不住。用户确认接受该冲突并
把隐私口径改成两种，于是实施。

### 决策（用户确认）

1. **接受云端写作**，并把帮助中心与 `llms.txt` 的隐私表述改成两种口径
   （本机 = 不上传；云端端点 = 会发出选中的文本与指令）。
2. **优先级**：loopback 优先，但界面显式显示"写作发往哪里"并允许切换（`device-first` / `remote-first`）。
3. **端点范围**：OpenAI 兼容端点 + 放出库里已有的 Claude / Gemini 原生 provider。

### 实现

- `packages/agent-core/src/llm/endpoint.ts`（新增）— `WritingEndpoint` 类型、URL 策略、provider 构造。
  远程端点**强制 https**（明文会把 Key 与文档一起暴露），拒绝 URL 内嵌凭据/查询/片段；
  loopback 允许 `http:` 且仅接受 origin（原生 API 路径由 provider 固定）。
- `keys.ts` — 新增按 **origin** 分槽的端点 Key（`agent_endpoint_key_<encoded origin>`）。
  既有的 `agent_api_key_<provider>` 无法容纳两个 OpenAI 兼容服务，第二个会覆盖第一个；
  旧函数保持原样不动。
- `writing-route.ts` — 从"loopback 或本地"改为端点模型：按 `preference` 依次尝试
  loopback / remote，都没有才考虑 consent 下的浏览器本地，否则 `blocked`；
  结果带 `dataPath: 'device' | 'remote'`，界面据此明说数据去哪。
- `lib/agent-plugin/ui/endpoint-settings.ts`（新增，取代 loopback-only 版本）— 终点类型、
  地址、模型、优先级、consent 的读写；Key **不进这份记录**，只进按 origin 的槽。
- 面板 — 终点类型选择（本机服务 / OpenAI 兼容 / Claude / Gemini）、地址（厂商端点隐藏）、
  模型、API Key（仅云端）、连接/断开、状态、优先级、以及"写作发往：…"的显式提示。
  云端端点标注为**"已配置（未验证连通性）"**——就绪不等于可达，不假装验证过。
- i18n — 23 个新词条 × 7 语言；厂商产品名在 de/es/pt 与英文相同，登记进
  `test/unit/i18n-locales.test.ts` 的 `SAME_AS_ENGLISH` 白名单（本就是产品名，不该硬造翻译）。
- 隐私文案 — 7 个语言的 `content/*/help.md` 两节改口径 + `public/llms.txt` 增加写作终点说明。
  落地页的主张限定在"核心本地编辑/转换器"，仍然准确，未改动。

### 安全边界（必须保持）

- 非 loopback 一律 https；URL 不得内嵌凭据、查询或片段。
- 永不自动连接任何端点；必须用户显式点击。
- 默认仍浏览器本地优先；不自动启用云端、不自动云端降级。
- Key 只进按 origin 的槽，不写入全局 store；无效端点永不入库。

### 未验证（延续上一节，且新增）

- **云端端点的真实调用**：没有用真实 Key 发过请求。云端"已配置"只表示配置完整、Key 存在，
  不表示端点可达、Key 有效或模型可用——这一点在界面上已如实标注。
- 真实本机服务连通性、真机浏览器写作流程：仍未验证（同上一节）。
- 长文档分段（原计划 Task 5）仍未做。

## 追加（同日）：离线场景的说明与控制

用户指出：**离线时只有本机终点可用**。这条不能只写进文档——配置了云端端点的用户在离线
状态（PWA/离线使用是本站卖点）下点改写，会拿到一句语焉不详的网络失败。

口径（控制）：**离线时不尝试云端端点，也不静默替换**。

- `writing-route.ts` 新增 `offline` 入参：离线时把云端端点从候选里移除（loopback 与
  浏览器本地都不需要联网，照常可用）。**校验仍然执行**——离线不该掩盖一个本来就非法的端点。
- 新增独立的阻断原因 `offline-needs-device-destination`，与"没配置终点"区分开，
  界面据此说明原因；面板映射为 `agentWritingOfflineNeedsDevice`（本地化文案）。
- 面板监听 `online`/`offline` 重新计算并显示终点；离线时在"写作发往"那行追加提示
  （`agentEndpointOfflineHint`）。
- **不自动改用浏览器本地**：那正是上一轮收窄要禁止的静默替换。用户开了 consent 才走本地，
  且界面显示的 `dataPath: 'device'` 与 experimental 状态让他看得见终点变了。
- 说明：7 语言的 `content/*/help.md` 增加一句"离线时无法访问云端写作终点"。

反向验证：去掉"离线丢弃云端端点"那一行 → 3 条离线策略用例 + 1 条面板用例变红。

仍未验证：`navigator.onLine` 在 jsdom 里是模拟的，**真机离线/在线切换行为未实测**。

## 追加（同日）：review 修复

对本次三次提交做了一轮 review（`mr-review` 流程 + 调用方追溯），发现一个**测试没覆盖到的真 bug**，
连同几处承诺-实现不一致一并修掉。

### 必修：首下门禁把端点写作整条路堵死（`panel.ts` 原有守卫）

`submit()` 里有一道早退守卫：只要 `currentProvider()` 是 `webllm`/`wllama` 且本地模型未就绪，
就 `return` 并提示"先去下载模型"。这道守卫写在写作分支**之前**，而且假定浏览器本地模型是唯一的
写作后端。加了云端端点之后，它就变成了：**连好云端端点、但不下载浏览器模型的用户，点改写什么都
不会发生**——而且以"没 WebGPU / 不想下 2GB"为由只用云端端点，恰恰是这个功能最主要的用法。

修法：守卫加一个前提——当本次写作会走 `endpoint` 时跳过它。反向验证：去掉该前提 → 新增的
回归用例变红。

为什么之前的用例没拦住：我的面板用例只断言了"写作发往哪里"这行文字，**没有真的发出一次写作请求**；
旧用例写了 `state.ready = true`（本地模型就绪），恰好从守卫旁边绕过去了。

### 其余

- **改地址/模型/Key 不再留下陈旧连接**：这三个字段定义终点，改动即断开重连；否则面板显示新终点、
  请求仍发往旧终点（甚至另一个 origin，用旧 Key）。改地址还会清空 Key 输入框——不同地址是不同服务，
  旧密钥不该跟着走。
- **Key 可以删了**：`clearEndpointKey` 之前没有任何调用点，清空输入框现在会真的移除存储的 Key。
- **离线提示不再自相矛盾**：已配置云端且离线时显示"已配置的云端端点（离线不可用）"，
  而不是"尚未配置"。
- **缺 Key 说的是"请填 Key"**，不是通用的"无法使用这个终点"。
- **回填 Key 与渲染状态分离**：`syncEndpointForm` 不再覆盖 Key 输入框，避免把正在输入的 Key
  在入库前冲掉（修第 1 条时踩到过）。
- 清掉上一轮命名遗留的 8 个死 i18n 键（7 语言共 56 条）。

检查：149 文件 / 4621 用例、`lint:ts`、`format:check`、`pnpm build` 全部通过。

## 追加（同日）：agent 写入的第一条 E2E + 首下门禁的第三处修正

review 时确认了两件事：**agent 的写入工具此前没有任何 E2E**（只有单测），而且首下门禁还漏了一个入口。

### E2E：`test/e2e/agent-write-tools.spec.ts`（真实 v9 编辑器，3 条，约 9 秒）

三条用例各覆盖一条写入机制，**全部不需要模型**——这是能在 CI 里跑的前提：

| 用例     | 机制                                   | 入口（无模型）                                          |
| -------- | -------------------------------------- | ------------------------------------------------------- |
| 写单元格 | `writeExcelCellText`（表格模型级写入） | tools 任务的封闭句式 `read A1:A5, then set B1 to "..."` |
| 写 Word  | `pasteWordHtml`（原生 HTML 粘贴包装）  | 固定语法"把上一条回答写入文档"                          |
| 加幻灯片 | `slide_action`                         | 固定语法"新增幻灯片"                                    |

每条都断言**真实变更 + 编辑器原生 Undo 往返**（写入必须是一步可撤销的）。
面板不自动下载模型：夹具把 provider 固定为没有模型的 GGUF 路径，使 `hasStartupModel()` 为假。

两处夹具说明（诚实标注，不是放宽断言）：

- Word 那条需要"上一条回答"，而会话历史在面板自己的 store（内存 + 可选 IndexedDB）里，
  没有 localStorage 记录可播种。用例只注入 `getLastAnswer()` 真正读取的那个节点
  （`.cui-msg-agent` 的 `dataset.source`），其下游（意图解析、粘贴、撤销分组）全是真实代码。
- **仍未覆盖**：模型驱动的工具选择（需要真实模型或假的本机服务）。这是缺口，不是隐含通过。

### 门禁第三处修正：固定句式不该要模型

`generateDocumentToolSequence` 里那条"读区域→写单元格"是**确定性路径**（`document-tool-sequence.ts`
匹配后直接返回计划，根本不碰 provider），但首下门禁是按"tools 任务一律需要模型"判的，于是这条
无模型路径**永远到不了**。现在把"哪些请求真的需要模型"变成可声明的纯函数
`isModelFreeToolRequest(request, context)`，门禁问它而不是猜：

- 同时修掉上一节我引入的一个洞：`writingEndpointReady` 曾让**所有** tools 请求绕过门禁，
  而端点只服务写作任务、不负责选工具——开式操作会拿着空 provider 往下走。
  现在 tools 分支只在固定句式时免责。
- 反向验证：把 tools 分支改回"一律免责" → 新增用例变红。

检查：149 文件 / 4628 用例、`lint:ts`、`format:check`、`pnpm build` 通过；
`E2E_PORT=4180 playwright test test/e2e/agent-write-tools.spec.ts` 3 passed。
