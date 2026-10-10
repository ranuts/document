# wllama 与 WebLLM 方案对比及实测记录

## 当前决策（2026-09-27）

**WebLLM 保留为默认浏览器推理后端，wllama 保留为可选 GGUF / CPU 后端。**
这是基于本项目集成成本与现有证据的选择，不是对两个运行时的普遍性能排名。
AI 功能仍为实验功能；运行时可用不代表模型建议可靠。

项目固定 `@mlc-ai/web-llm` 0.2.85 与 `@wllama/wllama` 3.6.1。
下表将官方能力与本项目已实现行为分开；上游主分支新增功能不能自动视为固定版本已经启用。

## 方案对比

| 维度         | WebLLM                                | wllama                                          | 本项目含义                                                 |
| ------------ | ------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| 执行路径     | MLC 编译模型，WebGPU 推理             | llama.cpp 的浏览器 WASM 封装；v3 支持 WebGPU    | 两者都能使用 WebGPU，底层实现不同                          |
| 模型交付     | MLC 权重、配置与对应编译库            | GGUF；项目可加载 URL 或本地文件                 | 默认模型用预编译 MLC，用户自带 GGUF 用 wllama              |
| 无 GPU 场景  | 当前 provider 不提供 CPU 推理         | 可用 CPU；当前 UI 初始选择 CPU                  | CPU 是覆盖更多设备的选择，不保证响应速度可接受             |
| 接口         | OpenAI 风格聊天与流式接口             | 上游 v3 也提供 OpenAI 风格接口                  | 不应因接口风格宣称 WebLLM 有独占优势                       |
| 集成现状     | Dedicated Worker；内置候选；GPU 检查  | WASM 随构建发布；URL/File 加载；compat CDN 关闭 | 均经惰性加载和统一生命周期管理                             |
| 多线程与兼容 | 当前路径需要可用 WebGPU 和 shader-f16 | CPU 多线程需要跨源隔离；当前未隔离时单线程      | 更广兼容性仍须真机验收，不默认开启兼容下载                 |
| 上游扩展     | 自定义 MLC 模型需要匹配权重与编译库   | v3 有多模态、工具调用等能力                     | 当前两个适配器的写作模式均不开放工具；上游功能不等于已集成 |
| 模型质量     | 由模型、量化、模板和提示共同决定      | 同样取决于实际模型与配置                        | 更换运行时不能保证解决语言错误或事实反转                   |

