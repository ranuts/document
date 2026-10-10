# 本地文档助手：当前要求与验收缺口

基于附件 `pasted-text-1.txt`、用户要求精简 IM/原生撤销保存，以及当前代码和归档运行结果重新盘点。整体目标尚未完成。这是证据索引与后续工作优先级，不是完成声明，也没有把归档运行冒充本轮重新执行。

## 当前交互约定

IM 直接操作当前 Word、Excel、PPT，不增加预览卡片和重复确认。修改仍需通过请求、目标和执行结果校验，使用原生撤销与保存恢复。模型校验放行不等于事实和语言质量通过。旧设计中“修改仍需显式确认”的描述已按用户要求修正。

## 逐项盘点

| 附件或用户要求                   | 当前证据与范围                                                                                                                     | 未完成或证据边界                                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 纯浏览器推理，无云端兜底         | `packages/agent-core/src/llm/local.ts` 只调度 WebLLM/wllama；真实写作报告记录外部请求；Llama 3B 有静态模型 GET，部分预热运行零外部请求                                          | 核心库保留远程 provider 不等于产品启用云端；需要持续核查产品所有内容出口，不能以 CSP 证明无法外传                                                                                                         |
| GPU 探测与初始化 CPU 降级        | `detectGPUAdapter` 实际调用 requestAdapter；失败清理后加载 CPU；历史实际 Worker 故障降级记录见旧 audit                             | 受控异常不证明物理 GPU/OOM 资源释放；生成过程中不自动重放                                                                                                                                                 |
| Worker 避免阻塞 UI               | WebLLM Dedicated Worker、wllama 原生 Worker；加载/停止历史运行记录                                                                 | 缺跨设备长任务响应性和真实低内存设备证据                                                                                                                                                                  |
| 首载下载、可信来源、自托管       | CPU 固定 revision URL；`llm/model-source.ts` 与 `bin/prepare-local-model.mjs` 支持模型来源配置；附件 Llama 3.2 3B 已执行六个实际 IM 摘要对照 | Llama 3B 不采用默认，中文/条件遗漏仍失败且无冷离线/资源完整验收；附件 1B/8B 未验收；来源能力不能替代每种模型质量/许可/资源验收 |
| 模型缓存与冷启动离线             | `2026-10-03-cold-offline-model-matrix.json` 四种 GPU 与 CPU 的新 Chromium 进程缓存加载/hello；拒绝代理且未缓存请求失败             | 仅桌面 Chromium、已缓存模型和 hello；不证明缓存被浏览器驱逐后、真实设备重启或通用任务离线质量                                                                                                             |
| PWA 与完整编辑器启动             | `2026-10-03-hosting-isolation-analysis.md` 三种本地主机、三种原生编辑器与离线入口记录                                              | WebKit 冷离线导航仍失败；本地 Pages 不等于已部署 edge；不证明离线拼写检查                                                                                                                                 |
| 流式输出、停止、重试             | CPU/GPU 实际停止和恢复记录；精简设置后初始化停止/迟到消息/重载/真实hello通过；provider 串行取消；`2026-10-02-cpu-cancellation-audit.md` 与旧 audit 后续                              | 单次恢复不证明无限稳定性；故障后必须保留请求，不重复修改文档                                                                                                                                              |
| 加载进度、引擎模型与统计         | 既有生产 UI/加载记录，CPU 原生线程与真实 usage 诊断                                                                                | SDK 显存估计不是下载大小或 RAM；CPU 包含预填充的整体速率不能当 decode 速率                                                                                                                                |
| 系统指令与生成参数               | `llm/generation.ts` 验证范围，聊天路径传递参数                                                                                     | WebGPU 结构化任务固定温度 0/专用系统，不承诺所有模式使用聊天参数；提高温度实验不通过                                                                                                                      |
| 上下文滑动窗口                   | `context-budget.ts` 保留完整近期回合，`runtime.ts` 实际调用；超大末回合拒绝                                                        | UTF-8 字节预算不是精确 token；系统/模板开销与不同模型 tokenizer 仍需实际验证                                                                                                                              |
| 真实上下文超限提示               | CPU/GPU 当前报告记录原生 token 超限、原文保留、Restore 不重发以及下一轮 hello 恢复                                                 | 明确报错不是长文自动摘要/分块实现；不应静默截断用户文档                                                                                                                                                   |
| 历史默认内存、可选 IndexedDB     | 旧 audit 与已有历史测试；`2026-10-03-im-long-history-export-delete.json` 实际数据库恢复/删除                                       | 合成历史不能证明所有真实生成/并发磁盘故障情形                                                                                                                                                             |
| 导出、清空历史                   | 上述报告精确导出 12 会话/720 消息/804006 bytes；清空后磁盘 sessions 0                                                              | 不承诺 OS 下载文件同步删除；不将模型缓存删除混同会话删除                                                                                                                                                  |
| 安全渲染与 CSP                   | `packages/chat-ui/src/markdown.ts` textContent 渲染；`bin/editor-csp.mjs` 最终 inline 哈希；实际 shell 注入阻断记录；事件观察下真实修复前→后两构建三类型保存迁移通过 | WebLLM Worker 响应 CSP 已落地；vendor iframe CSP 仍为实验，unsafe-eval、embed/plugin、部署与跨浏览器边界开放；频繁查询旧 Worker 仍停滞；外联 fetch 被允许，整体安全门槛未通过 |
| 精简、有设计感 IM                | 原生操作，无预览；自定义模型折叠；40组亮暗/视口设置复核；三编辑器×三宽度关闭焦点、Enter重开、草稿保留验证                                                       | 关闭焦点修复有实际 Chromium 证据；仍缺完整生成/工具状态视觉复核与物理移动端体验                                                                                                                                               |
| Word/Excel/PPT 工具操作          | 归档 IM 证据含五模型 Word 修订开关/Unicode选区与 PPT 字体修复后 Save/reopen；hosting 报告三类型 native edit/Save/reopen/offline    | hosting 原生操作不是新的模型工具验收；修订矩阵只覆盖采样字符/settings.xml，PPT覆盖指定文本框/采样样式；不能外推任意格式、全部元数据或复杂样式                                                             |
| 多语言改写、摘要、翻译质量       | 当前 writing-task 数字/日期/符号/币种校验；摘要独立新样本对照发现默认模型候选将“未证实”变“已证实”并被放行，见 summary-focused 分析 | 未通过：语义角色、否定条件、名字、正式语气和跨语言质量不能由字面守卫证明                                                                                                                                  |
| 资源预算与设备降级               | 当前较小 CPU availability fallback；GPU 模型选择与失败提示                                                                         | 缺 Windows 集成 GPU、真实 iOS/Android/低内存设备；不能采信统一 iOS 1.5GB 硬阈值；更小模型自动选择策略尚无完整实测                                                                                         |
| 语音、视觉、本地 RAG、浏览器能力 | 原设计作为按需扩展；用户当前聚焦文本 IM 文档操作                                                                                   | 非当前必需交付；不得为了视觉完整度提前引入图像/视频/复杂 RAG，亦不宣称这些能力已实现                                                                                                                      |

