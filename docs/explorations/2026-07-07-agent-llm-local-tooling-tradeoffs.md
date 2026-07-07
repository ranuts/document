# Agent LLM 选型经验:本地无-key + 工具调用的可行边界

> 2026-07-07
>
> 一次反复被问到的问题的定论:想要"不用远程 API key + 本地推理 + 能可靠调工具"的
> agent,到底可不可行、用 pi / langchain 能不能解决、要不要自己"调优模型"。

## TL;DR

1. **pi 和 langchain 是编排层(orchestration),不产模型、不改模型权重。** 它们包在已有模型
   外面,负责提示词、工具接线、agent 循环、解析、RAG——全是**推理时**的事。用它们替换
   本项目自研的 `@ranuts/agent-core` 不会让小模型突然会调工具(那是同一层的另一种实现)。
2. **"本地小模型工具调用差"是天花板(能力)问题,不是编排问题。** 推理时优化只能把模型
   **逼近**它自己的天花板,抬不高天花板。
3. **"本地 + 无远程 key + 能可靠调工具"的物理最优解是 Ollama**(项目已实现 `ollama.ts`):
   在用户本机跑 7B–14B 有真正 function-calling 的模型。代价是用户要装 Ollama。
4. **浏览器零安装(WebLLM)那条,唯一还没用上的真实杠杆是"约束解码"**(MLC/XGrammar 的
   json_schema/grammar),强制输出合法工具调用 JSON。是 WebLLM 的能力,pi/langchain 不提供。
5. **"自己调优模型"分两义**:推理时调优(框架能做,已在做)vs 微调权重(要 HF/PEFT/Unsloth
   训练链,不是 pi/langchain)。微调能抬一点天花板,但代价大、上限仍是小模型级,ROI 低。

## 问题背景

诉求:做一个文档编辑 agent,**不想用远程 agent key**(隐私/成本),但**本地模型能力不够,
调用 tools 非常差**。自然会问:能不能用 pi 或 langchain "出/调优"一个适合本项目的模型?

## 概念澄清:两个不同的层

把系统拆成两层,很多混淆自解:

| 层                            | 做什么                                                                             | 谁负责                                                      | 能否改"模型本身能力"                   |
| ----------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| **训练/微调(train-time)**     | 改模型权重                                                                         | HF Transformers / PEFT / Unsloth / Axolotl + GPU + 训练数据 | ✅ 能抬天花板(幅度有限)                |
| **编排/推理(inference-time)** | 提示词、few-shot、温度、工具 schema、**约束解码**、RAG、重试、输出解析、agent 循环 | **pi / langchain / 自研 `agent-core`**                      | ❌ 不碰权重,只把模型逼近它自己的天花板 |

比喻:模型是发动机,pi/langchain 是司机+导航+变速箱。好司机能压榨发动机到极限,
但**没法把 1.5L 变成 V8**。微调 ≈ 重新加工发动机——可行、昂贵,加工完的 1.5L 仍不是 V8。

### "调优模型"的两义

- **推理时调优**(改提示词/工具/解码参数):✅ 框架能做,本项目 `agent-core` 已在做。
- **微调权重**(让模型本身更会用本项目的工具):✅ 可行,但**不是** pi/langchain——用训练链
  在 Qwen2.5-3B 之类上做 LoRA + 造工具调用数据 + 编译成 MLC/WebLLM。练完仍是小模型天花板。

## pi 与 langchain 各是什么

- **langchain**:大而全的 LLM 应用工具箱——chains、agents(ReAct / 工具调用循环)、memory、
  retriever/RAG、prompt 模板、输出解析、几百个 provider/向量库接入。
- **pi**(earendil-works/pi):更轻的多-provider agent 框架——provider 抽象 + agent loop +
  浏览器 Direct Mode(请求直连云端 API,key 存 localStorage,无中间服务器)。范围比 langchain 窄。

