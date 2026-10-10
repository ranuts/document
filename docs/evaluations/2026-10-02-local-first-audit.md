# 浏览器本地助手优化：现状与证据

依据：用户 2026-10-02 附件。此次要求覆盖完整本地聊天生命周期，不能把新增调度模块的单测通过当作目标完成。下表是初始盘点；后续验证按阶段追加，最新 PPT 排版与历史恢复状态见文末。完整目标仍未完成。当前要求与缺口的汇总见 [2026-10-03 当前验收盘点](2026-10-03-local-assistant-current-audit.md)，下文保留各阶段原始记录。

| 要求                        | 当前证据                                                                                          | 状态与下一步                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 浏览器本地推理，无云端兜底  | 产品 provider 仅 `webllm` / `wllama`，远程分支与凭据输入已删除；真实编辑器 DOM 远程控件数为 0     | 已接入；仍需完整网络请求审计                     |
| WebGPU 主引擎、CPU 自动兜底 | LocalInferenceProvider 实际 requestAdapter 探测；GPU 初始化失败先 dispose，再加载 CPU；取消不降级 | 已接入，有自动化覆盖；真实 GPU 故障测试待补      |
| Worker                      | 复用 WebLLM Dedicated Worker 与 wllama 自身 Worker                                                | CPU 实际 Worker 推理完成；正式产品 UI 响应性待测 |
| CPU 小模型与来源            | Qwen3-0.6B Q4_K_M，固定 revision `60b85c0e3d8fe0f6474f406922a26d12aca4550d`；实下载约 484 MB      | 可用性实测通过；不宣称多语言质量通过             |
| 流式输出、停止与重试        | provider 流式转发、取消/释放竞态与初始化重试单测；失败流不重放；拒绝原生工具调用                  | CPU 流式实测完成；真实加载/生成取消待补          |
| 离线刷新                    | SDK 模型缓存已有实现；PWA 已有                                                                    | 尚未证明运行时、分词器、页面和模型全部断网可用   |
| 隐私历史与 IndexedDB        | 默认内存，显式保存使用 IndexedDB；版本事务防止跨标签覆盖；旧记录显式导入；真实刷新恢复验证通过    | 已接入；损坏记录清理恢复有真实浏览器证据         |
| 参数与统计                  | 系统指令、temperature、top_p、max token 控件与两个引擎参数测试通过                                | 参数已接入；持续模型状态与速度统计待补           |
| 会话导出及删除              | JSON 导出、确认删除、全部删除和旧记录清理；真实浏览器验证通过                                     | 已接入；损坏恢复通过，更多设备验收待补           |
| CSP 与模型自托管            | 现有 MLC 自托管配置与 GGUF 文件导入                                                               | CSP 与缓存范围需要逐项核查                       |
| 七语言质量                  | 9 月评测已证明部分事实/语言错误                                                                   | 不通过；需改进提示、模型比较与逐语言复测         |
| 设备覆盖                    | 本轮隔离 Chromium 强制 CPU；历史 Apple Silicon WebGPU 记录                                        | Windows 集成 GPU、受限设备、真实移动端缺证据     |

## 本轮实际运行

原始结果：`2026-10-02-local-runtime.json`。隔离 headless Chromium，无用户文件。通过真实 LocalInferenceProvider 强制无 GPU，实际下载并运行默认 CPU 模型。

- 下载及初始化 63,801 ms。
- 请求：`请只回答：你好。`，流式输出 `你好！`，2 个片段。
- 首片段 22,649 ms，总生成 22,831 ms。
- 结束调用 dispose 释放运行时。

此单例证明 CPU 路径可运行，不能证明七语言质量、稳定性能、热启动、断网启动或全设备兼容。CPU 首字等待较长，下一步需要预填充耗时与热启动对照，不以历史 GPU 数据替代 CPU 实测。

编辑器 DOM 验证：`/editor?new=docx&agent=1`，两个选项 `webllm` / `wllama`；远程凭据/API 地址/云端捷径控件合计 0；页面错误为空。该检查阻断 Hugging Face 请求，检查的是产品入口，不能证明 UI 模型初始化成功。

## 官方依据

历史 UI 原始结果：`2026-10-02-history-ui.json`。隔离 Chromium 使用合成会话，模型下载被阻断。验证默认不打开会话数据库、显式迁移与保存、刷新恢复、关闭保存、下载 JSON、确认清理以及无含测试会话内容的网络请求；页面错误为空。系统指令留在当前页面内存，未进入 localStorage 或导出。390 px 下已打开的历史设置宽度与 scrollWidth 同为 355 px；窄屏编辑器侧栏入口不可见，删除后刷新检查切回桌面尺寸。这不是移动端入口或推理的通过证明。

全量最新 89 文件 / 3,699 项通过，类型检查与生产构建退出 0；两个既存 PromiseRejectionHandledWarning 与构建依赖、大 chunk 提示仍存在。离线、CSP、七语言及跨设备要求未完成。