## 当前质量证据

`2026-10-03-gpu-writing-sampling-analysis.md`：只提高结构化温度未稳定改善，默认参数保留。`2026-10-03-gpu-model-fidelity-analysis.md`：4B 比 1.7B 在部分对象关系上改善，但仍未稳定遵循正式语气，默认模型保留。`2026-10-03-gpu-writing-roles-analysis.md`：候选系统/用户消息组合提升部分熟悉改写，却引入摘要与多语言回归，不采用。

这些结论来自实际模型输出，而非 mock 或只检查 JSON 是否合法。所有报告保留失败，不以修改成功数量替代质量。已经查看过的样本用于回归，后续不能重新称为独立验收样本。

## 后续优先级

1. 写作：分别评估改写、摘要、翻译，既覆盖已有回归，也增加未参与调优的语义/语言样本；先解决错误事实被放行与明显指令不遵循。无需增加预览或确认来掩盖模型问题。
2. 安全：对 Worker 和原生 iframe 的实际脚本/动态编译依赖做可执行调查；不能仅重复 shell 注入测试就关闭安全验收。
3. 离线/设备：复现 WebKit 冷启动边界，再补 Windows 和真实移动/低内存设备。缺物理设备证据必须保留未验证，不用模拟内存参数代替。
4. 最终体验回归：当前生产构建下三编辑器、亮暗/窄屏/键盘、载入/停止/重试、历史、保存重开和离线形成清晰矩阵；局部成功不能作为全目标完成证据。

## 本轮证据更新