两者都在模型**之上**,决定"发什么提示词、暴露哪些工具、循环几轮、怎么解析"——**从不碰权重**。

### 关键:pi ≠ 本地推理

pi 的 Direct Mode 仍把请求发往云端 Provider、仍要 key。所以**"WebLLM 不可行 → 换 pi"不是等价
替换**:WebLLM 的价值是离线/无 key/隐私,pi 一样都不给。两者解决不同问题。

## 项目现状:结论早已写进代码

本项目已自研 `@ranuts/agent-core` = provider-neutral 浏览器 agent 框架(**就是 pi 的等价物**),
且已把"本地小模型不可靠"的教训固化:

- `packages/agent-core/src/llm/webllm.ts`:
  - _"WebLLM only enables tools on the Hermes family; the small Llama/Qwen/Phi models (which can't
    call tools) are intentionally excluded."_
  - _"`<tool_call>` structures crash on some models and mangle the format on others — so tool use
    with WebLLM is unreliable by design."_ → 于是有 **chat-only 兜底模式**(无工具,只当顾问)。
- `packages/agent-core/src/llm/ollama.ts`:打 `localhost:11434`、`tools: toOpenAITools(tools)`,
  **走原生工具调用**——本地但有能力。
- `lib/agent-plugin/`:工具层(`insert_text` / `get_selection` / `replace_selection` /
  `set_review_mode` / `get_document_text` / `add_comment` / `set_cell` / `get_cell`,接 OnlyOffice
  `pluginMethod_*`/`asc_*`)+ 系统提示词(`prompt.ts`,已按 tool-capable / chat-only 分两套)。

即"**项目特异化**"(工具 + 提示词)早已完成,且与 provider **解耦**——换任何框架,这部分都是可复用资产。

## 方案分层(按性价比)

1. **主推 Ollama(已实现)** — "本地 + 无 key + 能调工具"的物理最优解。本机跑 Qwen2.5-7B/14B、
   Llama3.1-8B,真 function-calling。代价:用户一次性装 Ollama + 拉模型。近乎零新开发,
   只需 UI 引导。
2. **给 WebLLM 加约束解码(零安装用户)** — 现在是放任模型自己吐 `<tool_call>` 文本(正是翻车点)。
   改用 MLC/XGrammar 的 `response_format` json_schema/grammar **强制**合法输出,显著抬高小模型
   工具调用成功率。是 **WebLLM 的能力,pi/langchain 不提供**。仍受小模型天花板限制(单步可救,
   复杂多步难)。具体 API 需按当前 `@mlc-ai/web-llm` 版本确认。
3. **微调专属小模型** — LoRA + 造数据 + 编译 MLC/WebLLM。能抬一点天花板,但重、上限有限,
   ROI 通常不如 1、2。与 pi/langchain 无关。
4. **pi / langchain** — 对"本地模型能力不足"这个问题是**错的层级**,不解决能力,不必引入。
   自研 `agent-core` 已覆盖它们的编排职能。

## 天花板是物理约束

真正跳过小模型天花板只有两条:① 用更大的**本地**模型(Ollama 在本机跑 7B+);② 用**云端**大模型
(需 key)。推理时优化(含约束解码)与微调都只是在天花板附近腾挪。因此产品上的现实架构是:
**本地/离线模式做简单单步任务(约束解码兜底),复杂任务优雅降级或提示切云端**——这也正是项目
现有 chat-only + 多 provider 切换的设计意图。

## 建议下一步

- **P1**:把 Ollama 打磨成默认本地路径(UI 引导安装 + 推荐 Qwen2.5-7B)。诉求的直接答案,开发量小。
- **P2**:给 `webllm.ts` 做一个约束解码 spike,拿现有 8 个工具跑真实用例,量工具调用成功率提升。
- **不做**:为"用一下 pi/langchain"而迁移 `agent-core`;把它们当作解决模型能力的手段。