官方依据：[WebLLM README](https://github.com/mlc-ai/web-llm#readme)、
[wllama README](https://github.com/ngxson/wllama#readme)。
当前实现见 [WebLLM provider](../../packages/agent-core/src/llm/webllm.ts)、
[wllama provider](../../packages/agent-core/src/llm/wllama.ts)。

## 性能与体验如何判断

WebGPU 只是共同的计算接口。两套运行时的计算内核、算子融合、量化格式、
内存安排、输入处理及缓存复用不同，即使使用同一 GPU，等待时间也可能不同。
这是解释差异的工程因素；本轮没有逐内核分析，不能确认某一个因素导致了观测差距。

下面已有的短句实测中，wllama GPU 的热请求更快，WebLLM 的重复测试首个请求更快；
CPU 单线程的 wllama 明显更慢。但是测试量化、上下文、模板、推理开关及缓存状态不同，
不能得出“wllama 更快”或“WebLLM 更快”的通用结论。

公平对比需要固定基础模型、尽量匹配量化精度、上下文、任务、输出预算、思考模式与采样参数，
分别记录冷下载、缓存重开、输入处理、首个可见正文及完整生成时间。
再验证停止、重试、GPU 丢失、页面重开和编辑器并行体验。不同量化无法完全一致时，应明确保留差异。

## 可维护性与扩展的取舍

以下为结合当前代码的工程判断，不是上游维护活跃度或长期存续保证。

| 项目方向                                 | 建议                           | 维护成本与限制                                                                      |
| ---------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| 提供少量经过验证的默认写作模型           | WebLLM 主路径                  | 预编译模型减少本项目编译工作；升级须核对 SDK、模型配置、编译库及 Worker 行为        |
| 用户带入 GGUF、与 llama.cpp 模型资产共用 | wllama 可选路径                | 减少对 MLC 模型转换的依赖；仍受运行时支持的模型架构、模板、文件大小与浏览器资源限制 |
| 无 WebGPU 设备                           | wllama CPU 候选                | 必须验证速度与内存；跨源隔离部署不能仅为线程数未经评估地启用                        |
| 增加嵌入、多模态或工具功能               | 先定义应用能力，再分别评测后端 | 需要新增适配、模型验证与权限设计，不靠 SDK 的支持列表直接开放                       |
| 更换或增加后端                           | 继续通过 LocalLLMProvider 隔离 | UI 与任务流程依赖统一接口，SDK 特殊参数留在各自适配器内                             |

当前统一接口见 [LocalLLMProvider](../../packages/agent-core/src/llm/types.ts)，包含显式加载、
流式生成和资源释放。接下来优先完善缓存状态与失败恢复、模型来源和版本记录、
跨设备回归及建议确认流程。没有性能或兼容性证据前，不增加第三套本地运行时。

## 最新模型测试如何影响选择

工具调用另见 [DOCX / XLSX / PPTX 工具能力评估](2026-09-27-editor-tool-calling.md)：
真实编辑工具可执行，但当前本地适配器未开放原生工具路径；固定 WebLLM SDK 拒绝四个 Qwen 的 tools 请求。
wllama 的上游工具支持尚未接入；PPTX 通用全文读取在本轮返回空文本，需专用形状读取。

[模型能力报告](2026-09-27-model-capabilities.md)记录了 WebLLM 下的 348 条真实输出：
Qwen3-1.7B 保留为实验基准；Qwen3.5-0.8B 有语言及日期失败，2B 有语言执行失败；
4B 三次加载受缓存配额阻断，质量未测。所有候选均未通过完整发布验收。

这轮没有在 wllama 下运行对应的 1.7B / 2B / 4B 完整任务组，不能据此评价它们的 GGUF 版本，
也不能据此给两个运行时做模型质量排名。下一轮比较应使用 [共同评测协议](local-writing.md)。
以下保留此前 0.6B 的历史测量及原始记录，避免新旧配置混用。

## 历史集成验证

Validated on 2026-09-27 with Chrome DevTools, Chrome 153 on macOS, 10 reported
logical processors. Tests used non-isolated browser contexts: wllama CPU mode
therefore used one thread. These are individual local measurements, not a
statistical benchmark or a claim about other devices.

The application keeps WebLLM as the default. wllama 3.6.1 is optional and
chat-only, with explicit loading, URL or local GGUF files, and CPU selected
initially. Unchecking CPU requests the runtime's default GPU behavior; it does
not establish GPU availability. Vite bundles WASM and lazily loads the runtime;
no implicit compatibility-CDN download is enabled. No model weights are shipped.

## Real model evidence

| Measurement            | wllama CPU                                 | WebLLM WebGPU |
| ---------------------- | ------------------------------------------ | ------------- |
| Base model             | Qwen3 0.6B                                 | Qwen3 0.6B    |
| Artifact               | Qwen official GGUF Q8_0, 639,446,688 bytes | MLC q4f16_1   |
| Load including network | 56,103 ms                                  | 28,755 ms     |
| First text delta       | 20,378 ms                                  | 2,064 ms      |
| Full response          | 22,609 ms                                  | 2,578 ms      |

Prompt for both: `请把“我们会尽快处理你的请求”改写得更礼貌，只输出一句话。/no_think`.
The provider system prompts also differ: WebLLM appends a soft `/no_think`
instruction, while wllama requests `reasoning: false` at loading.

wllama output: `“我们会尽快处理你的请求，以确保您的问题得到及时解答。”`

WebLLM output contained an empty `<think>` block followed by:
`“我们将尽快处理您的请求。”`

Quantization, execution hardware, and context settings differ. These results
support keeping WebLLM as the default for this device; they do not prove that
wllama's WebGPU backend is slower. No peak-memory or tokens/second comparison
was collected, and multilingual quality beyond these Chinese/English smoke
checks is not established.

WebLLM's first attempt sharing the GGUF test context failed with
`QuotaExceededError` after about 260 MB. A separate isolated context succeeded.
Storage failures must remain visible and recoverable; estimated quota alone
is not a guarantee that a model can be downloaded.

## Lifecycle and UI evidence

- Tiny stories260K GGUF (1,185,376 bytes) loaded through the real provider in
  3722 ms; CPU streaming generated 512 deltas in 1221 ms. This verifies plumbing,
  not usable writing quality.
- Real Qwen stream cancellation after three deltas returned `AbortError` about
  192 ms after Stop; the provider stayed ready. A subsequent English translation
  completed in 3801 ms with `Thanks.`.
- The actual panel loaded a GGUF URL, then loaded a browser File through the file
  input, displayed the loaded state, and generated a visible conversation.
- At 390 × 844 in dark mode, document scroll width remained 390 px and the chat
  background matched the host's dark tokens. The GGUF settings row was 318 px.
- Invalid model URL displayed HTTP 404 and restored the load control; correcting
  the source allowed loading again. Stopping a load restored the controls without
  adding an error message. Changing source clears the previously selected source.
- Runtime resources were disposed after the benchmark; ready state became false.
- Unit tests cover explicit loading, retry, late initialization after disposal,
  streamed text, abort signals, active-stream cancellation and the next request,
  backend visibility, default selection, and draft retention before loading.

## Validation and follow-up

Type checking, 64 test files / 3493 tests, and production build passed. Existing
handled-promise test warnings and SDK externalization / large-chunk build warnings
remain. The production output includes an 8,457.51 kB WASM asset and a separate
lazy runtime JavaScript chunk. MIT notices for wllama and llama.cpp are distributed
under `public/licenses/` and referenced by NOTICE.

Additional seven-language rewrite smoke checks and three successive wllama GPU
measurements are recorded below. Peak memory, Safari/Firefox compatibility assets,
formal multilingual release evaluation, and a richer cache-management screen
remain follow-up work. The optional integration remains
behind the existing experimental AI entry point; it is not a production-readiness
claim. Downloading weights uses the specified model host; inference stays local.

## Additional GPU and multilingual smoke checks

The wllama WebGPU run used bartowski Qwen3-0.6B Q4_K_M GGUF (484,220,320
bytes). Runtime logs confirmed `ggml_webgpu` with Apple / metal-3. Three successive
short Chinese rewrite requests measured first deltas of 1133, 73, and 77 ms;
total times were 1328, 266, and 236 ms. The warm requests reuse runtime/prompt
state; these are not independent cold trials. Q4_K_M and MLC q4f16_1 are different
quantization algorithms, and wllama uses a 2048-token context versus the MLC
registered context. See the raw [wllama GPU record](2026-09-27-wllama-gpu-smoke.json).

Both backends also ran one short rewrite per supported language using the shared
WRITING_SYSTEM_PROMPT and buildWritingMessages. wllama now accepts an explicit
system prompt, matching the existing WebLLM evaluation interface. The browser-side
runner is `bin/evaluate-local-writing.mjs`; initialize the provider with the writing
prompt before calling it. Complete inputs, outputs, and timings are in the GPU
record above and the [WebLLM record](2026-09-27-webllm-writing-smoke.json).

Observed failures include:

- WebLLM: JSON / thinking markup instead of plain text; Japanese changed to English;
  exact numeric/date formatting changed in some samples.
- wllama GPU: Chinese changed to English; the German response omitted the report
  deadline; Korean changed prose into labels.
- wllama CPU: a Chinese example became a Markdown list; a Japanese example became
  English. That CPU sequence reached six completed cases before the browser page
  handles disappeared, and its complete outputs were not exported. It is not
  counted as a completed seven-language evaluation.

Literal checks only check the presence of 1,250 / EUR / 2026-10-08 / Alex. They do
not score semantics, language fidelity, or quality. No native-speaker quality score
is claimed. These 0.6B artifacts therefore do not qualify for promotion as a writing
model, regardless of inference speed. The existing provisional 1.7B default remains
unchanged, and its full release evaluation remains separate.

Configuration caveat discovered in the subsequent candidate evaluation:
WebLLM 0.2.85 supports `extra_body: { enable_thinking: false }` for these Qwen
writing requests. The earlier 0.6B smoke run used only the soft `/no_think` prompt.
Its reasoning/format failures therefore cannot establish that 0.6B is intrinsically
unusable, or support a runtime ranking under matched non-thinking settings.
The original measurements above remain historical observations.

The [WebLLM repeat record](2026-09-27-webllm-repeat.json) used the same short
Chinese benchmark prompt in three successive calls: first deltas 560, 297,
and 294 ms; total times 749, 451, and 445 ms. In this limited experiment wllama
GPU had faster warm requests, while WebLLM had a faster first request in its
repeat session. Neither result establishes a general engine ranking. Sampling,
quantization, context, template, shader caches, and prompt reuse differ; precise
peak GPU memory was not measurable through the available browser APIs.