- [WebLLM Worker 与 IndexedDB](https://webllm.mlc.ai/docs/user/advanced_usage.html)。保留当前已固定版本，不把 upstream main 的新增缓存后端视为本项目可用功能。
- [wllama](https://github.com/ngxson/wllama)：Worker 推理、CPU 和 WebGPU 均支持；本轮明确 `cpuOnly: true`，不把 wllama 等同于仅 CPU 引擎。
- [Qwen3-0.6B 模型卡](https://huggingface.co/Qwen/Qwen3-0.6B)：Apache-2.0，上游推荐 SDK 应用模型模板。
- [GGUF 分发源](https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF)，本轮读取 API revision 并固定 URL。正式自托管时仍需一并分发对应许可与来源信息。

## 工具与验证限制

Browser 插件连续两次返回环境错误 `codex/sandbox-state-meta: missing field sandboxPolicy`，不能连接。已改用隔离 Playwright Chromium 完成上述本地探测。未操作用户现有浏览器状态。

基线 84 文件 / 3,657 项测试通过；有既存 `PromiseRejectionHandledWarning`，不能写成无告警。新增调度和产品入口测试后再次执行全量检查；最新结果写入实施计划 ledger。生产构建仍有依赖浏览器 externalization 与大 chunk 提示，需后续性能审查，不能以构建成功表示性能达标。

损坏记录恢复补测：`2026-10-02-history-recovery-ui.json` 记录真实 IndexedDB 注入损坏 sessions 后，确认删除全部历史并刷新无残留。23 项相关测试与类型检查通过；事务失败时当前内存和旧记录保留。该验证不涉及损坏数据库结构或浏览器底层磁盘故障。

紧凑入口补测：`2026-10-02-compact-entry-ui.json`。相同 AI 按钮在 compact chrome 隐藏右侧栏时转移到可见左侧栏；390 px 初次/刷新打开、宽窄切换、无重复按钮与键盘打开通过。此修复补足之前发现的入口问题，不能替代真实移动端内存、性能及推理兼容性测试。

## 真实 CPU 产品面板与统计

`2026-10-02-real-cpu-ui-before-usage.json` 与 `2026-10-02-real-cpu-ui.json`：隔离持久 Chromium、无 WebGPU、默认自动 CPU fallback，实际编辑器聊天。首次启动 63.45 s，再次启动 3.81 s；回复约 24 s，界面持续显示真实 CPU 与模型身份。最初统计为空，修复 CPU include_usage 后显示真实 3 tokens。两次页面错误与含测试对话内容的请求均为空；未点击写入文档。计时包含编辑器加载，firstVisibleMs 为首次可见气泡，不冒充精确后端 TTFT。再次启动仍有网络，不能据此认定离线通过。CPU 解码速度缺失，仍需精确且明确标注的计时方案。源代码确认 WASM 同源打包；公共响应头尚无 CSP。

CPU 计时补测：`2026-10-02-real-cpu-timing-ui.json` 实际显示首段文字等待 23.83 s、整体响应速率 0.08 token/s、真实 2 tokens。整体速率包括预填充，不能与 GPU 的 decode token/s 直接比较。`2026-10-02-real-cpu-timing-ui-first-attempt.json` 保存首次 120 s 超时记录，原因尚未证实；随后复测成功不能支持稳定性通过。89 文件 / 3,710 项、类型和构建通过，追加 12 项面板回归通过；原有告警仍在。

## 离线验收与失败追踪

`2026-10-02-offline-cpu-ui.json`：生产 preview、隔离 Chromium、真实 CPU 模型预热后断网 reload，当前 worker 已控制页面。带参数页面已能回退到当前 build 的预缓存 editor shell（源码 VM 回归通过），但首次 SW 控制前加载的 boot JS/CSS/设计令牌和字体 CSS 没有缓存，离线 AI 入口超时。明确请求失败清单在原始记录；未进入离线推理阶段，不能宣称离线模型加载或回复通过。需要 precache 页面启动依赖，再核查 vendor/Worker/tokenizer/model 完整链路。

离线依赖补测：已 precache 当前 HTML 的启动资源，并在实际 Cache API 中确认 JS/CSS 条目；preview 的 Vary: Origin 导致 crossorigin module 请求匹配失败，公共同源 assets/ 限定忽略 Vary 后，静态启动资源已恢复。最新离线失败清单缩小到提前加载的 agent-plugin/input/recovery 动态块与 Geist 字体。原始记录仍 failed；没有进入离线 AI 推理。所有失败记录保留用于对照，后续必须覆盖动态依赖后继续验证。

离线运行时清单已生成并验证排除模型/文档，未压缩缓存预算约 20.73 MiB。app 的动态模块、WASM、字体可预缓存；编辑器 API 及三种静态 iframe 入口加入 vendor cache，入口 HTML 配置参数限定忽略。真实断网已推进到 vendor RequireJS/编辑器样式加载，最新失败清单是 require.js 与 documenteditor app.css，并出现 require is not a function。模型离线推理仍未运行；继续补齐首次控制前的 vendor 启动依赖。

Vendor 启动链路补测：缓存入口实际标签中的 RequireJS/样式，忽略 inline legacy document.write 内容，再加入 AMD app/code 入口。最新实际失败已变为字体目录脚本、正则/通信库、转换 helper 和编辑器语言文件；本轮 controllerURL 刷新前后都是 sw.js，不把 vendor 空 worker 当作已证实原因。离线推理仍未执行，后续需外部 AMD 依赖与语言文件的首次缓存，以及关页后断网重开验证。

后续直接证据推翻了仅刷新即可验收的假设：外部 AMD 依赖补齐后，首次 SDK 请求仍发生于 SW 接管前；产品 editor 路径等待 /sw.js 控制后，离线刷新成功。全关页后 cold navigation 失败，读取实际注册显示 vendor 空根 worker 已激活取代应用 worker。移除三个编辑器入口根注册后，`2026-10-02-offline-cpu-ui.json` 与 `2026-10-02-offline-cold-cpu-ui.json` 均通过：生产构建、真实编辑器、本地 CPU 模型、离线回复；冷启动进程从开始即 offline，没有线上预热请求。刷新约 24.43 秒，冷启动回复约 22.02 秒，都是 3 tokens。冷启动截图确认文档界面与回答完整渲染。两次页面错误为空；记录有拼写脚本中止请求，不能声称网络请求全部成功。

冷启动失败原始记录保留在 `2026-10-02-offline-cold-cpu-ui-before-worker-ownership.json`，刷新失败记录亦保留。这个验收覆盖 Chromium 的 DOCX/CPU，三种编辑器、全部语言、GPU、真实移动设备和冷启动稳定性仍需分别验证；CSP 和模型加载后进一步降级仍未完成。

### Returned conversation and late operation persistence

- Reproduced a history loss for both writing and tool planning: start a pending request, switch away and return, send a new chat message (rebuilding the controller), settle the old request, then send another message. The old request/error was saved directly to storage but overwritten by the active controller's stale history. Both regression cases failed before the change.
- Operation completion now records through the current controller when its active session is the operation's original session, matching the existing direct-operation ownership rule; otherwise it appends to the captured original storage. Generation/revision checks still prevent stale document application and stale visible output.
- Both regression cases pass after the change, retain the pending request/error and later chat messages after reopening, and confirm no document action was applied. This is controlled unit evidence, not a new real-model browser run.
- Verification: 102 test files / 3,795 tests passed; lint/type checks and production build passed. Existing asynchronous rejection warnings and build externalization/chunk warnings remain. Full model quality, device coverage and offline inference remain incomplete.

### Small-model cell reading: request wording control

- Ran four real GPU Qwen3.5-0.8B tool-mode requests on separate Excel fixtures using the unchanged current production prompt/schema. `Read the text value in cell A1.` returned the specific no-operation guidance (2,390 ms); `Read cell A1.`, `读取 A1 单元格的值。`, and diagnostic `Use get_cell to read A1.` returned `A1\n12` (2,479 / 2,357 / 2,355 ms).
- Every run preserved A1:A3 values and B2 selection/active cell, with zero preview cards and zero page errors. This does not inspect every worksheet cell. One sample per phrasing is not a statistical reliability estimate.
- Evidence: `2026-10-02-qwen35-08-cell-request-variants.json`. The previous failure is sensitive to wording rather than complete get_cell incapability. Next prompt/description experiments should retain all editor capabilities and verify natural-language variants, without requiring users to name internal tools. No product behavior was changed by this control.

### Adopted explicit cell-value capability description

- Updated only get_cell's capability description to explain that both text and numeric cell values can be read without selection movement or modification. Planner instructions, all editor capabilities, schema constraints, parser validation and execution behavior remain intact.
- A rebuilt candidate with an observed runtime marker passed all four 0.8B request variants, including the previously failing `Read the text value in cell A1.` (2,345 ms). Other requests passed in 2,322 / 2,328 / 2,339 ms. All captured A1:A3 values and B2 selection/active cell were unchanged; no preview cards or page errors appeared. Evidence: `2026-10-02-qwen35-08-cell-description-probe.json`.
- Preliminary route-only attempts had no runtime marker and were excluded from candidate evidence. The source and build were restored after the experiment, then the exact verified description was adopted and rebuilt without instrumentation.
- Verification: formatting, lint/type checks, production build and all 102 files / 3,795 tests passed. Existing rejection/build warnings remain. Four single-sample results do not establish general reliability; other models, full multilingual requests and complex operations remain to be evaluated.

### Four GPU models after the cell-description change

- Re-ran the same three production IM tool requests across all four offered GPU models using build `editor-DvvEfRDn.js`, verified to contain the adopted description without experimental logging. All 12 samples matched the expected results: A1 read `12`, readonly SUM `42`, and clear empty-text feedback for blank PPT.
- Latencies (cell / SUM / blank PPT): Qwen3.5-0.8B 2,345 / 2,441 / 1,948 ms; Qwen3.5-2B 3,463 / 3,304 / 2,024 ms; Qwen3-1.7B 1,856 / 1,884 / 1,331 ms; Qwen3-4B 4,637 / 4,808 / 3,321 ms. These are single samples, not latency distributions.
- Every Excel sample preserved captured A1:C4 values and B2 selection/active cell. PPT captured slide count and text remained unchanged; PPT selection was not measured. Zero preview cards, visible errors or page errors. Reports: `2026-10-02-{qwen35-08,qwen35-2,qwen3-17,qwen3-4}-cell-description-regression-ui.json`.
- This establishes bounded cross-model regression evidence for the description change; it does not complete full model validation, CPU tool planning, multilingual writing, offline inference or device testing. No product source was changed during these runs.

### CPU fallback: actual document read tools

- Ran production IM tool mode in isolated persistent desktop Playwright WebKit with navigator.gpu unavailable. Runtime confirmed `CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf`; current editor module `editor-DvvEfRDn.js`.
- All three samples passed: cell A1 returned 12 (58,547 ms), readonly A1:A3 SUM returned 42 (59,574 ms), blank PPT returned clear no-readable-text feedback (36,258 ms). Captured Excel A1:C4 values and B2 selection/active cell were unchanged; captured PPT slide count/text were unchanged. Zero preview cards, visible errors and page errors.
- Evidence: `2026-10-02-cpu-document-read-tools-ui.json`. This proves bounded CPU tool-planning and actual read execution, including fallback to chat JSON when no generateJSON method is available. It does not establish offline operation, writing quality, mobile-device support or all document tool coverage.
- CPU completion times are materially slower than GPU and remain a usability/performance concern. Measurements include planning, host execution and UI polling; no attribution to prefill versus generation was collected. Next optimization should instrument phase/token timings before choosing prompt compression, grammar or engine changes. No product code changed in this verification run.

### CPU planning latency attribution

- Temporarily instrumented the returned provider response for one real WebKit CPU cell-read request. Observed diagnostic marker/data, 643 actual prompt tokens, 14 actual completion tokens, 41 response characters, normal stop, provider response duration 57,885 ms versus total IM completion 57,928 ms (~99.93%). A1 read succeeded; captured worksheet values/selection unchanged.
- Evidence: `2026-10-02-cpu-tool-timing.json`. This isolates nearly all measured waiting to provider execution rather than document API application/UI handling. It does not separate prefill from decoding, and the reported 0.242 completion tokens/s is an end-to-end rate, not decode speed. Prompt processing remains a hypothesis to measure next; no conclusion about a particular inference phase is justified yet.
- Temporary instrumentation was restored byte-for-byte and the production build completed again; no diagnostic marker remains in built assets. No product source changes were retained. Full goal remains unfinished.

### Preserve backend inference phase timings

- Installed wllama 3.6.1 source types (`src/types/oai-compat.ts`, ResultTimings) expose optional prompt_ms, predicted_ms and predicted_per_second on completion/chunk responses. The shared OpenAI-format parser previously ignored these fields.
- Added optional normalized promptProcessingDurationMs and decodingDurationMs, and actual backend decode-rate fallback when WebLLM's extra rate is absent. Stream accumulation preserves timing fields, including a final timing-only chunk without choices. Finite nonnegative validation rejects invalid measurements; no synthetic rates or first-token estimates are introduced. No new UI controls or fields were added.
- Regression failed before implementation (usage missing); now nonstreaming, streaming tail and invalid-measurement tests pass. All 102 files / 3,797 tests, lint/type checks, formatting and production build passed; existing warnings remain.
- This enables retaining phase data if the backend emits it; no new real CPU phase measurement has yet been collected. Optional SDK fields alone do not prove that current runtime responses contain timings. Actual prefill-versus-decoding attribution remains outstanding.

### Actual CPU phase timing establishes prefill bottleneck

- With normalized backend timings now preserved, a real production WebKit CPU A1-read request returned 643 prompt tokens / 14 completion tokens, prompt processing 50,418.999 ms, decoding 2,805.001 ms, backend decode rate 4.635 tokens/s, provider wall clock 53,258 ms and total IM completion 53,299 ms. Prompt processing accounts for ~94.7% of provider time in this single sample.
- A1 read succeeded, captured worksheet values and B2 selection were unchanged. Runtime diagnostic response was observed, so the phase fields are measured backend data rather than inferred from SDK types. Evidence: `2026-10-02-cpu-tool-phase-timing.json`.
- This directs the next performance experiment toward reducing redundant prompt/schema text or reusing prompt cache while retaining all capabilities, exact parameter validation and natural-language quality. It does not establish speed gains yet; changing output limits alone would not address the dominant measured phase.
- Temporary diagnostic source restored byte-for-byte and production rebuilt successfully; no diagnostic marker remains. No product changes retained in this measurement run. Full model/device/offline acceptance remains outstanding.

### Same-instance CPU prompt reuse control

- Executed two identical A1-read requests in the same page and same loaded CPU model instance, without navigation or explicit cache configuration. First provider response 53,153 ms (prompt 50,310.999 ms; decode 2,809.001 ms), second 3,118 ms (prompt 227.999 ms; decode 2,857.001 ms), ~17x provider speedup. Each returned a new A1/12 activity; no visible errors, document value changes or selection changes.
- Evidence: `2026-10-02-cpu-tool-same-session-cache.json`. The sharply reduced prompt phase supports prompt-cache reuse already occurring in the current runtime; cache_n was not recorded. This disproves the assumption that an extra cache toggle is necessary for repeated identical requests. It does not prove reuse across different operations, context changes, provider disposal or reload.
- Next useful control is different user requests on one instance and stable-prefix placement of capability descriptions, retaining full capabilities and exact validation. Cold first-request latency remains a usability concern. Temporary logging restored byte-for-byte; production rebuilt and verified free of diagnostic markers. No product changes retained.

### CPU cache reuse for different cell requests

- Same live CPU instance, unchanged document context/B2 selection: A1-read completed in 53,306 ms (provider 53,275; prompt 50,429; decode 2,810.001), then A2-read completed in 4,899 ms (provider 4,872; prompt 2,008; decode 2,832). Both produced their own correct activities (`A1/12`, `A2/13`); captured A1:C4 values and selection unchanged, no errors/previews.
- Evidence: `2026-10-02-cpu-tool-different-request-cache.json`. Different explicit addresses can reuse the stable prompt prefix in the current runtime; identical requests are not required. These two samples do not establish reuse when document context changes.
- Current prompt places dynamic context before capability descriptions. Next controlled comparison should change selection and measure whether moving stable capabilities ahead of context improves cache reuse without affecting planning quality. Do not infer that this ordering change is proven beneficial yet.
- Temporary logging removed byte-for-byte and production rebuilt successfully, marker absent. No product changes retained; broad goal still incomplete.

### Adopted stable capability prefix after context-change comparison

- Controlled pairs: same CPU instance reads A1 at B2 selection, then explicitly reads A2 after selection changes to C3. Baseline context-before-capabilities second request spent 35,851 ms processing prompt / 39,938 ms provider / 39,971 ms total and failed; raw baseline response was not logged, so precise rejection cause is unknown. No captured worksheet value/selection changes occurred.
- Candidate moves fixed capabilities before dynamic document context, retaining every instruction, tool/schema and total 643 prompt tokens. Candidate second response was valid get_cell/A2, returned 13, prompt processing 4,429.001 ms / provider 7,266 ms / total 7,282 ms. First-request duration remained ~53 seconds. This single comparison supports substantially better prefix reuse after context changes, not a general reliability claim.
- Reports: `2026-10-02-cpu-tool-context-change-baseline.json` and `2026-10-02-cpu-tool-context-change-stable-prefix.json`. Both pairs preserved captured worksheet values/selection. Candidate raw response and measured backend timings were observed.
- Adopted the ordering change only, without diagnostics or added interface steps. Formatting, lint/type checks, build and all 102 files / 3,797 tests passed. Existing warnings remain. GPU cross-model and broader CPU regression, first-request performance, full model/device/offline scope remain unfinished.

### Stable-prefix optimization withdrawn after GPU regression

- Actual GPU 0.8B regression on adopted capabilities-before-context ordering: A1 text-value read returned no-operation guidance (2,088 ms); readonly SUM and blank PPT read passed. The current build hash was captured for every sample. Report: `2026-10-02-qwen35-08-stable-prefix-regression-ui.json`.
- Restored context-before-capabilities ordering rather than retaining a CPU speed improvement that regresses an offered GPU model. After rebuild, actual 0.8B A1 read, SUM and blank PPT all passed (2,360 / 2,333 / 1,765 ms), captured worksheet values/selection unchanged. Report: `2026-10-02-qwen35-08-prefix-rollback-ui.json`.
- This supersedes the adopted ordering recorded above: CPU speed gain remains experimental evidence and is not retained in the product. Backend phase-timing support and explicit cell-value capability description remain. Other GPU runs were stopped once the regression established the ordering candidate was unsuitable globally.
- Validation: 39 targeted tool-plan/panel tests, lint/type checks, production build and whitespace checks passed. No full-suite rerun claimed for this rollback. Broader model/device/offline acceptance remains incomplete; future cache optimization must establish cross-model quality before adoption.

### Backend-specific prompt prefix routing

- Introduced an internal tool-planning option for stable capability prefix; default ordering remains context-first. Panel opts in only for a direct WllamaProvider or LocalInferenceProvider whose actual backend is wllama, including automatic CPU fallback. GPU keeps the previously verified prompt order. No user-facing setting, capability restriction or validation relaxation was added.
- Unit evidence checks identical prompt contents across orderings and actual backend routing (GPU false / CPU true). GPU 0.8B production three-operation regression passed (2,370 / 2,370 / 1,791 ms). CPU changed-selection second request passed in 7,148 ms in an uninstrumented pair, whose first request failed with generic guidance and no captured raw response.
- A subsequent instrumented CPU pair confirmed the option actually true and valid get_cell/A1 then A2 JSON. Both passed; second took 7,320 ms with prompt processing 4,420 ms / provider 7,287 ms. First still ~53 seconds. The prior failure remains unresolved reliability evidence; do not claim all CPU requests now succeed or attribute that failure to a proven cause. Default generation temperature is 0.7; controlled JSON reliability needs further work.
- Reports: `2026-10-02-qwen35-08-backend-prefix-ui.json`, `2026-10-02-cpu-backend-prefix-ui.json`, `2026-10-02-cpu-backend-prefix-diagnostic.json`. Captured values/selection unchanged. Temporary logging removed and production rebuilt. All 102 files / 3,800 tests, lint/type checks, formatting and build passed; existing warnings remain. Other GPU models and broader CPU quality/device/offline coverage remain outstanding.

### CPU schema-constrained task generation

- Installed wllama 3.6.1 OpenAI-compatible source types expose response_format=json_schema with name/schema/strict. Added WllamaProvider.generateJSON using that native request field while sharing existing queue, abort/lifetime, completion parsing and usage timing. Normal chat and streaming do not receive response_format; task schema is request-local, not a persistent generation setting.
- Regression failed before implementation (generateJSON missing), then verifies exact schema forwarding and no schema leakage into subsequent chat. Existing application plan parsing, operation bounds, target binding and stale-target checks remain required; schema cannot prove semantic correctness.
- Actual production automatic CPU fallback accepted two tool-schema requests, returned A1/12 and A2/13 while changing selection B2→C3 between requests; captured worksheet values/selection unchanged, no errors/previews. First 53,193 ms; second 7,285 ms. Report: `2026-10-02-cpu-schema-tool-ui.json`. Two successes do not establish statistical reliability or complete grammar/schema coverage.
- Validation: 102 files / 3,801 tests, lint/type checks, formatting, production build passed; existing warnings remain. Native schema support now also affects CPU writing tasks, whose quality and cancellation require further real-model regression. Full goal remains unfinished.

### CPU native-schema tool and selected-text writing regression

- Additional actual CPU schema requests passed: readonly A1:A3 SUM returned 42 (54,478 ms), blank PPT returned clear no-readable-text feedback (33,266 ms). Captured Excel values/selection and PPT count/text unchanged; no errors/previews. Report: `2026-10-02-cpu-schema-read-tools-ui.json`.
- Real selected-text Word writing showed mixed quality: formal English rewrite failed with generic guidance after 37,156 ms and preserved original text. Raw response was not captured, so no specific parse/fidelity failure cause is established. Negation summary passed in 40,682 ms and directly applied `Alex proposed a payment of 1,250 EUR on 2026-10-08, which has not been approved.` retaining name, amount, currency, date and nonapproval, with a shorter sentence.
- Report: `2026-10-02-cpu-schema-direct-writing-quality.json`. These are isolated new DOCX fixtures using the actual editor API; no previews were added. Undo/save was not exercised in this writing pair. Next writing diagnosis should capture the failed formal-rewrite response before changing prompts or guards.
- No product code changed in this regression run. Native schema forwarding does not establish formal-style quality or universal factual preservation. Full model/language/device/offline objective remains incomplete.

### CPU formal rewrite diagnosis and explicit fidelity guidance

- Reproduced the failed formal English selected-text rewrite with observed raw CPU response: valid JSON containing `Hey, Alex will pay 1,250 EUR on October 8, 2026.` Native schema format is valid, but the required literal ISO date was changed and colloquial Hey remained. The existing numeric-token preservation guard rejects before document application; original selected text remained unchanged. Provider 36,604 ms (prompt 31,624; decode 4,938), total 36,639 ms.
- Evidence: `2026-10-02-cpu-formal-writing-diagnostic.json`. This establishes the cause for this reproduced sample, not every earlier failure. Diagnostic logging restored byte-for-byte and removed from production assets.
- Added seven-locale guidance for the existing numeric-preservation rejection: model changed/omitted source numbers or date formatting, retry/use another model. Existing localized-message preservation prevents repeated displayError formatting from collapsing it back to generic guidance. No numeric guard relaxation, preview or extra confirmation.
- Regression failed with generic error before the change; now exact guidance/idempotence passes. All 102 files / 3,802 tests and production build passed. Lint first found unused model constants in the new untracked CPU test harnesses; removed them and reran lint/type checks successfully. Formal-style quality remains unresolved; new UI feedback was verified by unit tests rather than a new post-localization real-model run.

### Rejected appended-literals writing prompt probe

- Temporarily appended a reference-data list of exact numeric/date literals plus explicit no date reformatting to the writing user prompt, retaining existing schema and guards. Actual CPU formal-English output was valid JSON: `Alex is to pay 1,250 EUR on October 8, 2026.` Colloquial Hey was removed, but ISO date formatting still violated the existing literal-preservation requirement, so application rejected and source remained unchanged.
- Observed raw diagnostic confirms candidate execution. Prompt grew from 447 to 487 tokens; provider duration 40,850 ms (prompt 35,768.999; decode 5,040), total 40,899 ms. This single stochastic sample is not a reliable speed/quality comparison. Evidence: `2026-10-02-cpu-writing-literals-probe.json`.
- Candidate was not adopted: added instructions alone did not satisfy fidelity and increased prompt processing in this sample. Source restored byte-for-byte, production rebuilt and diagnostic markers absent. No product behavior changes retained.
- Actual UI now showed the new numeric/date-format guidance and Restore request, verifying the localization change on a real failed generation. Full writing quality remains unresolved; future structured-output constraint experiments must preserve complete task scope and avoid silently accepting/reformatting changed numeric tokens.

### Native schema effectiveness versus date-pattern support

- Synthetic CPU writing control added a text pattern requiring the known fixture ISO date (`^[\s\S]*2026-10-08[\s\S]*$`). Observed output still spelled the date `October 8, 2026`; existing application numeric guard rejected it and source was unchanged. This pattern candidate was not adopted. No general conclusion that every regex is unsupported is justified without backend grammar diagnostics.
- Separate control supplied an enum only in the response schema, requiring `SCHEMA_CONTROL_2026-10-08_1250`. Actual model returned exactly that value although it was absent from the natural-language prompt, establishing effective native schema constraint forwarding in this runtime. Application numeric guard correctly rejected synthetic text; source remained unchanged.
- Reports: `2026-10-02-cpu-writing-date-pattern-probe.json` and `2026-10-02-cpu-writing-schema-enum-control.json`. Temporary fixture-specific patterns/enums/logging were removed byte-for-byte and production rebuilt, with markers absent. No product constraints changed.
- Next useful investigation is supported pattern syntax/grammar behavior, not assuming schema requests are wholly ignored or weakening numeric validation. Writing style/fidelity and full goal remain unfinished.

### Rejected simple date-pattern probe; next diagnostics must precede dispatch

- Temporarily simplified the fixture-specific text constraint to `^.*2026-10-08.*$`. Actual CPU UI request failed after 150,878 ms with generic guidance; selected source remained unchanged, no preview/page errors. No raw completion reached the post-provider diagnostic. Report: `2026-10-02-cpu-writing-simple-date-pattern.json`.
- This does not establish regex support, generation repetition, an output limit or exact engine failure. The diagnostic was after the provider return, so there is no observed pre-dispatch schema marker; the candidate source/build existed but actual request schema dispatch was not recorded. Do not claim this test conclusively demonstrates pattern enforcement or ignored pattern behavior.
- Rejected candidate and restored source byte-for-byte; production build passed again and diagnostic markers absent. No production behavior changed. Before additional constraint changes, instrument pre-dispatch parameters and capture provider/Worker exceptions; avoid inferring a cause from elapsed time alone. Full quality/device/offline scope remains incomplete.

### Date-pattern failure traced to provider RuntimeError

- Repeated the rejected simple pattern experiment with pre-dispatch schema logging and provider exception logging. Observed actual schema `text.pattern=^.*2026-10-08.*$`, then provider `RuntimeError: Length out of range of buffer` after ~150 seconds; no completion returned. Captured source document remained unchanged. Report: `2026-10-02-cpu-writing-date-pattern-trace.json`.
- This closes the previous dispatch/exception diagnostic gap: the schema was present and failure occurred within provider/native-runtime work, before writing response validation and document application. It does not establish the specific internal buffer/grammar cause, out-of-memory, generation repetition or output-limit behavior. No native stack or postfailure engine recovery was captured.
- Fixture-specific pattern and temporary diagnostic logging restored byte-for-byte; production build passed and markers absent. No product constraint changes retained. Future work should inspect runtime failure/recovery and supported grammar behavior before another string-pattern attempt. Broad model quality, device and offline scope remain incomplete.

### Retire CPU engines after native runtime failures

- Reproduced a provider lifecycle defect with the observed RuntimeError class/message: after rejected inference, isReady remained true and subsequent requests could be sent to the same native engine. Regression failed before change.
- WllamaProvider now detaches/releases the owned engine on RuntimeError/WllamaRuntimeError, retains original rejection, and waits for owned cleanup before a new preload. Failed requests are never replayed automatically. Existing release deduplication prevents double disposal. Ordinary request Error leaves a healthy model loaded.
- Panel synchronizes runtime status and replaces stale loaded feedback with the existing Load model instruction whenever the provider becomes unready after a request; stop-triggered reload keeps its prior behavior. No new dialog or preview.
- Unit evidence covers retired readiness, blocked use before reload, fresh engine preload/new request, exactly-once old release, ordinary request-error preservation, and panel feedback. All 102 files / 3,805 tests, lint/type checks, formatting and production build passed; existing warnings remain.
- These are controlled provider/panel tests. No new real native-trap→reload→inference browser sequence was run after the fix; exact internal cause of the rejected experimental date pattern remains unresolved. Full quality/device/offline goal remains incomplete.

### Same-page CPU native error recovery

Actual desktop Playwright WebKit CPU Qwen3-0.6B reproduced `RuntimeError: Length out of range of buffer` after 150,203 ms with a temporary fixture-only date-pattern schema. Provider became unready; UI showed `Load model` and cleared the engine label. Original Word text remained unchanged. Without refreshing the page, settings/load clicks reloaded the cached model in 2,268 ms, and a subsequent chat returned `Only hello.` in 14,308 ms. This proves one recovery sequence, not exact instruction compliance or overall writing quality. No browser page errors occurred.

The initial run was blocked by a PWA installation overlay; the rerun removed that overlay only in the isolated test page. Temporary schema/log instrumentation was restored and production rebuilt successfully. Evidence: `2026-10-02-cpu-native-error-recovery-ui.json`. Physical Safari/iOS, repeated fault cycles, and native buffer root cause remain unverified.

### Remaining GPU models after backend-specific prefix selection

Current production `editor-g_Q7lD-l.js` was exercised with actual Metal GPU Qwen3-1.7B, Qwen3.5-2B, and Qwen3-4B. All nine samples passed: Excel A1 value 12, read-only A1:A3 sum 42, and blank-PPT no-readable-text feedback. Excel values and B2 selection/active cell remained unchanged; PPT slide count/text remained unchanged. No visible errors, page errors, or preview cards. Durations respectively: 1.7B 1,903/1,908/1,352 ms; 2B 3,037/3,186/2,028 ms; 4B 4,515/4,708/3,319 ms. Together with the previous 0.8B run this closes the narrow four-GPU read-tool regression gap following backend-specific stable-prefix selection, not full model/writing verification. Reports: `2026-10-02-{qwen3-17,qwen35-2,qwen3-4}-backend-prefix-regression-ui.json`.

### Four-GPU bilingual factual summary comparison

Eight actual selected-Word-text IM samples were run in isolated Chromium Metal documents, with explicit one-sentence summary instructions preserving Alex, 1,250 EUR, 2026-10-08 and not-yet-approved status. No preview cards or page errors. 0.8B copied both sources; unchanged-text guard rejected both and document stayed unchanged. 1.7B produced shorter English/Chinese summaries preserving these facts (1,855/1,812 ms). 2B English changed current unapproved wording to past tense; Chinese preserved facts but grew longer than source, so generation success is not concise-summary success (3,027/2,714 ms). 4B English preserved facts; Chinese moved the date from proposed payment date to proposal date (`Alex 于 2026-10-08 提议支付…`), accepted by numeric validation (3,959/3,748 ms). This concretely exposes a semantic-fidelity gap even when numbers are retained. No simplistic larger-model quality guarantee or broad task pass is supported.

Evidence: `2026-10-02-{qwen35-08,qwen3-17,qwen35-2,qwen3-4}-negation-summary-ui.json`, including exact source/output and manual semantic assessments. Follow-up must address fidelity rather than weakening guards or adding preview confirmation. Native Undo/save was not exercised here.

### Factual-relationship prompt candidate

A temporary general instruction explicitly preserving who/what/event-date and proposed/pending/approved/denied status was exercised through the built production writing route, with runtime marker observed in all four samples. 4B Chinese now retained payment-date attachment (`Alex 提议于 2026-10-08 支付…`) instead of the previous proposal-date drift; English retained current unapproved status. 1.7B English/Chinese also retained the specified facts. Durations 4B 4,322/4,139 ms, 1.7B 1,989/1,929 ms. These single samples are promising evidence, not proof of causation or universal fidelity. Candidate is not adopted pending other-model/task/language checks; temporary prompt/log removed and production rebuilt. Reports: `2026-10-02-{qwen3-4,qwen3-17}-fidelity-candidate-negation-summary-ui.json`.

### Remaining GPU models with factual-relationship candidate

Runtime marker confirmed the same temporary relationship instruction on both remaining models and both languages. 0.8B still copied both sources, correctly rejected without editing the document (2,441/2,057 ms). 2B English now used current `has not been approved` wording and preserved payment-date attachment (3,133 ms); Chinese preserved facts but remained longer than source (3,016 ms). Thus the candidate does not solve small-model copying or concise-summary failure. Across all four GPU models the limited samples support further testing, not general deployment: rewrite/translation/CPU and broader factual fixtures remain untested. Temporary candidate removed and production rebuilt. Evidence: `2026-10-02-{qwen35-08,qwen35-2}-fidelity-candidate-negation-summary-ui.json`.

### CPU factual-relationship candidate is not adopted

Actual WebKit CPU Qwen3-0.6B writing route observed the candidate runtime marker twice. Formal English rewrite failed numeric/date validation after 41,742 ms; original Word text unchanged. Negation summary copied source and was rejected after 44,428 ms, whereas an earlier baseline sample had produced a valid shorter summary. This is a possible regression, not a statistically established causal effect. No preview cards or page errors. Raw completion was not captured, so exact date-format mutation is not established by this run. The factual-relationship prompt candidate remains unadopted: limited GPU improvements do not justify shipping while CPU behavior fails these tasks. Temporary prompt/log removed; production rebuilt. Evidence: `2026-10-02-cpu-fidelity-candidate-writing-ui.json`.

### Reject summaries that do not compress source text

Product writing validation now rejects summaries whose non-whitespace Unicode code-point count is not smaller than the source. This prevents padding source whitespace from making an equal-length result appear shorter; existing unchanged-output guidance remains separate. Seven locales provide `agentSummaryNotShorter` guidance, mapped and idempotently preserved by presentation. RED regressions accepted the real overlong Chinese 2B output and equal-length/whitespace cases; GREEN rejects them. Full 102 files / 3,809 tests, lint/typecheck and production build pass. Existing build chunk/externalization and asynchronous rejection warnings remain.

Actual 2B IM rerun: English shorter result applied (2,882 ms); Chinese overlong summary rejected with precise guidance (2,871 ms), original Word text unchanged, no preview cards/page errors. The English past-tense approval wording limitation remains: length validation does not establish semantic fidelity. Evidence `2026-10-02-qwen35-2-summary-length-guard-negation-summary-ui.json`.

### Seven-language actual Word translation: 1.7B

Seven selected-text IM translations were run and repeated with raw-output instrumentation. English/German/Portuguese applied; Chinese/Japanese/Korean/Spanish were rejected by the numeric/date-format guard, leaving originals unchanged. Raw responses confirm ISO date converted into local date wording in those four cases (Chinese/Japanese/Korean 2026年/년10月/월8日/일, Spanish 08 de octubre de 2026). Japanese also transliterated Alex and rendered EUR as `エーディンス`, exposing additional factual/lexical issues hidden behind the first validation failure. German generated malformed `propsetzte`, accepted by existing validation. Thus three applied results are not three full quality passes. The English source has date-attachment ambiguity, so event-date semantic judgments require cleaner fixtures. No page errors/preview cards. Temporary logging removed, source restored, production rebuilt. Reports: `2026-10-02-qwen3-17-seven-language-translation-ui.json` and `2026-10-02-qwen3-17-diagnostic-seven-language-translation-ui.json`.

### Remaining GPU seven-language translation comparison

21 actual selected-Word IM translations completed on 4B/2B/0.8B, with no page errors or preview cards. 4B applied Chinese/English/Korean; rejected Japanese/German/Spanish/Portuguese; Chinese and Korean changed original Alex spelling despite preservation instructions. 2B applied only English; other six rejected with numeric/date guidance, originals unchanged. 0.8B Japanese failed generically and Portuguese was rejected by numeric/date guidance; Chinese/English/Korean/German/Spanish applied; Korean produced malformed `아lex` and extra `2026 년 10 월` before `2026-10-08`, accepted by numeric membership validation because repeated tokens already occur in source. German drifted to incoming-payment wording `Zahlungseingang`. These are explicit quality failures despite successful application. Raw completions for rejected samples were not captured; do not infer their exact cause beyond displayed guard guidance. Four-GPU seven-language narrow fixture coverage now exists, not complete model quality verification. Follow-up should enforce numeric multiplicity as well as value membership, and improve identity/meaning preservation. Reports: `2026-10-02-{qwen3-4,qwen35-2,qwen35-08}-seven-language-translation-ui.json`.

### Numeric occurrence validation

Writing validation now consumes counts of each numeric token from source, rejecting added repetitions as well as changed/new values. Rewrite/translation reject leftover source counts; summaries may omit occurrences but cannot duplicate them. Existing localized numeric/date guidance reused, no extra preview or confirmation. Five regressions were RED under membership-only validation (duplicates in all three tasks; omission of repeated number in rewrite/translation), now GREEN; valid summary omission also covered. Full 102 files / 3,815 tests, lint/typecheck and production build pass.

Actual 0.8B Korean IM rerun rejected after 2,622 ms with numeric/date guidance, original Word text unchanged, no preview/page errors. Raw output not captured, so do not assert identical malformed completion or the specific rejecting branch from UI evidence alone; unit regressions establish count behavior. Evidence `2026-10-02-qwen35-08-numeric-count-guard-seven-language-translation-ui.json`. Names/negation/event-date/units and overall fidelity remain unresolved.

### Cached WebGPU inference after actual offline reload

Isolated persistent Chromium Metal warmed current production editor and Qwen3-1.7B, then `context.setOffline(true)` and reloaded the page before loading the model and asking for hello. An uncached unique same-origin `.txt` fetch failed with `TypeError: Failed to fetch`/`net::ERR_FAILED`, proving network unreachability despite `navigator.onLine` remaining true. Reloaded editor had own SW controller, document load/full API ready; cached model loaded as WebGPU and returned exact `Hello.`. No page errors. SDK spelling helper requests aborted, so spellchecking is not proven. This closes one desktop Chromium cached-model offline reload/inference case, not all models/browsers or offline writing. Report `2026-10-02-offline-gpu-current-ui.json`.

### Offline IM document writes and native Undo

After warming each editor online, isolated Chromium Metal was put offline, an uncached unique fetch failed, and the page reloaded. Cached 1.7B model then executed actual IM tools: Word inserted `OFFLINE_WORD_2026` (2,734 ms), Excel set B2 to `OFFLINE_CELL_2026` (2,083 ms), PPT added one slide. Native Word/PPT `Undo()` and Excel `asc_Undo()` restored respective text/cell/slide-count snapshots. No preview cards, visible errors or page errors in final runs. Initial fixture API mistakes (Word/PPT asc_Undo and Excel window.editor) were corrected using actual editor-specific globals/methods, then rerun. This is one offline operation per editor, not all tools, save/export or full content/selection equivalence. Reports `2026-10-02-offline-{word,xlsx,pptx}-tool-undo-ui.json`.

### Dark long-result IM visual verification

Actual 1.7B IM read of a 300+ character unbroken A1 value was checked in dark theme at 1440x960 and 390x844. Both screenshots inspected: text wraps within panel, single visible result without disclosure/preview, input remains visible at bottom; no horizontal page overflow. Excel values and B2 selection unchanged, no visible/page errors, 1,985 ms. Initial fixture errors came from asynchronous paste followed by immediate selection changes; final fixture waits for confirmed A1 value before moving to B2. Viewport emulation is not physical mobile/keyboard evidence. Grouped results, long conversations, keyboard accessibility and all locales remain unverified. Evidence `2026-10-02-dark-long-tool-results-ui.json`; screenshots remain in isolated `.scratch/ai-csp/dark-long-results-0-{desktop,mobile}.png`.

### Seven-locale dark narrow IM layout

Actual long A1 reads completed in zh-CN/en/ja/ko/de/es/pt UI locales on GPU1.7B. All seven result/data/selection checks passed, no preview/disclosure/page errors. Seven 390x844 screenshots inspected: headings/placeholders/mode labels fit, long value wraps, input remains visible within viewport; no horizontal overflow. Initial readiness fixture was premature and produced no results; final rerun waited for ready runtime. Physical mobile, virtual keyboard, accessibility, settings/grouped results and long conversations remain unverified. Evidence `2026-10-02-seven-locale-dark-long-results-ui.json`.

### PPT native text API feasibility

Actual isolated blank PPT with first placeholder selected: `pluginMethod_InputText` made no change without text-edit mode; `pluginMethod_PasteText` added a new text shape containing `PPT_NATIVE_TEXT_2026`, shape count 2→3 and history -1→0. Native `Undo()` restored empty original shapes/count/history. Therefore PasteText cannot honestly implement selected-placeholder replacement; it can underpin explicitly named add-text-box behavior once current slide/shape target binding, read-only/context lifetime, readback and regression checks are implemented. Existing slide position capture tracks current page/selected slides, insufficient for selected-shape replacement. PPT text writing remains unimplemented. Evidence `2026-10-02-ppt-native-text-probe.json`. Initial harness omitted agent query and waited for absent sidebar entry; fixed before final actual probe.

### IM PPT new text box tool implemented

`add_slide_text` is registered only for presentation planning, with exact bounded text input and explicit add-new-box semantics. Normal slide/editability/API checks precede execution; selection is reset to avoid editing existing text. Readback verifies the same logic/current slide, exactly one new shape, exact inserted text (CRLF normalized, trailing whitespace ignored), and unchanged original shape references/text. Existing DocumentToolAction history/lifetime/read-only checks and once-only execution apply. No preview/confirmation added. Unit regressions cover new shape preservation, readonly/master rejection and slide change during execution; initial missing-tool tests RED, then GREEN.

Actual 1.7B after offline editor reload added `PPT_TEXT_TOOL_2026` in 1,631 ms, count 2→3, original placeholder texts retained, native Undo restored original shape-text snapshot; no visible/page errors or preview. Initial full 102 files / 3,817 tests plus two additional office regressions pass; lint/type/build pass. Broader model/language/layout quality, exact whitespace fidelity and selected-shape replacement remain unverified/unimplemented. Evidence `2026-10-02-ppt-add-text-tool-undo-ui.json`.

### PPT text exact-whitespace readback

Removed trimEnd from new-text-box verification: normalized SDK text must equal requested text plus the standard paragraph-ending newline. Regression losing requested trailing spaces was RED (wrongly verified), now GREEN; exact trailing spaces covered positively. Full 102 files / 3,820 tests plus one positive case, lint/type/build pass. Actual 1.7B offline IM insertion/native Undo still pass (1,624 ms). SDK probe with two trailing spaces and final newline preserved spaces but collapsed final newline into paragraph ending; stricter verification will not claim successful preservation of that requested final newline. This is a remaining native fidelity limitation, not a reason to silently trim. Reports `2026-10-02-ppt-native-trailing-whitespace-probe.json` and refreshed `2026-10-02-ppt-add-text-tool-undo-ui.json`.

### Remaining GPU PPT text writes and four-model read regression

After current text-tool/whitespace changes, offline cached 0.8B/2B/4B each selected the new text-box operation, inserted exact `PPT_TEXT_TOOL_2026`, retained original placeholder texts, and native Undo restored original snapshot (2,289/3,092/3,998 ms). Together with prior 1.7B this is narrow four-GPU offline text-box coverage. Current `editor-CdyIt6Y2.js` blank-PPT read regression also passed on all four (1,970/1,506/2,798/3,684 ms); no guessed write, slide/text snapshot unchanged, no preview/page errors. Not broad layout/language/mobile or save/export proof. Evidence `2026-10-02-{qwen35-08,qwen35-2,qwen3-4}-ppt-text-tool-undo-ui.json` and `2026-10-02-{qwen35-08,qwen3-17,qwen35-2,qwen3-4}-ppt-read-after-text-tool-ui.json`.

### CPU IM PPT new text box and native Undo

Actual current production `editor-CdyIt6Y2.js`, WebKit WASM CPU Qwen3-0.6B selected the new text-box tool, inserted exact `CPU_PPT_TEXT_2026` in 41,377 ms, preserved two original empty placeholder texts and slide count, added exactly one shape, and native Undo restored full shape-text/count snapshot. No visible/page errors or preview. This extends the narrow default-slide short-ASCII feature sample to the CPU fallback, not offline WebKit/physical iOS or broad reliability. Latency remains substantially higher than GPU cases; no statistical speed comparison implied. Evidence `2026-10-02-cpu-ppt-text-tool-undo-ui.json`.

### PPT multiline text readback fixed

Bilingual three-line IM insertion initially failed in offline and online controls, reporting an empty new shape through getText. Temporary dispatch marker confirmed exact model text and no synchronous PasteText error. Native shape inspection established actual paragraphs contained all requested content: SDK shape.getText delegates GetSelectedText and returns undefined for this multi-paragraph shape, while getDocContent().GetText({}) reads the complete text. Therefore earlier empty snapshots were readback artifacts, not absent writes. New-text verification now reads document content first with legacy getText fallback and waits safely on undefined. Regressions cover delayed text and multiline document-content fallback. Full 102 files / 3,823 tests, lint/type/build pass.

Final actual offline 1.7B IM sample inserted bilingual three-line text with exact Alex/amount/date/negation/newlines in 2,252 ms; native Undo restored original shape texts, no preview/errors. Screenshot inspected: native default text box overlaps title/subtitle placeholders and looks too small; layout quality remains unresolved despite content fidelity. General PPT reading still uses its prior shape reader and needs the same multiline correction. Diagnostic logs removed and production rebuilt. Reports `2026-10-02-ppt-{bilingual-multiline-text-ui,bilingual-multiline-online-control-ui,bilingual-multiline-diagnostic-ui,multiline-shape-content-probe}.json`.

### Presentation reading supports multiline document content

PPT text reads now prefer shape.getDocContent().GetText({}) with getText fallback, preserving group recursion/slide labels/truncation and safely handling undefined text. Multiline regression RED TypeError→GREEN exact bilingual result; full 102 files / 3,824 tests, lint/type/build pass. Actual cached1.7B offline reloaded IM add→read→Undo passed: three lines including name/amount/date/negation returned intact, content/shape-text snapshot unchanged by read, original restored by Undo. No preview/page/visible errors. Native default layout issue remains. Evidence `2026-10-02-ppt-multiline-write-read-undo-ui.json`.

### PPT text geometry/history API investigation

Native ImgApply changes selected new text-box X/Y/Width; requested Height 55 was auto-adjusted to 33.03, Width220 became220.01. Separate paste+layout creates two history entries and needs two Undo calls. executeGroupActions grouping of synchronous paste+ImgApply was probed separately; exact results recorded in `2026-10-02-ppt-text-layout-group-probe.json`. Hardcoded coordinates are fixture-only, not product placement policy; avoid deploying them as a general fix. Need collision-aware placement with measured slide/shape bounds, native auto-size readback, async multilingual handling and once-only Undo before shipping improved layout. Evidence `2026-10-02-ppt-text-layout-{api,group}-probe.json`.

### PPT native history grouping follow-up

Real Chromium isolated default-slide probes found that `api.startGroupActions()` + `executeGroupActions()` + `endGroupActions()` left the collaborative global lock true: geometry was unchanged and Undo did not remove the pasted box. Waiting 500 ms between paste and geometry did not resolve this. These are failed candidates, not successful grouping evidence. Reports: `2026-10-02-ppt-text-layout-{explicit,async}-group-probe.json`.

Using the SDK native history `startGroupPoints()` / `endGroupPoints()` around synchronous `PasteText` + `ImgApply` did merge both edits into one history entry. Actual resulting geometry was X20/Y150/Width220.01/Height25.41; one native Undo removed the box and restored the original two placeholders, history index -1. A second Undo was a no-op. Report: `2026-10-02-ppt-text-layout-history-group-probe.json`. This is native API evidence only: fixed coordinates remain fixture-only, no product layout change has shipped. Still require asynchronous/multilingual paste, read-only/context-change/failure cleanup, prior-history preservation, and collision-aware placement before integration.

### PPT bilingual grouping with prior history and Redo

Native Chromium probe inserted an independent earlier text box, opened `History.startGroupPoints()`, pasted exact three-line Chinese/English text, waited for the new shape and its content, changed geometry, and closed the group in `finally`. One Undo restored the full earlier snapshot (text, geometry, history); the second removed the earlier independent edit. Two Redo calls restored the final exact grouped snapshot. Final global lock was false. Evidence: `2026-10-02-ppt-multilingual-history-group-probe.json` (passed).

An initial probe that waited only for `Get_GlobalLock() === false` reached geometry before the bilingual shape existed and failed its geometry assertion. Thus an unlocked editor is insufficient evidence of completed paste: integration must wait for new shape/content identity, not just the lock. The final probe adds explicit bounded shape/content polling and exact content/readback assertions. Fixed fixture coordinates and isolated native calls remain distinct from shipped IM auto-layout; no production behavior changed in this turn.

### Measured PPT free-space placement helper

Added `lib/agent-plugin/slide-text-layout.ts`: deterministic top-to-bottom/left-to-right placement for a measured text box, with proportional slide margins and obstacle clearance. It preserves text dimensions and occupied bounds, returns no placement for full slides or uncertain/unmeasured geometry, and requires callers to provide recalculated axis-aligned bounds for rotated/grouped shapes. Six tests cover landscape/portrait margins, title/subtitle avoidance, side gaps, no room/oversize, invalid geometry, and off-slide obstacles. Full suite: 103 files / 3,830 tests passed; lint/typecheck passed.

Native Chromium probe used this exact helper (serialized from the TypeScript export), first resized the bilingual text box to 65% of slide width, then read actual auto-sized bounds and found a location below the subtitle. Actual final X10.16/Y149.86/Width220.1433/Height25.41 stayed within the 338.6667×190.5 slide. Prior edit and placeholders were preserved; grouped Undo/Redo restored exact snapshots, native lock false. Evidence: `2026-10-02-ppt-measured-layout-history-group-probe.json`. This is an isolated native API probe, not an IM end-to-end test or visual design approval. Tool integration, rotated/group bounds, no-room failure cleanup and context-change handling remain incomplete; helper is not yet called by the product tool.

### Rotated and grouped native drawing bounds

A real Chromium probe rotated a text shape by 45 degrees through the native xfrm setter and recalculated the presentation. Its original extents were 64.9985×10.16, while recalculated drawing bounds were 53.1451×53.1451 at X142.7608/Y68.6775: raw x/y/extX/extY would miss visible content. Grouping that shape with a second text object produced native group bounds containing both child bounds. Added `readSlideShapeBounds` to consume validated recalculated l/t/r/b bounds, with no unsafe fallback to unrotated dimensions. Three additional unit tests cover rotated bounds, group bounds, and missing/zero/nonfinite/inverted bounds; all nine placement/bounds tests passed, lint/typecheck passed.

Report `2026-10-02-ppt-native-shape-bounds-probe.json` is passed and directly checks the adapter on native shape/group snapshots and that the group contains both children. This covers one rotated text shape and one two-child group, not charts, deeply nested groups, stroke effects, or complete IM placement. Product tool integration and cleanup on no room remain incomplete. Initial fixture readiness was insufficient (sidebar appeared before logic document initialization); final probe explicitly waits for native document readiness.

Full regression after bounds adapter: 103 files / 3,833 tests passed. Existing two asynchronous rejection-handled warnings remain.

### Native no-room rollback preserves earlier edits

Real Chromium probe pasted an independent earlier text box, opened a native history group, then pasted 40 bilingual lines asynchronously and resized to 65% of slide width. Actual native measured box height was 307.35 mm on a 190.5 mm-high slide, so the production placement helper correctly returned no room. `History.cancelGroupPoints()` followed by presentation Recalculate/interface update restored the exact earlier text, native bounds and history index snapshot. Native Redo was a no-op for the canceled operation; subsequent Undo/Redo of the independent prior edit worked and restored the exact prior snapshot. Final native global lock was false. Evidence: `2026-10-02-ppt-no-room-rollback-probe.json` (passed).

This establishes a native rollback path for a completed paste with no room. It does not prove safe cancellation while paste is still pending, after unrelated user edits or changed document context, with preexisting Redo history, or nested history groups. Product tool integration remains incomplete, and these ownership/concurrency cases must be handled explicitly rather than unconditionally canceling all points from a group marker. No product behavior changed in this evidence-only turn.

### Native interaction action balance before tool integration

Runtime inspection confirms collaborative `Set_GlobalLock(true)` increments a counter and false decrements it (clamped at zero); Get_GlobalLock tests whether the counter is zero. It must not be treated as an assignable Boolean or force-cleared. Evidence: `2026-10-02-ppt-native-lock-api-probe.json`, including actual runtime method bodies and native action enums.

A native no-room rollback probe added `sync_StartAction(BlockInteraction, ApplyChanges)` before the history group and matched `sync_EndAction` after rollback. Actual isLongAction was false→true→false and collaborative lock count stayed 0 throughout. Original editor callbacks were preserved by forwarding a temporary sendEvent observer, then restoring it. Both native start/end events were observed with [1,9]. Paste, measured no-room detection, rollback and independent prior Undo/Redo still passed. Evidence: `2026-10-02-ppt-native-block-interaction-probe.json`. This verifies balanced native action counters/events, not actual pointer/keyboard blocking: real UI interaction, programmatic target changes, exceptional-finally cleanup and pending-paste timeout still need verification before claiming operation isolation or integrating the product tool. No production behavior changed.

### Actual native interaction blocking UI probe

Chromium two-slide fixture called native BlockInteraction/ApplyChanges, then actual Playwright keyboard PageDown/Delete/text entry and pointer canvas click followed by PageDown. Page, slide text and history remained unchanged, native busy true. After matched EndAction, busy false and the same canvas click + PageDown navigated to slide two (positive control). Native asc-loadmask existed with nonzero bounds; inspected screenshot shows a transparent mask, not an extra confirmation/preview card. Evidence: `2026-10-02-ppt-native-block-interaction-ui.json` (passed); screenshot `.scratch/ai-csp/ppt-native-block-interaction-ui.png`.

This verifies document keyboard/canvas interaction isolation for this fixture. Thumbnail/toolbar clicks, parent IM actions, programmatic navigation, native outstanding paste timeout and exceptional cleanup still need coverage. Product IM auto-layout remains unintegrated. No source changes in this turn.

### Reusable native blocking action scope

Added `lib/agent-plugin/editor-action.ts` with `withBlockingEditorAction`: validates native capabilities and target-runtime enum codes before execution, rejects already-busy editors, awaits work, and ends its own captured action in finally. It does not alter collaborative lock counters or manage history/paste cancellation. Five tests cover pending async lifetime, work failure cleanup, concurrent refusal without releasing the first action, invalid capability/code rejection, and runtime-code-object mutation. The latter failed with EndAction [1,11] instead of [1,9] before capturing enum primitives, then passed. Full regression: 104 files / 3,838 tests passed; lint/typecheck passed.

Real Chromium UI probe serialized this exact exported helper around a pending promise, tested keyboard/pointer attempts, resolved the promise to release, and verified same click/PageDown navigated only after release. Document/history unchanged during blocking and native busy balanced; report `2026-10-02-ppt-blocking-action-helper-ui.json` passed. Helper is not yet wired into product add_slide_text. Native StartAction/EndAction exceptions, background programmatic edits and pending paste cancellation remain separate limitations; auto-layout integration still incomplete.

### Editor bridge exposes native operation context

Extended the existing fresh-per-call editor context with optional same-frame AscCommon history/collaborative state and typed runtime action enums. This supplies the forthcoming PPT layout transaction with the target editor's native history instead of another iframe or a parent/global cache. Existing callers without AscCommon retain their previous context shape. Two regressions failed before the bridge exposed AscCommon and then passed: competing iframe resolves the named editor's history, and replacing the frame resolves the new history reference. Full tests: 104 files / 3,840 tests passed; lint/typecheck passed (including the final type-only enum addition).

This is a bridge prerequisite, not completed auto-layout integration. No new IM execution behavior is claimed; pending native paste and unrelated history ownership checks remain required.

### Native blocking now integrated into IM PPT text insertion

`add_slide_text` now resolves the target editor context and wraps selection reset, native paste and exact content verification in `withBlockingEditorAction`, using that frame's native action enums. Captures native PasteText before the async closure and calls it with original API receiver. Missing action API/enum or already-busy editor rejects before paste; paste failure and verification failure release the owned action through finally. Two tool tests failed before integration (paste observed busy false; failure had no EndAction), then passed. Full suite 104 files / 3,842 tests passed; final capture adjustment targeted 24 tests passed; lint/typecheck and production build passed. Existing build externalization/large-chunk warnings remain.

Actual production `editor-D3wZ1Nqq.js` with cached 1.7B WebGPU offline reload (failed uncached network control) completed IM exact bilingual three-line insertion in 3,926 ms, readback in 1,386 ms, and native Undo restored original placeholders. Observed exactly one BlockInteraction/ApplyChanges start and end, native busy false afterward, no page/visible errors or preview cards. Report `2026-10-02-ppt-blocking-write-read-undo-ui.json` passed. This integrates operation blocking only: measured collision-free layout/history grouping and no-room rollback are still not wired into the tool; default SDK placement remains. Pending native paste timeout remains a limitation and must be addressed before rollback integration.

### Native paste completion callback evidence

Local SDK primary source shows `pluginMethod_PasteText` delegates to `asc_PasteData(Text, text, undefined, undefined, undefined, completion)`; the slide API passes completion through native paste processing. Real Chromium direct native API probe confirmed callbacks see exact final one-line/bilingual multiline shape content and independent prior edit; native Undo preserves prior edit and action/lock are balanced. Report `2026-10-02-ppt-native-paste-completion-probe.json` passed. Normal fixture completed synchronously, so it did not prove asynchronous waiting.

A second probe delayed the existing native pre_Paste function by 200 ms, forwarding original arguments/receiver and restoring it in finally. Native preparation was actually reached once per paste; returned event saw no new shape at 2.2/0.8 ms, completion callback saw exact final text at 218.2/210.3 ms. Undo and native action balance passed. Report `2026-10-02-ppt-native-delayed-paste-completion-probe.json`. This is controlled native preparation latency, not actual cold font/network download. It establishes a usable completion signal for pending paste; missing callbacks, rejected native edit paths and safe timeout/cancellation still need handling. Product add_slide_text currently still uses pluginMethod_PasteText + bounded readback polling: callback migration and auto-layout remain incomplete. No product code changed in this turn.

### Reject native non-editable states before paste actions

Actual Chromium `asc_setViewMode(true)` probe: canEdit false, isViewMode true; direct asc_PasteData rejected without invoking completion (150 ms observation), document unchanged and no native busy action. Calling pluginMethod_PasteText in the same state left busy true (150 ms observation) because its incremented long action had no paste completion to decrement it. Browser was isolated and disposed afterward. Evidence: `2026-10-02-ppt-native-readonly-paste-rejection-probe.json`. This changes callback migration design: reject non-editable native states before invoking paste, do not equate lack of callback with an ordinary completed failure.

Production office write readiness now checks native isViewMode/canEdit in addition to application readonly mode. PPT add/slide actions reject native slideshow mode before starting an action or paste. Three tool regressions failed before checks (paste was called and eventually produced unverified-change error), then passed with no native paste/StartAction. Full 104 files / 3,845 tests passed; lint/typecheck and build passed. Native slideshow rejection is unit-covered, not actual slideshow UI proof. Native callback migration, pending-paste cancellation, and auto-layout integration remain incomplete.

### Controlled pending-paste cancellation gate

Real Chromium native API probe wrapped only the pending paste's native pre_Paste insertion callback with an active token, forwarded native font/image preparation with a controlled 200ms delay, then canceled at 50ms. It deactivated insertion, called native Paste_Process_End, canceled its history group and recalculated. The delayed preparation did run once and its insertion callback was skipped once; completion callback did not run. After 350ms more, prior text and history index were still exact, with no late shape insertion. Matched EndAction restored busy false and collaborative lock false. Evidence `2026-10-02-ppt-cancel-preparation-probe.json` passed. Native Paste_Process_End source was captured; it clears paste state/transaction bookkeeping, not font/network download.

This establishes controlled delayed callback suppression before document insertion. It does not prove real outstanding native font/image loading is safely canceled, that future operations can reuse all paste state, or that document replacement/foreign API operations preserve ownership. Product still uses pluginMethod_PasteText and polling, with operation blocking and readonly/slideshow preflight; callback migration and layout are incomplete. No source changes in this turn.

### Recovery after canceled pending paste

Extended the controlled pre_Paste cancellation probe to restore the original API, paste exact bilingual `恢复写入 / Resumed paste`, then native Undo/Redo. The new completion fired exactly once; Undo preserved the prior edit and history index, Redo restored exact resumed snapshot, special paste start false, final busy/lock false. Evidence `2026-10-02-ppt-cancel-preparation-recovery-probe.json` passed.

A separate probe forced the SDK native font-preparation branch (`CheckFontsNeedLoading` true) with controlled 200ms LoadDocumentFonts2 completion through the native asyncFontsDocumentEndLoaded handler, including a matched LoadFont start event. Actual pre_Paste font/image state and busy counters were exercised; cancellation gate skipped the late insert, history rollback retained prior edit, subsequent bilingual paste and Undo/Redo passed. Final isPasteFonts_Images false, pasteCallback null, pasteStart false, busy/lock false. Evidence `2026-10-02-ppt-cancel-native-font-preparation-probe.json` passed. This is a controlled native font branch, not real font downloading/aborted network. Instrumented loader/checker/pre_Paste were restored in finally. Product callback migration/auto-layout remain incomplete; document replacement and ownership of foreign paste state still need coverage. No product code changed.

### Native paste completion/cancellation helper implementation

Added `lib/agent-plugin/native-paste.ts` with `pasteSlideText`, using native asc_PasteData completion and a per-operation pre_Paste insertion gate. The original preparation method is restored immediately after invocation; the deferred gate retains only that operation's active token. Timeout deactivates insertion before rejecting and ends owned pending paste state only when target ownership still holds. A changed target blocks insertion and does not clean foreign paste state. Native refusal before preparation rejects immediately. History/blocking scope remains the caller's responsibility. Four unit tests cover deferred completion/restoration, timeout and no late write, ownership change/no foreign cleanup, and immediate refusal. Full suite: 105 files / 3,849 tests passed; final lint/typecheck passed after removing an unused scratch probe variable.

Exact exported helper was serialized into a real Chromium native SDK probe with controlled 200ms preparation delay and 50ms timeout. After caller history rollback, no delayed text appeared; prior history/text retained; new exact bilingual paste, Undo/Redo and state restoration passed. Report `2026-10-02-ppt-native-paste-helper-cancellation-probe.json`. This is native helper validation, not product IM migration. API exceptions during asynchronous preparation and throwing ownership callbacks need additional robustness; actual network font download and new document/foreign paste ownership remain unverified. Product auto-layout integration and use of this helper still incomplete.

### Throwing ownership lookups during native paste

`pasteSlideText` now treats exceptions reading target ownership as expired ownership, both before invocation and inside deferred insertion/completion/timeout handling. This prevents synchronous throws or escaped deferred callbacks when a frame/state lookup becomes inaccessible, rejects the operation and suppresses insertion, and avoids cleaning unproven/foreign paste state. Two regressions reproduced raw `Frame removed` throws before the fix and passed afterward, covering initial lookup and deferred callback lookup. Full suite 105 files / 3,851 tests passed; lint/typecheck passed.

These are controlled unit lookup failures, not actual browser frame replacement proof. The helper remains unintegrated into IM and cannot catch arbitrary SDK exceptions inside unrelated async font-loader code; native timeout handling and operation history ownership remain caller integration requirements.

### Native completion integrated into IM PPT text writes

`add_slide_text` now requires the native asc_PasteData/pre_Paste capabilities and target-frame clipboard format/helper, invokes `pasteSlideText` inside its blocking action, awaits real completion, then retains exact content/preserved-original readback verification. Ownership checks include API, current native helper identity/API, logic document, current page and slide identity. Added typed clipboard/helper fields to editor bridge. Unit regression proved old plugin wrapper invocation before migration and zero plugin calls after; replacement-helper regression reproduced insertion proceeding into foreign state before added identity check, then rejected before insertion. Updated fixtures preserve earlier text/readonly/whitespace/async behavior tests. Full suite 105 files / 3,853 tests passed; lint/typecheck and final build passed.

Final production `editor-BG65zbPV.js` offline 1.7B IM test observed exactly one native paste and one native completion, zero plugin paste calls, one matched blocking action start/end, busy false. Exact bilingual three-line write 2,318 ms, unchanged readback 1,263 ms, one Undo restored placeholders. No visible/page errors or preview cards; failed uncached network control confirms offline context (navigator online flag remained true). Report `2026-10-02-ppt-native-completion-write-read-undo-ui.json` passed. Previous pre-identity-check native sample was replaced by this final rerun; no speed improvement conclusion from single samples.

Auto-layout/history grouping/no-room rollback remain unintegrated. IM timeout under real native font download and document replacement are not proven; failed paste may leave an empty native history point until transaction cleanup is added. No broad model/device quality completion claim.

### Native history grouping and rollback integrated into PPT tool

`add_slide_text` now requires native history group capabilities, refuses preexisting open groups, opens a native group inside its blocking action, and closes it on success. Failure cancels/recalculates only if the same API/logic document/history object/open marker are still owned. Inaccessible ownership returns false rather than throwing in cleanup. Native insertion and readback also check marker ownership; a regression replaced the marker before insertion and initially reached native paste, then passed by rejecting without paste/cancel after the gate was added. A second regression covers success start/end and paste-failure cancel/recalculation. Full 105 files / 3,855 tests passed; lint/typecheck and final build passed.

Final offline production `editor-BwuWGOOV.js`, cached 1.7B IM bilingual write/read/Undo passed (2,230/1,259 ms). Observed exactly one start/end history group, zero cancel on success, one native paste/completion, zero plugin pastes, blocking action balanced/busy false. Exact text retained, one Undo restored original two placeholders, no page/visible errors or preview cards. Report `2026-10-02-ppt-native-grouped-write-read-undo-ui.json`. Final rerun supersedes the earlier pre-marker-gate sample.

This integrates grouping/rollback infrastructure only. Auto-placement still uses default SDK geometry. Production IM timeout rollback/prior-content preservation and no-room rollback must still be tested. Native direct programmatic edits inserted into the same still-open group without replacing its marker are not independently attributed by this guard; normal UI is blocked and agent write actions refuse busy editors, but foreign API concurrency needs stronger coverage before broad ownership claims.

### Offline IM timeout rollback and recovery verified

Actual offline cached 1.7B IM with an independent preexisting text edit and controlled 11s delay of native pre_Paste triggered the product 10s native paste timeout. Final production `editor-DyoTYoR4.js` restored exact prior text, recalculated bounds, history index, native busy and special paste state. Delayed native preparation really resumed once after cancellation; no late shape appeared. Observed one history group start/cancel and no end on failure. Subsequent explicit IM text insertion succeeded; native Undo restored exact prior snapshot and Redo restored exact recovered snapshot. No page errors or preview cards. Report `2026-10-02-ppt-im-timeout-rollback-recovery-ui.json` passed (12,234ms total including model planning). This is controlled preparation latency, not actual network/font download timeout.

The initial UI sample showed generic request/check-settings guidance on document timeout. Added localized `agentDocumentActionTimeout` in all seven message locales and shared type, with displayError mapping/idempotent restoration. Regression failed generic guidance before fix, then passed. Final real IM sample verified the concise English message `The document operation timed out. Try again.`. Full 105 files / 3,856 tests passed; final lint/typecheck and build passed. Build initially caught the missing shared key type; root lint then needed shared declaration regeneration before it passed. Other six UI locale renderings of this new message were not tested end-to-end. Auto-layout remains unintegrated.

### Measured PPT auto-layout integrated (2026-10-02)

`add_slide_text` now recalculates native bounds, sets a proportional text-box width, measures the actual resulting box, and finds free space within proportional slide margins and gaps. Visible non-placeholder master/layout drawings participate using the SDK's visibility flags and hidden-object test. Existing local shape text/bounds are checked; native selection must contain only the new shape. Paste, width and position remain in one owned native history group. No room causes cancellation rather than overlapping content or placing text outside the slide. Concise no-room feedback covers all seven locales; only English was rendered in the new end-to-end sample. No preview/confirmation step was added.

Production offline cached 1.7B IM exact bilingual three-line insertion/readback and single native Undo/Redo passed, as did no-room rollback with a retained prior edit and a subsequent explicit write. A real SDK master drawing occupying the slide was included and prevented insertion without changing master/local content or history. Reports: `2026-10-02-ppt-auto-layout-write-read-undo-ui.json`, `2026-10-02-ppt-auto-layout-no-room-recovery-ui.json`, `2026-10-02-ppt-auto-layout-inherited-master-ui.json`. Full 107 files / 3,869 tests, lint/typecheck and build passed at that checkpoint.

0.8B passed the plain multiline request fixture but failed the JSON-encoded version by producing literal backslash-n characters. Both records are retained (`2026-10-02-ppt-auto-layout-qwen35-08-plain-ui.json` / `2026-10-02-ppt-auto-layout-qwen35-08-ui.json`). This is not general exact-text or multilingual quality acceptance. The earlier statements that auto-layout was unintegrated are superseded by this integration; model/device and broader goal acceptance remain incomplete.

### Preserve prior native Redo after a failed IM write (2026-10-03)

The offline production baseline reproduced a lost redo branch: after native Undo, a no-room IM write cancelled its document changes but changed `Can_Redo` from true to false and removed the prior point. Record: `2026-10-02-ppt-failed-layout-prior-redo-baseline-ui.json`. The shipped SDK `SaveRedoPoints` / `PopRedoPoints` now preserve that branch around an owned group. Restoration requires the same editor/history, exact backup stack position and saved point references, original cursor and prefix point identities. It also restores saved-point markers, last selection state and current-point additional metadata. A successful new edit releases only its backup and retains normal native redo invalidation.

Group opening can throw before truncation or after creating an empty group point. The intact branch releases its owned backup and restores metadata; an empty point is cancelled only after index, prefix, item-count and native group checks. Tests first reproduced missing cleanup and masked original errors; both paths now retain the original error and leave no backup. Replaced/nested/expired backups reject before native restoration. A controlled deferred-paste timeout regression preserves prior redo and suppresses late insertion.

Production offline cached 1.7B IM verifies failure recovery with a retained edit, an undone second edit and native saved-point markers. Exact content/bounds, prior redo point identities, save markers and backup depth are restored; native Redo recovers the undone edit. A successful new write discards the old redo branch and native Undo/Redo operate only the new write. Controlled exceptions actually reached native `GetSelectionState` before point creation and an empty group after creation; both preserve the same snapshot and allow prior Redo afterward. Reports: `2026-10-03-ppt-failed-layout-saved-prior-redo-ui.json`, `2026-10-03-ppt-successful-write-prior-redo-ui.json`, `2026-10-03-ppt-group-open-failure-prior-redo-ui.json`. A separate visible-header toolbar test confirms Redo remains enabled and a real button click restores the saved undone edit (`2026-10-03-ppt-failed-layout-toolbar-redo-ui.json`). These saved-point markers are not proof of actual file persistence/export. Full 108 files / 3,885 tests, lint/typecheck and production build passed; existing asynchronous-rejection and build dependency/chunk warnings remain.

This fixes the previously recorded prior-redo limitation for these native PPT operations. It does not establish all-model text fidelity, physical mobile/Safari compatibility, arbitrary foreign API concurrency, real font-download timeout behavior, or the complete local-first assistant objective.

### Current CPU writing baseline after native-redo changes

Unmodified production bundle `editor-BB26vwDY.js` at `f1d4e49`, desktop Playwright WebKit CPU Qwen3-0.6B, ran three isolated Word selected-text tasks. Chinese formal rewrite applied after 41,461 ms, preserving date/amount but dropping explicit future modality `会`; its temporal meaning is less explicit, so numerical validation does not establish full fidelity. English formal rewrite was rejected after 40,266 ms with specific numeric/date guidance and unchanged original text. Negation summary returned unchanged source and was rejected after 44,097 ms; the earlier successful summary is not consistently reproduced. All three had zero preview cards and no page errors.

Evidence: `2026-10-03-cpu-current-writing-baseline.json`. Raw provider completions and token timings were not captured; exact English mutation is unknown. No native failure occurred in these three cases. The historical 150-second native error was from an unadopted date-pattern experiment, not the current plain text schema. CPU fidelity and latency remain unresolved; this baseline does not support adopting a new prompt, calling CPU writing reliable, or claiming physical-device/offline validation.

### Same-page CPU writing repeats are already warm

Current unmodified bundle `editor-BB26vwDY.js` ran three identical formal-English writing requests without navigation or model reload. Response times were 40,292 / 5,727 / 5,836 ms. All three failed numeric/date validation, preserving the original document; zero preview cards or page errors. Evidence: `2026-10-03-cpu-same-page-writing-cache.json`.

The warm speedup is consistent with prompt/KV reuse, inferred rather than established by raw backend cache counters or phase timings. Existing package 3.6.1 exposes `cache_prompt` and passes request options through to native completion; current application does not override it. Official API reference: https://github.ngxson.com/wllama/docs/classes/Wllama.html. This result does not justify adding an explicit caching override or claiming faster initial requests. Next useful comparison is task/source changes on the same loaded model: current writing prompt places task-specific text before the common instructions, which may limit shared-prefix reuse across tasks. Any reordering still requires factual-quality evaluation before adoption.

### Common writing prefix reorder: mixed CPU latency, not adopted

Two same-page sequences on desktop Playwright WebKit CPU Qwen3-0.6B compared unmodified `editor-BB26vwDY.js` with temporary candidate `editor-jJAn-gm1.js`. Existing common instructions were moved before task-specific text; no instruction, schema or numeric guard was removed. Candidate runtime diagnostic marker was observed three times with raw output and phase timings.

Baseline rewrite / summary / returning rewrite: 41,266 / 36,898 / 5,768 ms. Candidate: 40,028 / 16,386 / 14,235 ms. First summary switch improved in this sample (candidate prefill 9,328 ms), but returning to a previous rewrite became slower. Do not claim every task switch is faster. Both versions rejected date-changing rewrites without changing original text. Both summaries were shorter and retained sampled amount/date/current non-approval. Candidate still failed formal rewrite quality.

Evidence: `2026-10-03-cpu-task-switch-baseline.json`, `2026-10-03-cpu-common-prefix-candidate.json`. Writing guard tests passed (32) on candidate. One sequence each is not statistical evidence; baseline raw timings, other languages/tasks, GPU models and physical devices remain untested. Candidate is not adopted: original source was restored in `finally`, diagnostics removed, and full production build succeeded. This provides a concrete measured prompt-order alternative for broader evaluation rather than an unverified performance change.

### Stop cancels pending native PPT writes

Real cached offline IM Qwen3-1.7B on desktop Chromium reproduced a product defect: clicking visible Stop after native `pre_Paste` began did not prevent the controlled 4-second delayed insertion. Three-line bilingual text was inserted and native history advanced. Evidence: `2026-10-03-ppt-im-stop-pending-paste-baseline.json` (`editor-BB26vwDY.js`).

The UI now passes the operation AbortSignal through DocumentToolAction and the optional tool execution parameter to native PPT paste. Aborting pending preparation rejects immediately with AbortError, unregisters the listener, ends owned paste state, and suppresses late insertion. Existing owned history cancellation preserves earlier edits/redo and releases the interaction block. No preview or extra confirmation. Signal remains distinct from document/paste ownership so abort does not prevent cleanup of owned state.

Actual production `editor-BrS_hCZ0.js` offline UI retest started with one prior edit and another undone edit. Stop returned to enabled input in 2 ms in this sample. Before/after-stop/after-late text, geometry, history, redo availability/backup depth and busy/paste flags matched exactly; native start/cancel/end counts 1/1/0. Delayed preparation resumed once but inserted nothing. Prior native Redo restored the undone edit; subsequent explicit IM write and native Undo worked without disturbing the earlier edit. Evidence: `2026-10-03-ppt-im-stop-pending-paste-fixed.json`. The controlled delay is not a real font/network timeout, and this does not promise retroactive cancellation of a committed synchronous edit or save/export persistence.

Four regression tests were observed failing before implementation and now pass. Full suite: 108 files / 3,889 tests; lint/type/Docker configuration and full production build passed. Existing two PromiseRejectionHandledWarning messages and Anthropic browser externalization/large-chunk build warnings remain. Independent code review found no critical or important issue; actual-editor proof was then completed. Broad local-first/model/device goal remains incomplete.

### GPU model expansion for Stop and native auto-layout

Current production `editor-BrS_hCZ0.js` was tested with warm-cache offline reload and unreachable uncached network controls for Qwen3.5-2B, Qwen3-4B and Qwen3.5-0.8B. Each model reached native preparation; clicking visible IM Stop suppressed the controlled late insertion, preserved exact text/geometry/history/redo snapshots, released busy/paste flags, preserved working native Redo, and allowed subsequent explicit ASCII IM write and Undo. These join the earlier 1.7B result, covering this narrow cancellation sequence on all four offered GPU models. Reports: `2026-10-03-ppt-im-stop-{qwen35-2,qwen3-4,qwen35-08}-ui.json`. Cancelling bilingual text does not establish its exact argument fidelity.

Normal plain-multiline bilingual writes on the current native completion/geometry/history integration were also tested for 2B and 4B. Both inserted exact three-line text, used valid native bounds without changing original title/subtitle boxes, read without modifying content, and restored exact geometry/history with one native Undo/Redo. 2B write/read 3,544/2,214 ms; 4B 5,029/3,359 ms, single samples. Reports: `2026-10-03-ppt-auto-layout-{qwen35-2,qwen3-4}-ui.json`. Actual 4B write screenshot was inspected: compact IM and text below unchanged placeholders, no preview or extra confirmation. Historical 1.7B/0.8B normal-layout samples remain earlier checkpoint evidence, not fresh current-bundle normal-path reruns.

All new sequences reported no page errors or preview cards. Evidence remains narrow: no physical-device, arbitrary nonempty slide/template/group, model-wide language reliability or actual native save/export claim. No product code changed in this validation checkpoint; previous full suite/lint/build results belong to `13ac17d`.

### First offline native Save and local file-open cache gaps fixed

Actual cached/offline IM Qwen3-1.7B wrote exact bilingual multiline PPT text and read it back, but native Save produced no download. The visible Save button was enabled (`canSave: true`); its export attempted uncached `/sdkjs/common/wasm/x2t/x2t.js` and failed. Keyboard attempts also failed for the same missing runtime, so no keyboard defect is established. Evidence: `2026-10-03-ppt-im-offline-save-baseline.json`.

Service-worker install previously cached only x2t_helper.js. It now also caches x2t.js, x2t.wasm.br and x2t.worker.js in the versioned vendor runtime cache (roughly 7.1 MB compressed/script bytes). Native Save then downloaded a valid PPTX, with exact three-line text and exported geometry matching live native bounds. Evidence: `2026-10-03-ppt-im-offline-export-checkpoint.json`; no previous native Save/manual converter-cache fill preceded that checkpoint.

Reopening exposed another gap: offline homepage shell loaded, but `/open-local.js` was uncached and no file input initialized. Evidence: `2026-10-03-ppt-offline-file-open-baseline.json`. HTML dependency precache now includes the existing known deployment JS/CSS whitelist, remaining same-origin and excluding unsupported private paths. Two behavioral tests were observed failing before their fixes and now pass.

Final production round trip: offline IM write/read, actual visible header Save, downloaded ZIP/OOXML inspection, then homepage file chooser opened saved PPTX offline. Actual failed uncached .txt requests established network controls for both phases. Reopen kept all three lines (names, amount, ISO date, negation), three shapes and exact native bounds (all l/t/r/b deltas zero); screenshot inspected. Evidence: `2026-10-03-ppt-im-save-roundtrip-ui.json`. Browser worker was started on an editor route online before disconnecting for reopen; attempted pre-start network emulation proved unreliable, so physical browser-start offline is not claimed. Final rerun used already warmed cache; first successful offline export belongs to the separate checkpoint.

Full checks: 108 files / 3,891 tests, lint/type/Docker configuration and full production build passed. Independent combined-diff review found no critical/important issue. Existing async rejection and build warnings remain. Ordinary download fallback is proven on one desktop Chromium/Qwen3-1.7B PPT; OS overwrite, Word/Excel save, broad devices/models/fonts remain unverified. No preview or confirmation UI added, and no deployment/push performed.

### Word and Excel offline native Save round trips

Current production `editor-BrS_hCZ0.js` / product commit `79c71f8`, cached/offline desktop Chromium Qwen3-1.7B: actual IM inserted exact `项目付款 / Payment · Alex · 1,250 EUR · 2026-10-08 · NOT approved` into isolated Word. Actual visible native header Save produced a 25,908-byte DOCX. OOXML paragraph content matched exactly; native Undo restored the original blank document. Offline homepage file chooser reopened the downloaded DOCX with exactly the same text.

Excel sample began with prior A1 text `Earlier independent cell` and cursor C3. IM explicitly set B2 to `Alex · 1,250 EUR · 2026-10-08 · NOT approved`; A1 was preserved through write/save/reopen. Native Save produced valid XLSX with B2 as shared-string text, no accidental formula, and exact A1 text; native Undo restored B2's original value. Neighbor state immediately after Undo was not captured, so its preservation at that point is not claimed.

Evidence: `2026-10-03-word-im-native-save-ui.json`, `2026-10-03-xlsx-im-native-save-ui.json`, containing ZIP validation, SHA-256, exact OOXML contents and actual offline reopen snapshots. Uncached .txt network probes failed for both save and reopen phases; worker was activated on an editor route before disconnecting, without visiting homepage online during reopen. No page errors or preview cards. Both reopened screenshots inspected. Native Excel New Cell text direction tooltip appeared over part of the grid; this is an observed first-run UI rough edge rather than file corruption, and should inform further interface cleanup.

No product code changed in this checkpoint; lint/type/Docker configuration passed for the new diagnostic scripts. Prior full suite/build belongs to `79c71f8` (3,891 tests), not a freshly rerun suite. Together with PPT evidence this proves narrow exact-text native-download/reopen flows for all three editor types on one desktop model, not all editing tools, formulas/styles, OS overwrite, physical devices or general local-model writing accuracy.

### Native new-feature tips disabled

Set `editorConfig.customization.features.featuresTips=false` using the native configuration supported by all three vendored editors. This removes new-feature onboarding tips without introducing preview cards or additional confirmation. Official configuration reference: https://api.onlyoffice.com/docs/docs-api/usage-api/config/editor/customization/customization-standard-branding/. Ordinary tooltips and native paste-options controls remain.

Fresh isolated desktop Chromium contexts, without stored dismissals: baseline `editor-BrS_hCZ0.js` reported featuresTips enabled for Word/Excel/PPT, but this fresh baseline did not show a visible balloon. Final `editor-BM_q-DJb.js` reported disabled for all three, no visible feature-tip text or Cell text direction balloon; Excel B2 insertion remained functional and its screenshot was inspected. Evidence: `2026-10-03-editor-feature-tips-baseline-ui.json`, `2026-10-03-editor-feature-tips-disabled-ui.json`. This verifies native configuration and the sampled first-open UI, not every tooltip, device, model or save workflow.

Existing editor unit tests: 74 passed. Full suite: 108 files / 3,891 tests; root lint/type/Docker configuration and full production build passed. Existing async rejection/build warnings remain. Broad model/device validation and interface work remain incomplete.

### Actual IM Excel sorting model comparison

Current product commit `f8bef56` / `editor-BM_q-DJb.js`, warm-cache desktop Chromium Metal GPU. Explicit A1:B4 numeric-key B ascending/descending requests with header row and neighboring sentinel values were checked against native A1:D5 value snapshots. Qwen3-1.7B English and Chinese, Qwen3.5-2B English and Qwen3-4B English passed both directions, retained whole-row correspondence/header/outside sentinels, and exact native API Undo/Redo value round trips. Screenshots of the compact IM flow were inspected; no preview card. Evidence: `2026-10-03-excel-im-sort-qwen3-17-ui.json`, `...qwen3-17-zh-ui.json`, `...qwen35-2-ui.json`, `...qwen3-4-ui.json`.

Important failure: Qwen3.5-0.8B Chinese returned no executable tool for either direction and left values unchanged. Its English ascending request instead produced descending rows, while the UI reported success. The following descending request started from that already-descending state; its Undo/Redo cannot prove recovery from the original wrong ascending mutation. Evidence: `2026-10-03-excel-im-sort-qwen35-08-zh-ui.json`, `...qwen35-08-en-ui.json`. Raw generated parameters were not captured, so wrong model argument is a plausible explanation rather than established fact. Native verification currently checks planned parameters, which does not establish agreement with the original user request. Next work must constrain/verify explicit requested sorting direction before executing; adding UI preview would not resolve this correctness defect.

No product changes in this checkpoint. Root lint/type/Docker configuration passed for the diagnostic script. No new full suite/build claim. Results are narrow warm-cache samples, not offline, broad-language/device/model proof, or formatting/formula/file-persistence checks.

### Sorting direction constrained before native execution

Application-side planner now restricts sort schema boolean `descending` to explicit ascending/descending or 升序/降序 cues and checks returned parameters independently. Opposite-direction plans are rejected before an executable plan is returned, including providers ignoring the schema. Both direction cues or recognized bounded same-sentence negation remove sort from the schema and reject a returned sort. No silent plan rewriting, preview or confirmation UI added. Requests without recognized direction keep existing planning; this is not a general natural-language intent validator. Quoted data, other languages, complex negation and longer same-sentence expressions remain unproven.

13 initial regressions were observed failing before their fixes (opposite parameters, matching schema enums, conflicting cues and simple negation). Independent review identified two additional negations with intervening range/column text; both failed before the correction and now pass. Final planner tests: 32. Final actual production `editor-CLOkS6k0.js`: Qwen3.5-0.8B English ascending/descending both now correct, header/outside values preserved, native Undo/Redo exact. Chinese 0.8B still chooses no executable tool and leaves recorded values unchanged; this ability is not claimed fixed. Qwen3-1.7B Chinese both directions/Undo/Redo remain correct. Evidence: `2026-10-03-excel-im-sort-qwen35-08-en-fixed-ui.json`, `...qwen35-08-zh-fixed-ui.json`, `...qwen3-17-zh-fixed-ui.json`.

Full final suite: 108 files / 3,906 tests; root lint/type/Docker configuration and production build passed. One earlier test run overlapped rebuilding package dist and failed provider-import tests; it is not counted as passing. After build finished, exports were inspected and the full suite passed with stable dist. Existing async rejection/build warnings remain. Independent re-review found no new important issue within stated scope. Broad local-first/model/device goal remains active.

### Chinese 0.8B sorting: raw-response diagnosis and rejected prompt candidates

Starting from `1b86a2d`, isolated actual IM desktop Chromium Metal GPU Qwen3.5-0.8B: temporary planner diagnostics were observed twice per variant and recorded returned text/stop reason. Both Chinese ascending/descending requests returned the valid `unsupported` tool envelope, rather than API execution failure. Empty think sections were present; no hidden reasoning was collected. A1:D5 recorded values stayed unchanged.

Two prompt experiments did not improve these samples: (1) clarifying that header/outside preservation are constraints of a single sort, with multilingual request support; (2) explicitly mapping 排序/升序/降序/表头 to tool/parameter vocabulary plus single-sort constraints. Both still returned unsupported for both directions. Evidence: `2026-10-03-excel-sort-prompt-baseline-ui.json`, `...candidate-ui.json`, `...bilingual-ui.json`. Results rule out these two proposed prompt additions as demonstrated fixes; they do not establish model weights or language understanding alone as root cause.

Neither candidate adopted. Both experiment wrappers restored original planner source in `finally` and rebuilt production; clean source diff verified, final production bundle remains `editor-CLOkS6k0.js`. Root lint/type/Docker configuration passed for updated diagnostics. No new full test-suite claim: prior 3,906 passing tests belong to product `1b86a2d`. Chinese sorting reliability remains missing for 0.8B; existing default 1.7B has stronger sampled English/Chinese tool evidence.

### Actual Word IM formatting and neighboring-content verification

Product `1b86a2d` / production `editor-CLOkS6k0.js`, warm cached desktop Chromium Metal GPU. Isolated plain two-paragraph document, native API selected exactly the first five characters `Alpha`. Qwen3-1.7B English bold and current-paragraph center passed; Chinese bold, center and removal of bold passed. Bold only changed the selected characters; center only changed the first paragraph; text and neighboring paragraph direct formatting stayed unchanged. Exact native API Undo/Redo restored the sampled paragraph/character snapshots. Each character snapshot reconstructs the whole corresponding paragraph text, avoiding empty/incomplete coverage. Cancel-bold sample was prepared with native bold before the IM request, and Undo restored that bold baseline.

Qwen3.5-0.8B Chinese bold passed with exact Undo/Redo, but center and remove-bold returned no executable tool, retaining text/direct formatting. Do not claim broad 0.8B Word formatting support or infer that all Chinese tools fail. Evidence: `2026-10-03-word-im-format-qwen3-17-ui.json`, `...qwen3-17-zh-ui.json`, `...qwen35-08-zh-ui.json`. Actual 0.8B bold and 1.7B centered screenshots inspected; compact IM/no preview flow.

No product code changed. Root lint/type/Docker configuration passed for diagnostics; prior full 3,906-test suite/build belongs to `1b86a2d`, not a new suite run. Plain main-body direct formatting/selection samples do not establish inherited styles, headers/tables, comments/review, saved-file formatting, offline or broad device coverage.

### Word selection replacement SDK defect fixed

Actual Chinese IM Qwen3-1.7B on production `editor-CLOkS6k0.js` returned correct `replace_selection` with exact bilingual name/amount/date/negation text, but the bundled plugin wrapper called missing native `this.ReplaceTextSmart`, causing TypeError. Recorded document text remained unchanged. Temporary diagnostics observed response and caught exception. Evidence: `2026-10-03-word-im-replace-qwen3-17-zh-ui.json`, `...diagnostic-ui.json`.

Replace-selection now uses existing escaped `textToHtml` and native `pluginMethod_PasteHtml`, requires nonempty replacement and nonempty selected text, and retains exact DocumentToolAction readback. Whitespace selection remains valid. Five regression cases were observed failing before the fix; 61 relevant tests passed. Final production `editor-BKStwwIX.js`: actual IM replaced only selected `Alpha` with exact `项目付款 / Payment · Alex · 1,250 EUR · 2026-10-08 · NOT approved`, preserving suffix and neighboring paragraph; native API Undo/Redo restored exact paragraph/character snapshots. Evidence: `2026-10-03-word-im-replace-fixed-ui.json`. No preview or new confirmation.

Additional multiline sample preserved literal `<b>Alex & Co</b>`, newline and leading indentation, but omitted two requested final spaces while reporting success. Raw diagnostic records a shortened input.text; subsequent inspection found the frontend trimmed user input before planning, so this evidence alone does not prove the model removed the original spaces. Native output matches the shortened plan. Evidence: `2026-10-03-word-im-replace-multiline-ui.json`, `...multiline-diagnostic-ui.json`. Exact requested-text fidelity therefore remains incomplete and needs request-to-plan validation; this is separate from the repaired SDK failure.

Full suite 108 files / 3,909 tests, lint/type/Docker configuration and build passed against stable built packages. Temporary diagnostics restored in finally and production rebuilt; final lint passed. Independent reviewer found no new important issue in this change, while identifying existing asynchronous paste/readback limits: slow font preparation, late callbacks and Stop remain untested for Word replacement. Review-mode revisions, complex formatting, save persistence and broad devices/models also remain unproven.

### Preserve original tool request whitespace and correct attribution

Source inspection found two frontend trims: ChatView submission and panel tools submission. Earlier multiline raw-response evidence did not prove the model alone removed final spaces, since the request was already shortened. Corrected those reports and the preceding audit paragraph. ChatView now trims only to test emptiness and passes the original input; tools mode preserves raw text in planner, transcript and operation history. Other panel modes retain their existing normalization. Two regression tests were observed failing before their fixes; 36 related tests passed.

Final production `editor-DY2UAXzT.js` still failed exact multiline replacement fidelity. A subsequent temporary diagnostic captured both the received request (ending in two spaces) and generated replace_selection input.text (ending with no spaces), establishing a remaining model output omission after frontend repair. Native result matched that shortened plan and UI reported success; neighboring paragraph remained unchanged. Evidence: `2026-10-03-word-im-replace-whitespace-fixed-ui.json`, `...whitespace-request-probe-ui.json`. Do not claim end-to-end whitespace fidelity fixed. Next work must check explicit original payload against the proposed text or avoid regenerating supplied literal data.

Full stable-package suite: 108 files / 3,911 tests; production build and root lint/type/Docker configuration passed. Temporary request diagnostics restored and production rebuilt, final lint passed. Independent review found no important issue in transmission changes and correctly distinguished request preservation from model generation fidelity. Broad goal remains incomplete.

### Explicit literal Word replacements preserve supplied payload

Planner now recognizes bounded affirmative English/Chinese commands introducing a terminal literal replacement payload. All characters after the delimiter are data, including leading/final spaces. Recognized Word requests restrict schema choices to replace_selection or unsupported, with text as a single-value enum containing the original payload. Independent post-generation validation rejects a different tool or altered text; no returned parameters are silently rewritten. Nonempty whitespace-only replace_selection text is permitted; other field/tool whitespace validation remains unchanged. This covers defined command forms, not general natural-language intent or all editors.

Seven regressions were observed failing before implementation; opposite text/tool and fact changes, exact schema, language variants and whitespace-only replacement now pass. Three unrelated/quoted/negated-prefix controls preserve existing planning behavior rather than treating those prefixes as literal commands. Full suite: 108 files / 3,921 tests; production build, root lint/type/Docker configuration passed. Independent review found no important issue within stated scope.

Actual final production `editor-PVYdgt1D.js`, desktop Chromium Metal GPU: Qwen3-1.7B and Qwen3.5-0.8B both exactly preserved multiline text including literal HTML-like tags, indentation, two final spaces, amount/date/negation. Selected Alpha replaced, suffix and neighboring paragraph unchanged; native API Undo/Redo restored exact paragraph/character snapshots. 1.7B separately replaced Alpha with two spaces and passed the same checks. Evidence: `2026-10-03-word-im-literal-replacement-fixed-ui.json`, `...qwen35-08-ui.json`, `...spaces-ui.json`. 0.8B written screenshot inspected. This does not fix its previously observed general Chinese sorting/formatting gaps or establish complex-format/file-save/slow-preparation/Stop/device coverage.

### Real CPU availability after controlled GPU initialization failures

Current production `editor-PVYdgt1D.js` on isolated desktop Playwright WebKit, network available and warm CPU profile. Automatic provider remained selected as webllm. Controlled navigator.gpu.requestAdapter rejection was observed once; actual CPU Qwen3-0.6B loaded in 4,348 ms and replied Hello in 11,178 ms, Word text unchanged. Evidence: `2026-10-03-cpu-adapter-fallback-ui.json`.

Second case used a fake nonnull adapter advertising shader-f16 so real application GPU preflight passed, then intercepted exactly one actual webllm Worker script with a controlled startup exception. WebLLM Worker created/closed at 19:12:09.612/09.613 UTC; CPU blob Worker created 09.742, CPU ready 12.064. Actual CPU loaded in 4,165 ms and replied Hello in 11,148 ms, Word unchanged. Only expected injected error was recorded. Evidence: `2026-10-03-cpu-worker-init-fallback-ui.json`. This establishes Worker termination before CPU Worker startup, not physical GPU/VRAM release or OOM. Earlier malformed fake adapter stopped at preflight and did not exercise Worker failure; that harness result was excluded from canonical evidence.

Existing local-provider tests: 10 passed; final root lint/type/Docker configuration passed for diagnostics. No product code changed or new full suite/build run; previous 3,921 tests belong to `87634ac`. Worker screenshot inspected: automatic PWA installation suggestion overlays the IM header in WebKit, a concrete interface simplification issue for follow-up. CPU offline/browser-start offline, physical devices, memory pressure/smaller models and broad language/tool quality remain unproven.

### Editor installation guidance no longer opens automatically

Observed WebKit install promotion obscuring the IM header was reproduced in fresh contexts without stored dismissals. Native installed pwa-install 0.6.4 documentation/source supports manual-apple/manual-chrome. Added both boolean attributes to the editor's existing component builder. No new installation UI or duplicate confirmation.

Baseline `editor-PVYdgt1D.js`: WebKit desktop Apple platform and Chromium with controlled beforeinstallprompt event both reported installable/not hidden, screenshots captured; WebKit positive screenshot inspected. Final `editor-C8H41aL8.js`: both reported manual flags true, installable/hidden at startup; explicit component showDialog then hideDialog worked. Fresh WebKit final screenshot inspected, header/settings unobstructed. Evidence: `2026-10-03-pwa-install-baseline-ui.json`, `...manual-ui.json`. An initial diagnostic route omitted agent=1, so no experimental IM sidebar existed; that harness error was corrected and excluded from canonical evidence.

Service workers blocked and GGUF requests aborted to isolate interface testing without fresh model downloads; the visible AI model-load error is controlled setup, not new model-failure evidence. Browser-menu/OS installation, native Chromium installability and physical mobile are not proven. Full suite 108 files / 3,921 tests, production build and root lint/type/Docker configuration passed. This is a native component configuration change; no implementation-mirroring unit test added.
