# 本地 IM 质量改进实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 减少错误编辑目标和示例照抄，再以真实任务成功率改进写作与执行。

**Architecture:** 模型输出内容和状态，宿主负责工具、地址与执行。结构化生成独立于普通聊天，保留预览及过期机制。

**Tech Stack:** TypeScript、WebLLM 0.2.85、Vitest、现有编辑器 SDK。

**Spec:** [设计及基线](../../evaluations/2026-09-27-im-quality-design.md)

## Global Constraints

- 默认模型暂不变更；原生工具保持禁用。
- 不修改用户已有 CSV 文件变更。
- 未经真实读回不得把操作称为已验证。

## Review Focus

- 模型返回 unsupported 或额外字段时不能产生可执行提案。
- 模型自行输出地址时不能绕过宿主绑定。
- 多选、光标移动、取消及重置不能执行旧提案。
- JSON 合法但事实错误仍须记录为失败。
- 不支持约束解码的后端必须明确保留严格解析的边界。

## Task 1：生成协议与目标绑定

Files: `packages/agent-core/src/llm/{types,webllm,action-plan}.ts`、`lib/agent-plugin/{reviewed-action,ui/panel}.ts`；测试 `test/unit/agent-action-plan.test.ts`。

- [x] 添加协议拒绝、内容映射、绑定地址和结构化生成的回归测试，先运行确认失败。
- [x] 增加可选 `generateJSON(messages, schema, signal)` 接口；WebLLM 使用 `response_format: {type:'json_object', schema: JSON.stringify(schema)}`、任务专属提示与 temperature=0。
- [x] 将模型输出改为 `{status,content}`；应用构造 `insert_text` 或 `set_cell`；保留普通后端严格解析。
- [x] 从单个选区计算单元格地址，传入生成；执行前再检查计划地址匹配。
- [x] 运行单测、类型检查，记录结果。

## Task 2：明确写作路由

- [x] 增加聊天、改写、摘要和翻译入口，绑定所选文本并使用写作系统提示。
- [x] 针对空选区、取消、翻译语言及事实保留进行测试。

## Task 3：执行读回

- [x] 为 DOCX/XLSX 添加不移动用户选区的内容读回，检查实际变化。
- [x] 验证失败使用独立状态，不重试写入；真实浏览器验证确认前无修改、确认后内容和 Undo。

## Task 4：模型对照与完成记录

- [x] 使用相同任务集对比 1.7B 和 4B，保存原始输出和时延；根据证据决定默认值。
- [x] 独立代码审查，完整测试、lint 和生产构建；更新阶段状态与已知限制。

## 第一阶段验证结果

2026-09-27：71 个测试文件、3,546 项测试通过；`pnpm lint` 和 `pnpm build` 通过。构建仍有已有大文件及浏览器外置 Node 模块警告。独立审查的两个问题已修正并复审，无剩余重要问题。真实探测及失败记录见设计文档。任务 2–4 的完成记录见下文。

## 后续阶段完成记录

任务 2–4 已实施并验证，详见 [实施与模型测评](../../evaluations/2026-09-27-im-quality-implementation.md)。72 个测试文件、3,575 项测试通过；lint 及生产构建通过。默认值未变更，两款模型都未达到通用写作质量门槛。

Ruling: 页眉/页脚/绘图及未知正文定位不使用主正文读取冒充验证，降级为“已发送”——SDK 的读取不覆盖这些容器——代价是这些位置的编辑仍需人工核对。

Ruling: 数字校验保留原始标记，文字体系仅做明显冲突拦截——避免小数逗号误归一化及错误语言直接应用——代价是合法数字本地化可能被拒绝，拉丁语言之间的混淆仍不能自动识别。

独立审查的两个重要问题（小数逗号、lone CR 软换行）均以失败测试复现后修正；正文容器边界已添加降级测试。真实模型的隔离缓存失败和普通上下文加载成功均保留证据，不推断未验证的根因。
