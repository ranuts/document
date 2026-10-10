# 本地多语言写作助手评测

状态：已完成三种正式候选的七语言短文实测（各 87 次）及指令格式诊断（各 29 次），共 348 条输出；4B 三次加载被缓存配额阻断，质量未测。详见 [能力实测与原始记录](2026-09-27-model-capabilities.md)。1.7B 保留为实验基准；没有候选通过完整发布验收。单元测试只验证程序契约，不能证明模型质量、速度或离线可用性。此前的 [0.6B 冒烟记录](2026-09-27-webllm-writing-smoke.json) 使用了不同的推理开关配置，不能作为其固有能力结论。

## 可复现设置

- SDK：固定 `@mlc-ai/web-llm` 0.2.85。
- 主对比：`Qwen3-1.7B-q4f16_1-MLC`、`Qwen3.5-2B-q4f16_1-MLC`。
- 补充候选：`Qwen3.5-0.8B-q4f16_1-MLC`、`Qwen3-4B-q4f16_1-MLC`。
- 使用 `WRITING_SYSTEM_PROMPT` 和 `buildWritingMessages`，每例独立上下文、无 tools；不是用聊天历史连续测所有样本。
- 上下文使用 SDK 注册表的 4096 配置；记录实际参数、模型配置和下载 URL。生成初值 temperature=0.7、top_p=0.8、max_tokens=512；这只是候选设置，不能标为已调优。
- 本轮 Qwen3/Qwen3.5 写作请求使用 SDK 0.2.85 的 `extra_body: { enable_thinking: false }`；仅 `/no_think` 软指令不足。此字段路径与 Transformers 模板参数不同。空 thinking 前缀不计为实际推理；完整原始输出仍保留。
- 记录浏览器完整版本、OS、硬件、GPU adapter 能力、量化、上下文、prompt 版本和冷/热缓存状态。GPU 内存估算不是下载字节或实际内存测量。

## 基础语料

每种语言执行 rewrite、summarize，以及到中文和英文的翻译（跳过同语言翻译）。共 26 个基础任务；每例至少独立运行三次。此小集合用于发现明显问题，发布前还需各语言母语审阅者提供真实短文、长段落和专业材料。

| 原文语言 | 文本                                                                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zh-CN    | 项目预算为 1,250 EUR。请在 2026-10-08 前提交报告。我们暂未批准第二阶段，也不能保证交付日期。负责人为 Alex。                                                                                                       |
| en       | The project budget is 1,250 EUR. Please submit the report by 2026-10-08. Phase two has not been approved, and we cannot guarantee the delivery date. Alex is responsible.                                         |
| ja       | プロジェクトの予算は 1,250 EUR です。2026-10-08 までに報告書を提出してください。第2段階はまだ承認されておらず、納期も保証できません。担当者は Alex です。                                                         |
| ko       | 프로젝트 예산은 1,250 EUR입니다. 2026-10-08까지 보고서를 제출해 주세요. 2단계는 아직 승인되지 않았으며 납품 날짜도 보장할 수 없습니다. 담당자는 Alex입니다.                                                       |
| de       | Das Projektbudget beträgt 1,250 EUR. Bitte reichen Sie den Bericht bis zum 2026-10-08 ein. Die zweite Phase ist noch nicht genehmigt, und wir können den Liefertermin nicht garantieren. Verantwortlich ist Alex. |
| es       | El presupuesto del proyecto es de 1,250 EUR. Entrega el informe antes del 2026-10-08. La segunda fase aún no se ha aprobado y no podemos garantizar la fecha de entrega. Alex es responsable.                     |
| pt       | O orçamento do projeto é de 1,250 EUR. Entregue o relatório até 2026-10-08. A segunda fase ainda não foi aprovada e não podemos garantir a data de entrega. Alex é o responsável.                                 |

“1,250 EUR”在样本中是固定测试字面量，专门检查模型能否保留数字。应另外加入各语言本地数字格式，不让单一格式覆盖实际使用场景。

补充任务：中英混排保留术语；列表与换行；引号/JSON 字符；文本内“忽略之前指令”等提示注入；接近上下文上限；空文本；同文字不同选区；否定句和不确定表达。

## 质量评分

每个结果分别记录 0/1/2 分：目标语言正确、忠于原意、数字/日期/名称准确、术语准确、自然程度。翻译和润色不得改变预算、期限、“未批准”“不能保证”或负责人。摘要允许省略次要信息，但不能反转或杜撰事实。混排润色不能未经要求翻译整个段落。

语言错误、事实反转或新增事实属于不通过。其他维度由母语审阅者逐语言判断，记录失败案例，不只比较平均分。提示中的数据边界只是缓解措施，不能证明模型免疫提示注入；应用权限由程序控制。

## 性能与故障协议

1. 在编辑器已打开的状态，用户点击加载；记录实际网络下载字节、加载总时长和错误。下载与加载分别统计。
2. 每例记录首次文本 delta 的时间、生成总时长、SDK 报告的 token 数及速度（拿不到 token 数就记录缺失，不用字符数冒充）。完整输出交给人工评分。
3. 停止生成，验证没有继续显示输出或自动编辑；加载时切换模型；重复失败后重试；模拟 Worker error。
4. 关闭页面、重新打开并断网，验证模型/Tokenizer/WASM 是否全部可用。Cache 提示不作为验收结果。
5. 至少验证 Apple Silicon、Windows 集成 GPU 和一种资源受限设备；记录编辑卡顿与模型加载失败，但不把设备型号推断为精确 GPU 可用内存。
6. 选区工作流启用前，验证文档身份、版本和位置变化使建议失效；检查撤销、格式及亮暗模式。

## 结果记录

| 模型         | 七语言短文质量                            | 本轮初始化 | 生成中位数 | 编辑并行 | 离线重开 | 结论                         |
| ------------ | ----------------------------------------- | ---------- | ---------- | -------- | -------- | ---------------------------- |
| Qwen3-1.7B   | JSON 输出、注入失败；直接指令仍有混排错误 | 70.0 秒    | 1.50 秒    | 未测     | 未测     | 保留实验基准，未通过发布验收 |
| Qwen3.5-2B   | 部分语言变英语、注入失败                  | 77.1 秒    | 2.20 秒    | 未测     | 未测     | 不支持替代 1.7B              |
| Qwen3.5-0.8B | 翻译语言与具体日期失败                    | 32.7 秒    | 1.69 秒    | 未测     | 未测     | 不作为通用多语言默认         |
| Qwen3-4B     | 未进入推理                                | 配额失败   | 未测       | 未测     | 未测     | 待验证                       |

初始化含下载与缓存，不是统一冷/热加载对比；耗时只代表本轮短文请求，不是 token/s。

每个结果保存 modelId、locale、task、targetLanguage、prompt、output、参数、硬件、浏览器版本、时间、错误及人工评分。只使用公开测试材料；评测记录不得包含用户真实文档。