`2026-10-03-serving-version-update-analysis.md`：实际 serial Chromium E2E 修正错误异步等待后暴露并修复静默更新 defect。当前比较真实 serving VERSION，dirty 前后复查、其他 controlled editor 存在时等待；最终 116文件/4175测试、build/lint/E2E通过。CLIENT_COUNT 是受控 client 快照，不是原子跨窗口 dirty 共识。

`2026-10-03-vendor-csp-cache-upgrade-analysis.md` 已撤回此前“candidate接管后回退”的推断：Playwright async false 谓词未建立接管。修正 explicit VERSION polling 后，synthetic stamp 代理模拟的三文档 native Save/reopen和same-context离线响应策略验证通过。真实两独立构建/部署迁移仍未验证，vendor CSP未进入产品。

写作、设备和最终交互验收仍开放；上述更新没有把局部绿色结果扩成全目标完成。归档 Word/PPT 结果是证据索引更新，本轮没有重跑这些模型工具场景。

`2026-10-03-cpu-summary-focused-analysis.md`：补齐相同六个摘要样本的当前CPU四线程路径，12次原生IM修改/Undo/Redo均完成，但候选把货物价值写成目的地、混淆检查/发货授权，并改变日期事件归属，继续不采用。当前CPU温度0.7、GPU对照温度0，不作跨引擎准确率/速度排名；这些已观察样本不能再称独立验收样本。

`2026-10-03-local-nli-analysis.md`：独立浏览器 NLI 实验不采用。当前 pinned q8 路径拒绝全部源文支持正对照；fp32 身份校准通过，却以高置信度放行人名/价值关系/提议/条件错误。64次最终推理仅证明实验执行和这些反例，不证明摘要质量或安全门槛通过。源文支持不等于指令完整，RAM/模型共存/物理设备未测，无产品依赖或UI改动。

`2026-10-03-vendor-csp-two-build-analysis.md`：两个真实本地构建按完整2542文件vendor tree生成不同stamp，空白旧会话下三类型native edit/Undo/Redo/Save/reopen及same-context离线对照通过；旧Word实际编辑保存后升级仍停在旧Worker，候选已installed且收到SKIP_WAITING、编辑器count为0。停止旧CDP Worker后候选激活只是诊断干预，不能作为产品恢复方案；具体未结束任务/浏览器原因尚未定位。共享workspace依赖，非hermetic构建；非edge部署，完整迁移gate仍未通过，vendor CSP继续不发货。

上述是修复前的历史失败记录。`2026-10-03-sw-prefetch-migration-analysis.md` 更新当前边界：`87cf58f` 已暂停应用 Worker 安装/等待期间的首页暖缓存，接管/安装失败后恢复且保留 3G 用户意图。新真实构建对与修复前 `75b6551` → 修复后候选均完成三类型旧 dirty/save、实际 VERSION 接管、旧文件重开、native Undo/Redo/Save/reopen 和 same-context 离线。事件观察没有停止产品预加载、固定等待、手动 skipWaiting 或清缓存；六个合成 native 下载另行归档，避免 scratch 覆盖。局部 artifact migration gate 通过，但频繁查询旧 Worker 的 20秒失败仍保留，不能宣称跨浏览器/设备/消息流量普遍稳定。vendor CSP 依然仅实验，部署、embed/plugin 和语义写作质量等验收未完成。

`2026-10-04-llama3b-summary-analysis.md`：附件 Llama 3.2 3B 通过现有 custom-model 设置完成六次实际 WebGPU/current-prompt 摘要；五次原生应用/Undo/Redo，一次中文日期格式改变被拒绝且原文保留。英文付款关系/取消例外局部正确，但英文检查通过条件弱化，指控摘要新增源文未提供的女性代词；中文漏提议人/提议状态、排除指令/长度失败，并把“另一次会议”改为“下一次会议”添加时序，不替换默认。是已观察回归样本单次输出，非新独立语言/质量或模型排序验收；首次加载记录123静态GET body0，仍有外网下载元数据，不是冷离线或整体无法外传证明。产品模型目录、prompt、依赖和IM交互未改。

2026-10-04 后续：当前 Qwen 思考流程12次真实对照仍丢失前提/否认者并漂移语言，未采用；fastText 61段原生/Worker与后续64段混合语言对照仅验证局部分类与初始化后离线计算，混合改述误拒与短文本漏检未解决，未接入产品。参见 thinking-summary、fasttext-language-mixed-analysis 与 panel-close-focus 分析。
