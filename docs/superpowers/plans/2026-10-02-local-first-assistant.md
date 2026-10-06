# 本地助手优化实施计划

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话逐项实施。用户已授权自主优化，保持当前指定 AI 分支；不为常规可逆实现增加确认流程。

**Goal:** 浏览器本地推理与可靠 CPU 降级、隐私历史管理及可核验离线体验。

**Architecture:** 用独立本地引擎调度器复用现有两个 provider，产品 UI 只暴露本地推理。历史与模型缓存分别管理。

**Tech Stack:** TypeScript、WebLLM 0.2.85、wllama 3.6.1、Worker、IndexedDB、ranui、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-02-local-first-assistant-design.md`

## Global Constraints

- 浏览器内完成文本推理；对话和文档内容不发送至服务器。
- 未加载不隐式下载；取消不能触发降级。
- 小模型只作为可用性兜底，不声称七语言质量达标。
- 保持当前指定 AI 分支，未授权发布或合并。

## Review Focus

- GPU 属性存在但 requestAdapter 返回 null：选择 CPU。
- 初始化中的取消或页面关闭：不得继续下载下一模型。
- 部分流式输出后失败：不得自动重放。
- 原有保存记录：不得因默认隐私模式静默删除。
- Worker 或 GPU 丢失：就绪状态必须失效，允许明确重试。

## Task 1 — 本地引擎调度

Files: 新增 `packages/agent-core/src/llm/local.ts`、`test/unit/local-provider.test.ts`。
Interface: `LocalInferenceProvider implements LocalLLMProvider`，`backend` 表示实际引擎；构造选项接收 GPU 探测器与候选 provider 工厂，生产默认实例使用真实引擎。

- [x] 写测试：无 GPU、探测失败、GPU 初始化失败后 CPU、并发 preload、取消后不降级、CPU 失败后重试、流式失败不重放。
- [x] `pnpm exec vitest run test/unit/local-provider.test.ts` 确认缺失行为失败。
- [x] 实现单飞加载与释放，用 `requestAdapter()` 探测；每个失败候选先释放，错误汇总；保持工具为空。
- [x] 运行定向测试、全量测试与 `pnpm lint:ts`。

## Task 2 — 产品集成与资源来源

Files: `lib/agent-plugin/ui/panel.ts`、`packages/agent-core/src/llm/index.ts`、模型来源模块及 panel 测试。

- [ ] 固定 CPU 模型 revision，记录来源、大小与许可；添加 GPU 无 adapter 时的实际面板测试。
- [ ] 本地默认使用调度器，删除产品云端入口；保留独立手动 GGUF 导入。
- [ ] 显示当前引擎与加载阶段，取消/重试复用资源生命周期。
- [ ] 验证 UI、类型与生产构建，真实浏览器测试 GPU/CPU 路径。

## Task 3 — 历史、导出和参数

Files: `ui/sessions.ts`、`ui/storage.ts`、独立 IndexedDB 存储模块、设置 UI 与七语言文案。

- [ ] 写默认不持久化、开启保存、失败恢复、单/全部删除和导出测试。
- [ ] 实现内存默认与显式 IndexedDB 保存，保留旧记录可迁移入口。
- [ ] 导出浏览器本地 JSON，模型参数范围验证后传入两个引擎。
- [ ] 验证不产生含对话内容的网络请求，存储错误不丢失当前会话。

## Task 4 — 运行与质量验收

- [ ] 核查 PWA、CSP、缓存依赖，验证断网重新打开并生成回复。
- [ ] 按现有七语言矩阵运行真实 GPU/CPU 推理，保存逐条结果、耗时及失败原因。
- [ ] 验证流式停止、失败重试、GPU/Worker 故障、亮暗/窄屏/键盘、预览确认及撤销。
- [ ] 执行全量测试、类型检查、格式检查与生产构建；记录设备覆盖缺口。
- [ ] 对照设计逐项审查，只在全部必要证据齐全时标记目标完成。

## Ledger

- 2026-10-02：读取用户附件与当前工作区，发现没有自动 CPU 降级、默认 localStorage 保存和产品云端入口三个差距。已有多语言评测发现事实与语言错误，保留实验定位。开始全量基线测试。
- Task 1：10 项调度测试完成；实际观察新增模块缺失、AbortError 误降级和未经确认工具调用三个 RED 结果，再实现 GREEN。基线 3,657，全量最新 85 文件 / 3,667 项通过，`pnpm lint:ts` 与 `pnpm build` 退出 0。基线即有两个 PromiseRejectionHandledWarning；生产构建有依赖 externalization 和大 chunk 提示。
- Task 2 进度：自动调度接入面板；产品远程 provider 分支和凭据控件已删除；七语言提示调整。真实编辑器 DOM 两个本地选项、远程控件 0、页面错误 0。强制 CPU 实际下载约 484 MB，初始化 63.8 s，首片段 22.65 s，返回“你好！”。原始记录见 `docs/evaluations/2026-10-02-local-runtime.json`。GPU/CPU 全面 UI 生命周期测试与自托管许可分发仍待完成。
- Ruling：保留 Qwen3-1.7B GPU 基线并使用 Qwen3-0.6B GGUF 作为 CPU 可用性兜底 — 现有多语言实测优先于附件中的泛用 Llama 建议 — 不声称小模型质量达标，正式默认选择仍需矩阵验收。
- Ruling：当前分支继续原地实施、自主推进 — 用户明确先切换至此 AI 分支且授权无额外限制的优化 — 不推送、不发布；保持全部改动可审查。
- 完整目标仍未完成，下一项为默认内存会话与显式 IndexedDB 保存、导出及删除；离线、CSP、参数和跨设备质量验收保留在本计划，不能缩减为本轮已通过的调度测试。
- Task 3 进度：默认内存、显式 IndexedDB 保存与旧记录导入、跨标签 CAS 冲突保护、单/全部删除和本地 JSON 导出已接入；新增系统指令及生成参数范围验证，GPU/CPU 无需重载即可应用。迁移额外配置泄漏回归先 RED 后 GREEN；导入和磁盘记录只保留会话元数据。真实浏览器保存/刷新恢复/导出/删除通过，合成内容没有出现在请求中。全量 89 文件 / 3,699 项、类型检查和构建通过。损坏数据库的清理恢复、窄屏 AI 入口、持续引擎状态/速度、离线/CSP/七语言和跨设备证据仍待补，完整目标保持未完成。
- 历史恢复补充：真实浏览器在已保存 IndexedDB 记录中注入损坏 sessions 后，确认“删除全部历史”成功；刷新无残留会话、旧 localStorage 记录已清理、页面错误为空。证据 `docs/evaluations/2026-10-02-history-recovery-ui.json`。清理读取和写入同一事务，不依赖消息反序列化，并保留递增 revision tombstone 防止 stale tab 复活。新增损坏清理测试先 RED 后 GREEN；删除提交失败保留内存和旧记录以便导出。相关 3 文件 / 23 项测试与类型检查通过；不因此声明离线、窄屏入口或多语言验收完成。
- 紧凑入口修复：定位到 editor chrome 的 media query 隐藏整个 rightMenu；AI 原生按钮沿用同一 DOM，在相同断点下转入 leftMenu，变宽后回到 rightMenu，不新增悬浮入口。回归先 RED 后 GREEN，14 项入口/加载测试和类型检查通过。隔离 Chromium 实际 390 px 初次打开、宽窄切换、单入口、键盘 Enter、窄屏刷新打开验证通过，原始证据 `docs/evaluations/2026-10-02-compact-entry-ui.json`；这是 UI 验证，不代表真实移动设备推理通过。
- 紧凑入口追加证据：模拟 coarse pointer 的 844×390 横屏亦实际点击左侧入口成功，页面错误为空；生产构建退出 0，既存 externalization / 大 chunk 告警仍在。
- 统计数据路径进度：核查已安装 WebLLM 0.2.85 的 CompletionUsage / stream_options 类型与 wllama 3.6.1 的 usage 类型。发现 accumulator 在 choices 为空时丢弃最终 usage-only chunk；新增回归先 RED，修复后 37 项格式转换/WebLLM 测试通过，包编译和类型检查通过。WebLLM 请求 include_usage；中性响应只保留合法后端 token 数、decode tokens/s 和首 token 耗时，缺失统计不估算。UI 显示和真实推理统计验收仍待实现，不能将单测视为速度功能完成。
- 统计数据路径全量回归：89 文件 / 3,705 项通过；两个既存 PromiseRejectionHandledWarning 仍在。完整要求仍未完成，下一步接入界面与真实 GPU/CPU 统计，不以片段计数替代 token。
- 实际模型状态进度：面板原先 finally 无条件清空状态，现保留实际 backend 与模型名；自动 CPU fallback 使用 CPU 模型身份，手动 GGUF 区分 CPU 强制和 wllama 模式，不将所有 wllama 声称为 CPU。状态独立一行且可换行，避免长模型名挤占标题；语言切换保留、释放资源清空。回归先 RED 后 GREEN，22 项面板/加载测试、类型检查和生产构建通过；真实 ready 状态与速度显示尚待后续运行验证。已有构建告警未解决。
- 模型状态全量回归：89 文件 / 3,706 项通过；既存 PromiseRejectionHandledWarning 仍在。速度显示、真实 GPU/CPU UI、离线/CSP 和质量矩阵仍是必要工作。
- 生成统计 UI 接入：runAgent 发独立 usage 事件，控制器传入面板，统计不进入历史消息和导出。七语言生成速度/首 token 标签；仅显示后端真实存在的 decode token/s、首 token 耗时及 completion token 数，无统计时不填估算值。新请求、Stop、切换会话和释放运行时清空；代际检查丢弃旧会话统计。控制器统计转发先 RED 后 GREEN，面板显示/清空通过。全量 89 文件 / 3,708 项、类型检查及构建通过；随后新增 Stop 后迟到统计专项回归。真实 GPU/CPU 统计验证、CPU 缺失 decode 统计的处理与断网验收仍待完成，不声称速度要求已完全验收。
- 真实 CPU 面板验收：隔离持久 Chromium 强制无 GPU，实际默认 Qwen3-0.6B GGUF 下载及聊天。首次加载 63,447 ms，首次可见回复 23,923 ms，总 23,924 ms，文本 hello，实际引擎/模型状态正确、页面错误 0、无含测试对话内容的请求；统计为空，证据 `2026-10-02-real-cpu-ui-before-usage.json`。定位 CPU 请求遗漏 stream_options.include_usage，回归先 RED 后 GREEN；添加后再运行同一隔离 profile，加载 3,813 ms，首可见回复 24,428 ms、总 24,431 ms，真实显示 3 tokens；证据 `2026-10-02-real-cpu-ui.json`。5 项 wllama 测试、包编译和类型检查通过。缓存复用明显，但这不是断网刷新证明；CPU 尚未返回解码速度，需明确标注的实测指标，不能把整体响应速率称为 decode token/s。CSP 响应头缺失，后续需实现及真实安全/离线验收。WASM 实际已同源打包，不使用 SDK 的 CDN 示例配置。
- CPU 实测计时实现：计时从串行队列内开始执行时起算，不含等待队列和模型加载；timeToFirstTextMs 为第一个非空文字片段，与 SDK TTFT 字段分开。responseDurationMs 覆盖整个调用，整体响应 token/s 使用后端实际 completion token 数除以此耗时，明确包含预填充，绝不标记成 decode token/s；缺少计数不显示速率。七语言首段文字/整体速率标签已接入。计时回归先 RED 后 GREEN，89 文件 / 3,710 项、包编译、类型检查和构建通过；既存告警仍在。真实 CPU 产品复测进行中，保持离线、CSP、GPU 与设备/语言矩阵未完成。
- CPU 计时真实证据：首次产品复测 120 s 未出现 assistant 气泡，保留 `2026-10-02-real-cpu-timing-ui-first-attempt.json`，不声明通过、不确定原因；当时有构建/测试并行。随后同一隔离 profile 单独复测完成，加载 3,463 ms、首可见气泡 23,906 ms，界面实测 First text 23.83 s、Overall response rate 0.08 token/s、2 tokens，页面错误/含对话请求均为空，证据 `2026-10-02-real-cpu-timing-ui.json`；没有将整体速率冒充解码速度。面板计时文案专项 12 项通过。成功复测不抹去首次超时，加载/推理稳定性、CPU 预填充长等待、真实 GPU、离线/CSP 与多语言仍需后续验收。
- 离线验收发现真实缺口：生产 preview 隔离 profile 下载默认 CPU 模型后断网刷新。Service Worker 已控制页面，模型暖加载成功，但离线 AI 入口无法启动。先修复带 query 的编辑器地址无法使用预缓存无参数 shell：实际 shipped SW VM 回归先 RED 后 GREEN；仅编辑器 navigate 从当前 build CORE_CACHE 取 editor.html，其他路径和 file/src 不放宽。45 项 SW 相关测试、类型检查及构建通过，追加四个路径限定回归通过。真实重跑证据 `2026-10-02-offline-cpu-ui.json` 仍 failed：editor 主 JS、modulepreload、CSS、ran-fonts/fonts.css 和 fingerprinted ran-tokens 未命中缓存，说明初次控制前的启动依赖没有缓存。下一步实现 app boot dependency precache，再复测断网完整推理；绝不能以模型缓存或此 shell 修复标记离线完成。首轮脚本还存在导航期间错误采证失败，已加固并重跑，采用第二轮终态作为有效证据。
- 离线启动依赖进度：安装时读取当前缓存的 index/editor HTML，提取同源 assets/、fingerprinted token CSS、字体 CSS、ranui 引用并去重 precache，不下载模型。真实运行仍失败，检查实际缓存证实启动 JS/CSS 已在 CORE_CACHE，preview 响应 Vary: Origin 让 module crossorigin 请求不匹配；限定同源公共 assets/ 忽略 Vary 后再次复测，boot JS/CSS 已能启动，剩余明确失败为 agent-plugin/input/recovery 动态模块以及 Geist woff2。最新原始 `2026-10-02-offline-cpu-ui.json`，之前两轮失败保留 before-boot-precache / before-vary-fix JSON。新增 shipped SW VM 回归先 RED 后 GREEN；旧更新策略测试模拟补充真实 HTML/location，缓存写入源码检查限定 `.then` 写入分支而非只读查询。97 项相关测试、类型检查和构建通过；完整离线仍失败，下一步覆盖首次控制前的动态依赖和字体，不能缩减为 HTML shell 可恢复。
- 离线 boot cache 全量回归：91 文件 / 3,716 项通过，既存 PromiseRejectionHandledWarning 未解决。真实断网仍 failed，完整目标保持活动。
- 离线运行时清单：新增 build stamp 工具从产物中选择 JS/CSS/WASM 与 ran-fonts woff2，排除 GGUF/bin、文档和 source maps；stamp 只写 dist/sw.js，源文件保持 marker。实际 94 资源 / 21,736,858 bytes（20.73 MiB，未压缩），含 8 MB CPU WASM，不含 484 MB 模型；记录首次安装成本，后续性能验收保留。UI 字体允许走 SW，并限定公共同源字体忽略 preview Vary；其他字体继续原过滤。编辑器 API 与三种静态入口 HTML 预缓存到 vendor-version runtime cache；仅已知三条入口忽略 query 配置参数，其他 vendor 资源不放宽。真实逐轮离线缺口由 app 动态模块/字体 -> api.js -> iframe HTML -> require.js/app.css 缩小，原始最新 `2026-10-02-offline-cpu-ui.json` 仍 failed；已能进 vendor 启动阶段但不代表编辑器可用或模型离线推理通过。测试现在等待 editor isDocumentLoadComplete/isLoadFullApi 后才断网；首次控制前加载的 vendor 依赖仍需补齐。相关测试、类型检查和构建通过；失败快照 before-runtime-precache / before-editor-api-precache 保留。
- 运行时清单全量回归：92 文件 / 3,723 项通过，既存 PromiseRejectionHandledWarning 仍在；类型/构建已通过。离线实际记录仍 failed，继续 vendor 依赖修复及完整目标的 CSP、GPU/语言/设备验收。
- Vendor 启动依赖进度：将 HTML 标签依赖解析扩展到三个 vendor 入口，缓存 RequireJS 与 app.css；先剥离 inline script 内容，避免旧 IE document.write 里的已移除 sdkjs/vendor/string.js 被误下载为 404。新增实际 SW VM 回归先 RED 后 GREEN。实际断网失败随后定位到 AMD app.js，加入入口声明的 app/code 模块；58 项相关测试、类型检查与构建通过。最新 `2026-10-02-offline-cpu-ui.json` 确认刷新前后 controllerURL 均 sw.js，排除本轮空 vendor worker 接管；隔离 profile 恢复的旧标签页已关闭以减少干扰。RequireJS/CSS/app 已恢复，剩余明确缺口为 allfonts、xregexp、socketio、x2t_helper 和 locale/en.json。尚未进入离线推理，完整目标保持未完成，后续应补齐 AMD 外部依赖/语言文件并继续真实断网与冷启动验证。before-vendor-boot / before-amd 失败快照保留。
- Vendor boot 全量回归：92 文件 / 3,724 项通过；既存 PromiseRejectionHandledWarning 仍在。离线真实状态仍 failed，未标记完成。
- 离线首轮完整链路：补齐字体目录、AMD 外部依赖、转换 helper 和七语言 locale；首次编辑器 API 加载等待应用 worker 接管（最多 15 秒，非产品嵌入路径不等待），确保大型 SDK 由运行时缓存观察。真实离线刷新与 CPU 回复通过；随后全关页、新进程从启动即断网却导航失败。缓存仍在，实际根 controller 是 vendor 空 document_editor_service_worker.js；不是缓存缺失。三个 vendor HTML 的根注册已移除，保留修改说明和原始许可归属。控制权和三个入口回归先 RED 后 GREEN；类型、格式和生产构建通过。
- 冷启动实测：更新后再次预热、离线刷新通过（24.43 秒回复），关闭进程再从启动即离线重开亦通过（22.02 秒、3 tokens、Hello.）。两次 controller 都是 /sw.js，编辑器实际渲染、CPU 模型从缓存恢复；页面错误为空。拼写脚本存在 ERR_ABORTED，未声称无请求失败。原始结果及所有失败快照保存在 evaluations；范围仅隔离 Chromium / DOCX / CPU，不推广为三种编辑器、七语言、真实移动端或 GPU 全部通过。完整目标继续保持未完成。
- 冷启动修复最终回归：94 文件 / 3,729 项通过，类型检查退出 0，相关源码格式检查及 diff whitespace 通过。既存两个 PromiseRejectionHandledWarning 保留；此前与真实推理并行的全量测试出现 x2t 计时测试 5 秒超时，单文件 19 项及此次无推理竞争的全量均通过，不能据此消除定时测试稳定性风险。
- CSP 实验：核查 Pages / MDN 原始文档；隔离 Chromium 对生产 shell 实际注入强制 CSP，避免 SW 缓存绕过，限定同源脚本、主题 bootstrap 哈希和 wasm-unsafe-eval；真实 CPU 加载与回复通过，shell violations / pageerrors 为空。证据 csp-shell-probe.json，设计与尚缺验收详见 csp-design.md。vendor iframe 未施加该策略，GPU、Worker 响应策略、嵌入、首次下载重定向和离线策略升级未证明，生产配置尚未启用 CSP。
- CSP 构建接入：模块缺失 RED 后，3 项哈希/插入顺序/拒绝策略重叠回归 GREEN。最终 editor HTML head 自动插入 meta CSP，脚本同源、精确 bootstrap 哈希，禁用事件属性和任意 JS eval，允许 WASM。为保留实际远程文档与自定义 artifact URL 的 fetch，连接权限独立保留 http/https/blob；不把 CSP 冒充网络外传防线。实际构建无 header 注入的 CPU 回复通过，运行违规为空，注入 inline 与 onclick 均未执行并产生预期阻断。三种 vendor iframe 的严格 hash/no-eval 策略实测均启动失败，有明确 unsafe-eval 异常；vendor 模板动态编译仍需改造，未启用 iframe 策略。相关 17 项、类型、格式和生产构建通过；完整安全、GPU、离线与设备验收仍未完成。
- CSP 构建接入全量回归：95 文件 / 3,732 项通过；既存 PromiseRejectionHandledWarning 仍在。
- CSP 离线追加验收：实际构建再次预热后离线刷新通过（24.05 秒），全关页从启动即离线的新进程通过（22.06 秒）。cold JSON 记录缓存 HTML 的实际 meta policy，确认并非旧无策略 shell；/sw.js 仍保持控制，页面错误为空，拼写脚本中止仍记录。刷新回答 Only hello. 表明不能认定严格指令遵循通过。默认无头 Chromium 无 adapter；显式 Metal/unsafe-WebGPU 配置实际返回 apple/metal-3，开始真实 GPU 模型加载，未提前认定 GPU 通过。
- CSP GPU 直接验收：新隔离持久 profile、显式 --enable-unsafe-webgpu / --use-angle=metal，实际 adapter apple/metal-3、实际引擎 WebGPU Qwen3-1.7B。首次模型下载后真实回复 Hello.，功能违规与页面错误为空，inline/onclick 注入均阻断。证据 csp-gpu-shell.json。该配置不是默认无头兼容性，GPU 离线、设备丢失、停止、七语言与 Worker 响应策略仍未验收；不将一条回复冒充全面质量通过。
- GPU 离线及停止发现：真实 GPU 离线刷新与全关页断网冷启动均约 1.3 秒回复、保持 WebGPU。进一步停止长文的 UI 响应 33–43 ms，文本稳定，但后续请求重复 60 秒无回复且输入锁定。原始两个失败快照保留。读取已安装 WebLLM 0.2.85 源码确认 remote generator 在尾部释放模型锁，主线程提前 break 只关闭本地迭代器，未推进 worker tail。新增锁释放回归 RED（Worker model lock still held）；仅 WebLLM 启用取消后静默消费尾部，其他 provider 保持原有取消行为。相关 38 项 GREEN，生产构建通过。
- GPU 停止修复直接验收：新构建 core-1790920954 预热后，全程离线的新浏览器进程实际 Qwen3-1.7B / apple metal-3，停止 33 ms、文本 1 秒稳定、后续 Hello. 正常返回，页面错误为空。证据 offline-gpu-stop-ui.json；重建后的离线刷新亦通过。设备丢失、CPU 停止、多语言、跨设备和 vendor/Worker CSP 仍未验收。第一次 lint 被两个 scratch 实验脚本的未使用 import 拦截，已清理，最终回归另行记录。
- GPU 停止修复最终回归：95 文件 / 3,733 项、lint/类型检查与 diff whitespace 均通过；相关修改源码已格式化。既存两个 PromiseRejectionHandledWarning 保留。完整目标仍未达到。
- CPU 取消实测发现独立差距：最新构建预热/离线刷新回复通过。全断网新进程 CPU 请求开始 500 ms 后停止、尚无任何文字；输入仍等待 23,282 ms，之后下一次请求 7,320 ms 返回 Hello.，页面错误为空。脚本 passed 只证明恢复，不证明响应性。读取安装版 wllama getResponse 确认 abort 仅在当前 get_result action 返回后检查；wllamaExit 则直接 terminate worker。下一步需取消 race、即时终止和明确缓存恢复状态，并验证永不返回的 prefill、dispose/recovery 竞争及实际离线性能；不能只改 UI 假装计算停止。证据 offline-cpu-cancel-ui.json，详细审计 cpu-cancellation-audit.md。
- CPU 取消修复：永不返回 prefill 回归先超时 RED，取消 race / terminate 后 GREEN；取消引擎立即失效、清理完成才能重新 preload，生命周期 dispose 与取消只释放一次。新增面板恢复和取消文案回归分别 RED 后 GREEN；真实停止不重放请求，恢复用既有加载器。初次 cleanup await 改变 factory 调度导致既有 late-dispose 回归失败，已修正初次加载无额外 await。相关 42 项通过、类型/格式和构建通过。
- CPU 取消最终直接验收：core-1790921811、全断网新进程，尚无输出时停止 25 ms，缓存恢复 1,693 ms，界面 Preparing AI… · CPU / Stopped，随后实际 Hello! 回复 22,878 ms，页面错误为空。23,282 ms 原始测量单独保留。预填充仍慢、串流中停止/重复恢复/失败恢复/设备覆盖未全部验收，完整目标未完成。
- CPU 取消最终全量回归：95 文件 / 3,737 项通过，lint/类型、相关格式、diff whitespace 和生产构建通过；既存两个 PromiseRejectionHandledWarning 保留。
- CPU 连续恢复追加验收：同一全断网冷启动会话连续取消两次 prefill，停止 17 / 22 ms、恢复 1,736 / 1,452 ms，最后 Hello. 正常回复，页面错误为空。证据 offline-cpu-repeat-cancel-ui.json。只覆盖两次，不能宣称长期无泄漏。兼容性调查发现当前 setCompat(null) 禁用 Safari 所需兼容构建；核查上游 compat README 和安装版 needCompat / setCompat，默认构建依赖 JSPI / MEMORY64。npm 精确 3.6.1 compat 包存在、解包 15,544,261 bytes，有 registry integrity；下一步需自托管资产与缺少能力的实际浏览器验收，不启用默认 jsDelivr 回退。
- 兼容性结论限定：实际 Playwright WebKit 26.5 探测 JSPI 和 MEMORY64 均 true（webkit-capabilities.json），因此上条“Safari 所需”仅适用于缺少对应能力的版本，不能按 Safari 名称一概判断失败。此为能力探测而非模型加载，也非 iOS 真机；优先按特性检测后实测默认构建，兼容资产只用于实际缺少能力的浏览器。
- WebKit 真实产品模型失败：fresh context 的 AI 入口正常，模型在 336 ms 失败、无页面错误；直接源码 provider 得到 UnknownError。独立 navigator.storage.getDirectory 操作产生同样异常，Cache API 小文件写读删通过。SDK 默认 OPFS/COS 后端只检查方法存在，不验证可用性。详细证据 webkit-cpu-model / cpu-load-diagnostic / storage-diagnostic JSON。已启动真实 Cache API 后端模型实验，exec session 72455 / node PID 91155 经工具确认仍活跃，观察等待未结束不是失败或停机证据；尚未报告加载或推理通过。下次应继续同一 live handle，不能仅因输出少重启。
- WebKit 原无阶段实验经重新确认仍活跃；自身调试器无法接入（端口占用、未连接其他进程），因缺少诊断信息且无界而主动终止并确认自身浏览器退出，不把主动终止视为模型失败。新 staged 实验有网络/缓存日志及 180 秒界限。实际模型与 metadata 写缓存完成（484,220,320 bytes），随后捕获 native CompileError Memory64 is not enabled，load 未在诊断界限内结束，无回复；不是 OPFS 问题的全部解决。
- 实际模块能力对照：Chromium / WebKit 的 Memory 构造均成功且 JSPI true，但相同最小 memory64 模块 validate 分别 true / false。SDK 的构造探测是假阳性；需按真实编译能力选择兼容资源。已安装 matching compat 3.6.1，尚未产品接入，不能声称 Safari 支持。下一步包括同源 Cache API fallback、正确兼容选择及 Worker 初始化异常传播，保留 CSP/离线/模型真实验收。
- SDK 能力选择修复：pnpm 固定补丁将 wllama 3.6.1 ESM/CJS 构造探测改为最小 memory64 模块 validate；直接运行安装源码的两项回归先 RED 后 GREEN，覆盖构造假阳性、真实支持和验证异常。真实隔离浏览器资源选择确认 Chromium native / WebKit compat，但未编译资产或加载模型。首次 dev 探测读到 Vite 旧模块，比较返回源码并以 cache-busted URL 复测，保留前后 JSON。全量 96 文件 / 3,739 项、lint/类型与生产构建通过；lint 首次误扫临时上游 checkout，移出仓库后通过。matching compat 依赖精确锁定，产品仍 setCompat(null)，缓存兜底、兼容资产接入与 WebKit 实际回复尚未完成；不缩减完整目标。
- WebKit compat 实际模型实验：cache-busted patched SDK + 本地兼容 WASM/raw Worker + 既有实验 Cache API 后端。模型和 metadata 完整写入，Worker 进入缓存模型读取，但 load 未在 180 秒诊断界限内返回，未进行推理、无回复。日志只有不明确的 Event，没有可解释错误；不把原 native 编译错误未出现当成兼容成功。报告 webkit-compat-model-probe.json 已保存，进程 exit 1 并关闭自身浏览器。下一步补齐 worker/page 错误详情和初始化阶段边界，产品代码未启用未经验证路径，完整目标继续保持未完成。
- WebKit 实际推理突破：独立 Worker/page 监听捕获 Unexpected end of script；前实验误把 Vite JS 响应当原始 worker，末尾无换行 source map 注释吞掉 SDK 拼接闭合代码。按 SDK 包装语法复现 served 失败/raw 成功；改为 ?raw 导入后，同一真实模型加载 64,492 ms，回复 Hello! 😊，16 prompt / 5 completion tokens，错误日志为空。前失败保留 compat-worker-diagnostic.json，成功保留 compat-raw-worker-probe.json。此为实验源码路径推理，不是产品/离线/iOS/质量全部通过；表情仍违反严格输出。下一步接入同源 lazy compat 资产与功能性缓存选择，并补初始化错误传播/取消所有权，完整目标保持未完成。
- 产品缓存兜底接入：实际打开 OPFS cache 目录成功则保留默认 SDK/COS 缓存，方法缺失/操作拒绝才使用专用 Cache API。模型流直接写入 Response；同源编码 key、metadata/list/delete、缺失 size 与写入失败传播。5 项回归先 RED 后 GREEN；初次 Node 测试环境被仓库 window setup 拦截，恢复 jsdom 后确认真实行为 RED。真实 helper 浏览器验证 Chromium default、WebKit Cache API，六字节写读列删成功，证据 cache-storage-browser.json。全量 97 文件 / 3,744 项与 lint/类型通过；不把小文件探测称为产品模型/离线支持，兼容资产与 worker 初始化失败传播仍待接入。
- 产品 compat 接入与真实验收：JSPI/实际 memory64 能力不足才 lazy 导入同源 ?url WASM / ?raw Worker，公开 API 配置 Firefox/Safari 兼容，无 CDN 回退。5 项 RED→GREEN；TS BufferSource 类型错误修正后 lint/类型通过。生产失败定位出 workspace dist 未重编译和 Vite bare SDK 旧缓存两个问题：根 build 先递归编译 @ranuts 包，provider 显式使用 patched ESM 入口，最终 SDK 产物核查通过。前失败快照保留，不能用旧构建证明新源码不可用。正确生产 WebKit UI 加载 69,189 ms、Hello. 回复 28,448 ms、首文字 28.25 s、3 tokens，页面/请求/可见错误为空，证据 product-compat-model.json。性能仍慢，离线/真机/多语言/取消未验收；SDK worker.onerror 只日志且 logger 对 Event 调 replace 的故障仍需修复。完整目标继续保持未完成。
- Fatal Worker 错误传播：SDK ESM/CJS 的真实 ProxyToWorker 回归先观察初始化 pending RED，再修复为终止/清空 failed worker、拒绝待处理和后续任务，不自动重试或重放。最初测试 helper 漏 this binding 的无关错误先修正后才得到行为 RED。新生产 SDK 的 WebKit 实际非法 Worker 脚本测试 21 ms 拒绝 RuntimeError、terminate 1 次，证据 worker-failure-browser.json；tiny Blob、未推理/未下载模型。dev 导入失败探测不能证明 Worker 行为，改用生产 SDK。全量 99 文件 / 3,751 项、lint/类型、递归包+生产构建和 whitespace 通过；初始化取消所有权、UI 重试、所有 abort 信号与产品离线仍需验证，完整目标继续未完成。
- 加载取消所有权修复：provider 原先只保存 ready engine，pending runtime 关闭时 exit 0；正确 SDK mock 路径下回归 RED→GREEN，创建即保存 loading engine、逐引擎去重释放、关闭导致 AbortError，无迟到 ready。SDK exit 原先仅 terminate 导致 pending 两入口回归 RED，现拒绝待处理/后续任务并 detach Worker。13 项相关通过，真实新生产 SDK WebKit 独立 message 确认进入阻塞初始化后 exit，RuntimeError/Wllama worker terminated、terminate 1 次、耗时低于 Date.now 分辨率（记录 0 ms），证据 loading-exit-browser.json；tiny Blob 无推理/模型下载。全量 100 文件 / 3,754 项、lint/类型、递归构建与 whitespace 通过。实际模型 UI 取消/重试、离线恢复与设备矩阵仍待验证，完整目标未完成。
- WebKit 实际离线刷新失败：persistent profile 在线模型加载 64,526 ms、/sw.js 控制；setOffline 后 editor navigation 报 WebKit encountered an internal error，未进入离线加载/推理，证据 webkit-offline-refresh.json。模型专用 Cache API 名未出现，persistent OPFS 能力与 earlier private context 不可混为一谈。需先隔离 navigation/SW/cache 匹配原因，保留 profile，不能据此声称模型缓存丢失或 Safari 全部失败。
- 用户追加明确要求：验证当前候选模型，同时优化 IM 交互与界面设计。模型覆盖应包含 GPU Qwen3-1.7B、Qwen3.5-2B、Qwen3.5-0.8B、Qwen3-4B 与 CPU Qwen3-0.6B；逐项记录可用性、事实/否定保持、格式遵循、七语言质量、首文字/速度、停止/恢复与设备范围，不把单个 Hello. 作为质量验收。
- IM 首轮：按现有文档侧栏的写作工作台方向优化标题、会话/消息排版和输入区，保持主题 token 与文档主体一致。空白态三个任务入口仅选模式/聚焦，保留草稿、不发送；模式切换同步提示，七语言补齐。任务入口与提示分别观察 RED 后 GREEN。真实生产 Chromium 桌面、390 px、暗色检查 draft/焦点/翻译语言显隐/零误发送/零横向溢出通过，JSON 与三张截图为 chat-design-*；模型下载被诊断脚本暂挂以固定空白态，不代表真实推理验收。全量 100 文件 / 3,755 项、lint/类型与递归生产构建通过；真实消息/错误/生成/预览状态、键盘与更广设备视觉检查仍需继续。设计优化不是完成声明。
- 新质量探测：真实生产 WebKit/UI/CPU Qwen3-0.6B，三次 fresh navigation、复用 persistent 模型缓存，中文事实改写 36,930 ms、否定事实英文摘要 39,374 ms、JSON 30,176 ms；首文字 29.24–33.25 s。逐条人工核对：中文 Alex/1250 EUR/2026-10-08 含义保留、日期币种本地化导致 literal=false 不等于事实错误；英文仍明确未批准；JSON 仅返回正确结构/值，空白不同不是 byte equality。原始 prompt/output/统计与人工结论见 webkit-model-quality.json。只覆盖该模型/中英三例，全部候选、其余五语言、样本量/风格质量/实际设备和故障/离线矩阵仍缺，完整目标保持未完成。
- GPU 基线扩大验证：真实 built UI / Chromium 显式 Metal WebGPU / Qwen3-1.7B，无 CPU 冒充。中英事实/否定/JSON 三例 1,303–1,805 ms，首 token 1.07–1.18 s；事实/否定和 JSON 结构保留。七语言中性句改写保留语言与短例事实，但六项基本照抄，不能证明改写能力。追加七语言口语转正式后，全部未完整满足正式语气；英文仅 gonna→going to、其他多数保留口语，韩文还出现未来付款→已付款/预期结果的语义漂移。保存完整 prompt/output/速度和逐条人工判断：gpu-model-quality / gpu-seven-language-quality / gpu-seven-language-register.json。结论仅当前产品 chat prompt 路径，不是 dedicated reviewed writing pipeline 或所有提示下的模型能力；不能声明默认模型质量达标。后续比较其他三候选、强化任务提示与真实写作流程，保持完整目标未完成。
- 候选覆盖补充：真实 built UI / Metal WebGPU 完成 Qwen3.5-0.8B、Qwen3.5-2B、Qwen3-4B 各三例，报告 gpu-qwen35-08-quality / gpu-qwen35-2-quality / gpu-qwen3-4-quality.json。0.8B 1.157–3.840 s，否定摘要遗漏未批准；2B 1.721–3.407 s 保留关键否定；4B 2.455–4.917 s 把输入指令也照抄进摘要。均正确返回指定 JSON，但不等于全面质量达标。五个当前候选现在都有基础可用性/三例实测，七语言和全面质量仍缺，不改默认选择。
- 专用 reviewed-writing 首次真实 UI 验证：1.7B 中文正式改写只显示通用错误（根因未捕获，不能推断）；英文正式改写将 Alex 替换为 He，数字守卫未拦；否定摘要保留关键事实。三次文档均未被自动改写，记录 gpu-reviewed-writing-quality.json，实际预览/错误截图已检查。需修复姓名/语义保持与可诊断错误，并比较其他候选专用路径。
- 用户追加工具调用：通过 IM 使用当前 Word/Excel/PPT 的 MCP 或 API。已查已有工具和闭合命令路径；本地模型原生 tools 仍关闭，审核规划仅 Word insert_text / Excel set_cell，PPT 不支持审核目标。采用应用侧结构化规划+现有本地 API，能力过滤、目标/版本绑定、写预览/应用、执行后核验。设计落在 specs/2026-10-02-im-document-tools-design.md；后续必须实现并真实验证三编辑器，不将现有注册表/文档作为完成证据。此前用户自主优化授权继续有效，无需重复申请行动许可。
- 工具调用实施首段：新增 document-tool-plan.ts，按 word/cell/slide 过滤真实 agentTools 注册表，通过 generateJSON 或普通 chat 提议单个 API 操作；解析仅产生冻结计划、不执行编辑器。校验 envelope/参数字段/必填/类型/枚举/长度、单元格和最多 5000 格范围、纯值公式拒绝、排序列与求和目标、PPT navigate 页码必需，host 判定 sum 无 target / slide navigate 为只读。9 项专项测试，先观察 Not implemented 导致 5 项失败，实施后 9 项通过；全量 101 文件 / 3,764 项、lint/类型、工作区包构建和 whitespace 通过，两个既存 PromiseRejectionHandledWarning 仍在。此模块尚未接入 IM，不能声明三编辑器模型工具调用已实现；下一段绑定文档/版本和通用审核动作，接入操作模式、结果消息和真实模型/三编辑器浏览器验证。
- 通用工具动作实施：document-tool-action.ts 捕获当前 iframe/API/逻辑文档或工作表模型、SDK History point 身份/长度、光标/区域/幻灯片页和交互 revision；写操作检查只读状态和版本追踪，读取可在 view mode 执行。DocumentToolAction 重新解析计划、不信任模型 readOnly，应用前核对目标，执行前消费，取消/失败/重复确认均不能重放。Word 主体文字与 Excel 显式单元格采用内容回读，修订模式读取实际状态；其他工具仅自身返回 verified 时显示已核验，否则为 sent，批注仍无独立核验。10 项专项测试（初始 5 项失败后通过，后补 Word/Excel 和缺版本范围），全量 102 文件 / 3,774 项、lint/类型和 whitespace 通过；两个既存 PromiseRejectionHandledWarning 仍在。未接入 IM 或做真实浏览器/模型调用，下一步适配预览的通用动作接口与工具模式，不能以此宣称三编辑器操作完成。
- 用户明确修正：不要预览卡片和重复确认，依赖编辑器撤销/保存，界面要精简好用。该指令覆盖先前设计的写审核步骤。面板已移除 ActionPreview 生命周期和输出，rewrite/summarize/translate/edit 生成后直接执行目标绑定的操作；新增操作文档模式用结构化工具计划→绑定目标检查→直接 API 执行→结果反馈，停止/会话切换仍使等待中的计划失效。保留未知/不明确请求不执行。读取结果显示文本/金额/页码；修改区分已发送和已核验。新模式七语言标签补齐。旧独立 ActionPreview 模块暂留但产品面板不使用。
- 上述交互回归先观察 translation/multiple requests 两项失败，移除预览并直接 apply 后通过；新增模型操作模式执行测试通过。全量 102 文件 / 3,775 项、lint/类型、递归生产构建和 whitespace 通过；原有 PromiseRejectionHandledWarning/externalization/chunk 告警仍在。真实 built UI / Metal WebGPU / Qwen3-1.7B 将 IM 请求 Insert exactly the text Hello tools at the current cursor. 经模型规划执行 Word API，2,621 ms，正文 Hello tools CRLF、零预览、零可见/页面错误、宿主回读核验。证据 direct-tools-word-ui.json。尚未验证 Excel/PPT 真实工具调用、Undo、读结果/失败/取消完整矩阵、工具质量和 IM 后续视觉优化，完整目标未完成。
- 三编辑器真实 UI/Undo：首先 Word 写入/Undo 成功，Excel 11 ms 捕获失败、PPT 1.395 s 未修改；隔离诊断确认 Excel selectionRange 含 SDK API 循环引用，PPT 返回 add 加无关 page:1 参数被严格解析拒绝。已仅序列化 Excel ranges 坐标/activeCell，并将生成 schema 改为各工具 exact 参数分支，slide add/duplicate 无 page、navigate 必需 page。新增两项回归分别观察 circular JSON/缺 schema branch 的 RED，修复后通过。
- 修复后生产 Chromium Metal / Qwen3-1.7B 三文档通过：Word 插入 Hello tools 2,552 ms、Undo 恢复 CRLF；Excel A1 写入 2,133 ms、asc_Undo 恢复空；PPT 新增 1→2 页 1,532 ms、Undo 恢复 1 页。均零预览、零 visible/page error、实际宿主结果核验。证据 three-editor-direct-tools-ui.json；仅各一种基础操作和该桌面模型，不能宣称完整工具/模型/设备矩阵通过。通用反馈七语言改为“结果已核对”，避免将 PPT 页数核验说成文本核验。全量 102 文件 / 3,777 项、lint/类型、递归生产构建、whitespace 通过；既存警告仍在。完整目标仍未完成，后续简化重复模式、读取/求和/排序/格式/翻译等工具与停止/错误/跨设备验证、模型质量和 IM 设计继续。
- 精简模式：按用户“精简好用”移除重复 edit 下拉项和面板旧 generateActionPlan 路径，统一为 tools 操作文档；保留 chat/rewrite/summarize/translate，共五项。操作模式输入使用正常指令提示，写作模式仍为补充要求。选项回归先 RED（旧 edit 仍存在）后 GREEN；取消/切会话晚到失败测试转到真实工具规划路径，26 项面板回归通过。全量 102 文件 / 3,777 项、lint/类型、生产构建及 whitespace 通过，既存告警仍在。此轮仅精简现有入口，不扩大先前三编辑器基础操作/Undo 实测结论；更广工具、模型质量、设备、离线及界面验收继续保留。
- 写作质量继续验证：实际 selected-text 直接执行路径 / Metal GPU / Qwen3.5-2B，中英文正式改写与否定摘要三例全部未改动原文，显示 generic error；英文和摘要诊断原始 JSON text 复制源文本，被 No rewrite/summary was proposed 拒绝，中文 baseline 未捕获根因。该候选不能仅据此前三例 chat 基线判为写作可用。
- 默认系统提示仍要求 human review/confirm，与用户取消预览的明确指令不一致；已缩短为普通聊天/结构化任务边界、宿主执行 API、仅凭已核验宿主结果报告修改、保留事实和不执行文档指令。新增七语言 unchanged-writing 指引，专项先 RED（generic error）后 GREEN，消息可再次格式化而不丢失。短提示复测 2B 三例仍返回原文，但明确显示该原因且未修改文档；不能宣称质量修复或据此更换默认模型。before/after 记录 gpu-qwen35-2-direct-writing-quality / gpu-qwen35-2-short-prompt-writing-quality.json。
- 系统提示影响工具路径，实际 1.7B 三编辑器重测：Word 2,336 ms、Excel 1,836 ms、PPT 1,321 ms，基础写入/新增和原生 Undo 均通过，无预览/可见错误/页面错误；证据 short-prompt-three-editor-tools-ui.json。全量 102 文件 / 3,778 项、lint/类型、生产构建及 whitespace 通过；既存警告仍在。下一步任务提示/示例或专用系统任务配置对照，当前 WRITING_SYSTEM_PROMPT 的 review 文案也待对齐；更广模型、工具、设备、离线、IM 设计要求仍未完成。
- 专用写作提示旧 review 文案已对齐用户要求：应用校验并直接应用结果，模型不执行 API；未增加确认流程。真实 4B selected-text 直接写作三例：中文 3,248 ms generic error/原文不变（根因未捕获）；英文 3,446 ms 改为 Alex will pay ... okay?，姓名/金额/ISO 日期保留但口语尾句仍在，不能判正式改写达标；否定摘要 3,696 ms 返回原文被拒绝。报告 gpu-qwen3-4-direct-writing-quality.json 明确 output 是操作后的文档正文，非原始模型响应。此结果不支持仅增加模型大小解决当前写作质量问题；继续任务提示/示例或任务级系统配置对照，不改默认。全量 102 文件 / 3,778 项、lint/类型、生产构建、whitespace 通过，既存 warnings 仍在。模型/工具/IM/离线/设备完整目标保持未完成。
- 写作提示偏好语义澄清：instruction 用于 tone/style/length，改写应改变表达而保留事实，不接受转换其他任务或工具请求；替换原“cannot change the source”歧义措辞。真实 4B 同组三例对照输出与此前一致，中文 3,310 ms generic error/原因仍未捕获，英文 3,413 ms 仍带 okay?，摘要 3,847 ms 返回原文。记录 gpu-qwen3-4-style-instruction-quality.json，不宣称质量提升或以此证明模型上限；提示歧义导致复制的假设未被此单次对照支持。后续测试更明确任务结构/少量示例及任务级系统配置，而非继续仅替换同义措辞。全量 102 文件 / 3,778 项、lint/类型、生产构建/whitespace 通过；既存 warnings 仍在。完整目标未完成。
- 写作少量示例隔离实验：仅临时修改 built 模块，加入中英正式改写与英文摘要短例，实验后恢复 dist，未改产品源码或默认模型。首次中文没有触发 marker，排除其对照结论；复测四行 markerCalls 1/2/3/4，证明实际执行示例提示。4B 中文同一例两次分别 4,537 / 4,481 ms，输出 Alex 将于 2026-10-08 支付 1,250 欧元。，正式语气与短例事实保留，币种代码本地化（非字面 token 保留）。英文 4,364 ms 仍 okay?，摘要 4,783 ms 仍源文。报告 gpu-qwen3-4-writing-examples-probe.json 含示例与人工判断。只支持这个中文短例改善，不支持英语/摘要全面提升或其他模型/语言；尚不接入默认提示，下一步比较其他模型、更多短例和 CPU 上下文/延迟开销。数据验证与 built 恢复检查通过；无产品修改，不重复全量回归或声称整体完成。
- 同组示例扩大至另外三 GPU 候选：隔离 temp built 模块、每模型四行（三 unique + 中文重复），全部 markerCalls 1/2/3/4，三模型运行后 dist 恢复，无产品改动。1.7B 中文两次正式改写成功（1,985/1,878 ms）且 Alex/ISO 日期/金额/EUR 保留；英文 generic error/未修改，摘要 2,376 ms 保留否定日期金额但删去 Alex。2B 中文两次 generic error；英文 3,476 ms 原文加多余引号被文本回读验证接受，不等于语气改写达标；摘要返回原文。0.8B 中文两次移除口语语气词、保留事实（2,616/2,363 ms），但动词仍“付”，正式度有限；英文/摘要 generic error未成功。三 JSON gpu-qwen3-17 / gpu-qwen35-2 / gpu-qwen35-08-writing-examples-probe 含人工判断。四 GPU 候选均已有本组写作示例对照，不能声称七语言/更长文本/CPU或全面质量通过。当前证据仅支持局部中文改善，不直接推广默认提示或更换模型；需检查摘要姓名保留、英语路径和 schema/任务提示相互作用，之后补 CPU/更多样本及 IM、离线、设备剩余要求。

- 无约束 chat 写作隔离对照：临时 built 路径移除 generateJSON 约束、无示例，运行后恢复 dist。4B 首行无 runtime marker，排除；其余英文仍带 okay?、摘要与中文复制原文被拒绝。1.7B 四行均确认实验路径：三次改写返回额外 task/targetLanguage 字段，被 exact schema 拒绝；一次摘要保留 Alex/日期/金额/未获批准，1,945 ms 成功应用。两份 writing-chat-probe JSON 补充原始响应与行级有效性。单例改善不足以改默认路由；产品源码未修改，不重复全量代码回归。用户再次确认精简好用，维持直接执行、简短反馈、编辑器撤销/保存，无预览或重复确认。完整目标未完成。

- 1.7B compact-input 隔离实验：只从末尾输入 JSON 删除重复 task/targetLanguage，保留任务指令、generateJSON 严格输出约束与应用校验。首行无 marker 排除，三有效行均 exact text schema。英文 1,697 ms 改成 He will pay ...，应用成功但丢失 Alex，违反姓名保留；摘要 1,762 ms 保留姓名/日期/金额/否定；中文 1,561 ms 输出您好与中文日期，numeric guard 拒绝，文档不变。报告 gpu-qwen3-17-writing-compact-input-probe.json 含 rawResponse 与逐行判断。格式反射减少不能证明忠实改写，暂不接入产品。dist 恢复与 JSON 验证通过，无产品代码修改；完整目标继续。

- 写作历史缺口修复：rewrite/summarize/translate 先前仅显示当前面板，未调用 history/controller 记录。新增回归先 RED（记录为空），补齐用户指令与宿主成功/失败反馈，使用 hostGuidance tool/error 保持重开时的呈现；不自动复制选区原文或生成正文入历史。异步切会话/控制器变化后保存到捕获的原 historyStorage，不写入当前新会话。成功与 unchanged-writing 失败回归通过，切到新会话再返回可恢复指令与 verified 结果；晚到切换分支尚未单独实测。全量 102 文件 / 3,780 项通过，最后追加的会话恢复断言所在 16 项专项再通过；lint/类型、生产递归构建、格式、whitespace 通过。初次实现变量误置与 hostGuidance 类型报错已在检查中发现并修正；两个既存 PromiseRejectionHandledWarning 和 build externalization/chunk 告警仍在。未声称模型质量或完整目标完成。

- 会话切换写作边界补验：延迟 resolve/reject 两条面板回归均验证切换即 abort、零 apply、新会话无旧聊天/错误且可继续输入，返回原会话可见旧请求与停止/unchanged 指引。初次断言误读整个面板（session option 合法保留旧标题），修正只检查消息区，非产品污染。另发现设置残留 chatonly “确认后再应用”旧 banner，新增不存在回归先 RED，移除该冗余 banner 与过时注释；不添加新提示/预览/确认。全量 102 文件 / 3,782 项、lint/类型、格式、递归生产构建及 whitespace 通过；两个既存 PromiseRejectionHandledWarning 与构建 externalization/chunk warnings 保留。此为模拟异步面板边界验收，非全模型/真实设备完成；完整目标保持未完成。

- 真实只读工具扩大：最新 production UI / Metal GPU / Qwen3-1.7B，经 IM tools 模型规划读取 Excel A1=12（2,266 ms），求和 A1:A3=42（1,890 ms），空白 PPT 读取（1,694 ms）。均零可见/页面错误、零预览，Excel 种子三格与 PPT 页数/文本未变。get_cell 会将选区 B2 跳至 A1，根因 tools.ts asc_findCell + asc_getCellInfo；sum_range 保留选区；空白 PPT 返回空 activity，无明确无文本提示。报告 read-document-tools-ui.json 标出这些问题与验证边界，不能声称整工作簿/非空 PPT/全部模型设备完成。下一步 get_cell 从明确地址直接读 model，避免扰动选区，并补空读取提示；本轮仅证据，不改产品或重复全量回归。完整目标继续。

- 只读交互修复：get_cell 使用 parseOfficeRange 校验单格地址并直接读取当前 worksheet model.getRange3().getValue()，移除 asc_findCell/asc_getCellInfo 选区跳动，能力缺失时报错而非导航回退；工具说明同步为 value/保持选区。更新读取回归先 RED（findCell 被调用），后 GREEN。空文本工具结果提供七语言 agentNoReadableText，面板 empty-read 回归先 RED，后 GREEN；不新增预览或确认。新增 i18n 类型并在共享包构建后验证，避免旧 compiled exports 带来 key/type 误判。
- 最新生产真实 GPU IM 重测：A1=12 1,973 ms、A1:A3=42 2,035 ms，种子三格与选区 B2 均不变；空 PPT 1,475 ms 显示 No readable text was found.，页数/文本不变。全部零 visible/page error/preview，报告 read-document-tools-fixed-ui.json 验证所有结果/选区/内容不变并标出样本范围。全量 102 文件 / 3,783 项、lint/类型、格式、递归生产构建和 whitespace 通过，既存 PromiseRejectionHandledWarning、externalization/chunk 告警保留。非空 PPT/格式化单元格与广模型设备矩阵待补，完整目标未完成。

- 非空 PPT 真实 IM 读取验收：SDK paragraph/run 向隔离标题 placeholder 放入英文 Alex/1,250 EUR/2026-10-08/NOT approved，production UI Metal GPU Qwen3-1.7B 规划 get_presentation_text，1,554 ms 完整回读、页数与正文未变。再通过实际 AddSlide 加第二页中文林晓/2,500 CNY/2026-11-09/尚未批准，1,586 ms IM 同时返回两页及正确页标签，两页全文与页数未变。报告 nonempty-presentation-read-ui / multislide-presentation-read-ui.json。均零 visible/page error/preview。只证明两份普通文本 placeholder 读取与该桌面模型，不是 IM 写幻灯片文字能力；未捕获 PPT selection，因此移除通用 harness 原先 undefined==undefined 的 selectionUnchanged 标记，不能据此宣称选区保持。组形状/表格/图表/图像/备注和其他模型设备仍待验证。探测 fresh context 无 agent 参数时侧栏不可见超时，确认启用 agent=1 后正常，不判为产品加载故障。本轮无产品改动，证据 JSON/whitespace 验证通过，不重复全量代码回归；完整目标未完成。

- 其他 GPU 模型真实工具矩阵：0.8B cell/sum generic error，blank PPT成功；2B cell与blank PPT成功，sum generic error；4B 同2B。三份 qwen35-08 / qwen35-2 / qwen3-4-read-document-tools-ui.json，九行数据与Excel选区未变、零预览/页面异常；不以 generic error 猜根因。4B隔离 built raw-response诊断：sum输出正确 tool/range但带 target:""，exact parser拒绝empty string，源数据不变；PPT正确get_presentation_text maxChars8000。首cell无诊断marker，排除raw诊断结论。报告 qwen3-4-read-tools-diagnostic-ui.json，dist已恢复。明确后续schema拆分SUM只读无target和写入required有效target两种分支，保留严格执行校验；其他模型根因待捕获。完整目标未完成，本轮证据无产品改动。

- SUM生成schema拆为两条exact分支：只读仅range，写入必需range/target，字符串minLength1；parser不放宽。新11项专项先 RED（一条分支），后 GREEN；全量102文件/3,784项、lint/类型、格式、生产递归build/whitespace通过，既存warnings保留。真实4B三任务复测 cell/blankPPT成功，sum仍失败（4,812 ms），不能宣称修复；诊断sum 4,848 ms确认target变成单个空格，满足minLength但被strict parser拒绝。首次cell无诊断marker不作raw结论；后两行marker确认，temp dist已恢复。sum-schema-split-ui / sum-split-diagnostic-ui报告明确无质量提升。下一步应在生成schema约束实际地址格式并验证只读意图，不能仅加minLength或吞空target；不以测试绿灯宣称产品工具质量完成。完整目标继续。

- SUM地址pattern候选已否决：target限制真实单格形状，专项RED后全量102文件/3,784项、lint/类型/build通过；真实4B只读sum却反馈verified修改、选区B2→A4，未返回42（4,921 ms）。A1:C3九格未变但不含A4，不能证明全文未改或具体公式；raw计划未捕获，只能由写入反馈/导航推断进入写路径。报告 sum-address-schema-ui.json明确REJECTED候选并记录边界。源pattern与新增候选测试已撤回，重建恢复原产品；不发布逼模型猜有效目标的格式约束。需要宿主把“用户明确给出的独立目标地址”作为写能力前提，并在parse后核验，而非仅依赖model选read/write。只读写入意图问题尚未解决，完整目标继续。

- SUM目标请求绑定：识别请求内独立单格地址（排除source范围端点），无独立地址时schema仅只读sum分支，有地址时write target enum限制这些地址；parse后再拒绝不在请求内的target，兼容无generateJSON/chat fallback。测试先RED（A4猜测被接受、enum缺失），后GREEN；全量102文件/3,785项、lint/类型/build通过，后加中文b4合法与A4/A3非法3条专项，总15项专项再通过；格式/whitespace通过。这是地址出现性约束，不声称完整语义授权/否定识别或全部写工具覆盖。
- 真实4B生产IM验收：只读sum返回A1:A3:42 4,808 ms，A1:C4十二格和B2选区不变；cell与blankPPT读取继续通过。另明确sum→B4 5,093 ms，B4=42、公式SUM(A1:A3)宿主核验成功，asc_Undo恢复十二格与公式空值。报告 qwen3-4-explicit-sum-target-ui / sum-to-cell-undo-ui。首次Undo harness误用window.editor（Excel在Asc.editor）失败，修正fallback重跑通过，非产品错误。均零visible/page error/preview。其他模型/语法、操作意图、模型写作、离线/界面/设备剩余目标继续，未整体完成。

- SUM修复扩大至其余GPU模型：0.8B只读sum 2,519 ms，2B 3,535 ms，1.7B 1,862 ms，均返回A1:A3:42且A1:C4十二格与B2选区不变；三模型blankPPT成功，cell读取2B/1.7B成功、0.8B仍generic error。qwen35-08 / qwen35-2 / qwen3-17-explicit-sum-target-ui.json，与先前4B同组证据构成四GPU本条只读sum均成功，不能外推全部工具/语言/设备。0.8B后续隔离raw诊断cell返回unsupported/input:{}，不是空cell或SDK读取失败；首sum无marker排除raw结论，cell marker确认、dist恢复。cell-diagnostic-ui报告保留根因。需要改善模型选择和unsupported友好提示，不放宽执行校验。无产品源码改动，报告JSON/whitespace/build恢复验证通过，不重复代码全量回归。完整目标继续。

- 工具选择失败反馈：exact unsupported/input:{}单独抛agentToolNotChosen，区别未知tool与malformed；displayError映射七语言明确“没有选出可执行操作，明确需求或换模型”，支持二次格式化保持原提示。presentation回归先RED(generic)，后GREEN，parser分类回归通过。全量102文件/3,790项、lint/类型、生产递归build、whitespace通过；lint先发现未跟踪Undo harness unsafe optional chaining，已修正harness再通过，非产品问题。真实0.8B cell失败2,035 ms显示新提示与一个Restore request按钮，A1:C4/选区不变；sum 2,410 ms和blankPPT 1,888 ms继续通过。报告tool-guidance-ui.json，不宣称模型选择质量修复或恢复按钮点击已验收。既存PromiseRejectionHandledWarning/build warnings保留。完整目标继续。

- 工具历史补齐：tools先前仅记user和成功assistant，错误仅面板、成功重开无hostGuidance。合并写作/工具operationHistory，共同保存user与成功tool/error元数据，失败/停止与原historyStorage绑定。失败恢复回归先RED（error节点不存在），后GREEN；成功blank读取切会话再返回保留activity断言通过。全量102文件/3,791项、lint/类型、生产build、格式/whitespace通过，既存warnings保留。真实0.8B IM三例：cell unsupported失败1,990 ms，切会话回来错误完整保留，Restore request点击回填同指令、300ms内未自动发送，A1:C4和B2不变；sum2,422ms、blankPPT1,873ms成功，重开activity完整恢复。tool-history-restore-ui.json只证明同页会话切换，不是浏览器重启/磁盘历史全矩阵。仍有模型选择、更多意图/工具/设备、离线与视觉等未完成；完整目标继续。

- IM操作反馈精简：单条tool直接plain文本div，不创建空details/重复正文；第二条连续tool才升级details，summary为最新结果、列表只含历史，第三条按历史顺序归档旧summary，不重复最新文本。textContent输出与XSS literal回归先RED后GREEN，保留pre-wrap/长词换行。既存两次写作测试原依赖li数量，改为两条独立activity且无details；全量102文件/3,792项、lint/类型、递归生产build、格式/whitespace通过，既存warnings保留。真实1.7B IM cell1882ms/sum1916ms/blankPPT1353ms均正确，仅一次反馈、零details/preview/error；桌面和390x844截图已捕获，人工查看desktop cell和narrow sum，窄屏无横向溢出。compact-tool-results-ui.json，viewport模拟不能等同移动设备，长输出/分组/dark视觉验收待补。完整目标未完成。

- 真实模型预设切换bug：stored custom-ID4B背景加载后picker选择0.8B、点击Load，runtime仍4B，custom override仍4B；model-picker-switch-ui.json明确runtimeMatchesSelection=false。根因selectedLocalModel customID优先覆盖picker；UI模型预设onchange先清理自定义ID/URL/lib并清除其持久值，保存agent-local-preset，初始化只恢复有效catalog预设。新回归先RED(override未清)，后GREEN，包含面板重建恢复所选preset；全量102文件/3,793项、lint/类型、生产递归build、格式/whitespace通过，既存warnings保留。修复实际4B→0.8B加载身份匹配、remainingOverride空，fixed-ui.json。harness初次对r-select使用selectOption失败，已改原生点击option，非产品错误。尚未覆盖切换后推理/内存释放、真正OOM/自动较小模型降级或浏览器刷新持久化实测；完整目标继续。

- 模型预设切换后推理/刷新验收：真实生产Chromium Metal缓存模型4B→0.8B，加载身份正确、旧override清空，Hello短回复545ms，refresh仍0.8B/picker一致；switch-reload-ui报告reply字段含DOM按钮文案明确不是raw。第二独立worker-lifecycle probe捕获assistant dataset.source=Hello（552ms），WebLLM worker0在切换后close、worker1替代；refresh后worker1 close、worker2替代，仅1个live inference worker，身份与preset一致。worker-lifecycle-ui报告含事件快照。只证明各一次切换/刷新和Worker关闭，不能推断实际GPU内存回收、长期无泄漏、OOM或自动小模型降级；离线未测。证据JSON与whitespace验证通过，无产品修改、不重复全量代码回归。完整目标继续。

- WebKit离线导航根因进一步分离：检索上游Playwright issue42775（2026-09-18、1.63.0、仍open），独立本地1.62.1/macOS最小literal-SW复现无应用/模型/Cache依赖。WebKit26.5 controlled页面setOffline导航internal error，停止origin但不设offline flag则literalSW200成功；Chromium151两种均200成功。offline-sw-navigation-control.json包含4条与版本/上游链接。该控制证明当前WebKit offline emulation问题不能直接当产品缓存故障。
- 真实production shell独立static server、fresh WebKit warm DOCX，SW控制且editor.html缓存存在；仅停止该自有originserver，refresh200/fromServiceWorker，OnlyOffice API isDocumentLoadComplete/isLoadFullApi均true、零页面错误。webkit-origin-stopped-editor.json。没有改/停止常驻5193预览；没有模型下载/初始化/推理，也非全断网或iOS实机，不能宣称完整离线目标通过。只隔离原导航失败，不绕过要求；后续需要真实网络断开或可覆盖模型网络的故障注入验收。JSON/whitespace通过，无产品改动、不重复全量回归。完整目标继续。


### 2026-10-04: remove redundant CPU byte budgeting

Ready providers with exact final-request token budgeting bypass the default runtime byte budget; explicit byte limits remain. 71 targeted tests, TypeScript, lint and production build passed. Actual CPU IM accepted 10,018 bytes, rejected oversized custom system context before generation and recovered, with no preview cards. Evidence: `docs/evaluations/2026-10-04-cpu-count-im-long-input.md`. Broader model fidelity, tool execution and device/offline acceptance remain open.


### 2026-10-04: actual CPU document operation path verified

The IM structured document-operation path is available on CPU despite ordinary chat rejecting native tool calls. Actual Word insertion, Excel B2 assignment and PPT text-box addition with multilingual literals passed native Undo/Redo, Save and homepage reopen with identical content snapshots and zero preview cards. See `docs/evaluations/2026-10-04-cpu-count-im-three-editors.md`. Arbitrary instruction/tool accuracy and full offline/device acceptance remain open.


### 2026-10-04: current CPU IM offline browser restart

Current hashed plugin, service worker, native CPU runtime and warmed model cache restored after browser close/relaunch with offline mode set before navigation. Actual chat and Word operation succeeded; native Undo/Redo matched snapshots. See `docs/evaluations/2026-10-04-cpu-count-process-restart-offline.md`. This is warmed desktop Chromium/Word acceptance, not all device/editor/PWA launch certification.


### 2026-10-04: extend offline restart acceptance to Excel and PPT

Separate warmed-profile browser restart runs in offline mode passed actual Excel B2 writing and PPT new text-box creation, plus native Undo/Redo. The shared verifier now checks four actual reports (chat, Word, Excel, PPT), driver hashes, native counting/generation and snapshots. Evidence remains scoped to desktop Chromium warmed caches and these exact operations; arbitrary instructions, mobile and installed PWA launch remain unverified.


### 2026-10-04: Chinese CPU IM operation acceptance

Three actual Chinese Word/Excel/PPT writing requests passed exact content checks, native Undo/Redo, Save and reopen, with no preview cards. See `docs/evaluations/2026-10-04-cpu-count-im-zh-three-editors.md`. This adds language coverage for explicit literal operations, not general model writing fidelity or arbitrary tool accuracy.
