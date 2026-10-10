# Reviewed Local Actions Implementation Plan

> 使用 superpowers:executing-plans 在当前会话内逐项实施。用户已要求开始执行已讨论的下一阶段。

**Goal:** 为实验面板增加人工确认的单次文档修改建议。

**Architecture:** agent-core 提供计划解析与生成；编辑器层捕获身份、history 和位置，拒绝过期计划；独立 UI 展示纯文本预览并确认执行。

**Tech Stack:** TypeScript、Vitest、ranui、现有 WebLLM/wllama provider 与同源编辑器 SDK。

**Spec:** [设计](../specs/2026-09-27-reviewed-local-actions-design.md)

## Global Constraints

保持 WebLLM/Qwen3-1.7B 默认；无自动写入或新依赖；一个白名单操作；计划只消费一次；亮暗主题 token；七语言文案。

## Review Focus

停止后返回的生成结果；同名文件切换；光标变化；只读切换；SDK 内部方法缺失均需阻断应用。

## Tasks

- [x] 写计划解析及取消/工具能力测试，确认失败；实现严格解析及生成协议。
- [x] 写过期、位置变化、只读及重复应用测试，确认失败；实现 editor snapshot 与消费执行。
- [x] 写 PPT 形状读取测试，确认失败；新增只读工具与能力边界。
- [x] 接入修改建议模式、预览/应用/取消及所有失效触发；补七语言与 token 样式，测试流程。
- [x] 真浏览器验证 DOCX/XLSX/PPT、撤销、过期及预览组件亮暗/窄屏；尝试本地模型加载，记录配额阻塞。
- [x] 后续真实验证：24 个修改建议及 DOCX/XLSX 实际面板端到端流程完成；模型语义仍有限制，见 [最新记录](../../evaluations/2026-09-27-indexeddb-validation.md)。
- [x] 运行必要测试、lint、build，检查 diff，记录证据并提交。

## Ledger

Ruling: 在既有 feat/local-multilingual-assistant 工作分支继续，避免搬动用户未提交的 CSV 内容修改；提交只包含本任务文件。
Ruling: PPTX 自动写入延后，因为上一轮显示全文读取不能验证形状插入；本轮先补只读能力。

Evidence: [浏览器验证与限制](../../evaluations/2026-09-27-reviewed-local-actions.md)。Word 撤销接口为 `Undo()`，Cell 为 `asc_Undo()`。模型在编辑器与静态页面共三次加载均因缓存配额失败，未宣称模型端到端已验证。

Review: 独立审查指出 XLSX 粘贴分隔符与空值边界，已拒绝并补回归测试。生产 prompt 明确允许人工审核 JSON 建议，保持没有原生工具和没有自动执行的约束。

Validation: 全量 Vitest 67 个文件、3,521 项通过；oxlint / TypeScript / Docker Compose 配置检查通过；agent-core 与生产构建通过。构建仍有现有大 chunk 提示，测试仍有异步 rejection handled 提示。
