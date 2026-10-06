# Local Multilingual Assistant Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement tasks in this session. Track actual checks below; mock tests are not GPU acceptance evidence.

**Goal:** 无远程 key 的七语言本地写作辅助，并以实际设备评测控制发布。

**Architecture:** 复用 provider 和实验面板，通过 Dedicated Worker 隔离模型推理。固定任务输出经过预览、文档版本和选区校验后才能写入。

**Tech Stack:** TypeScript, Vite, WebLLM, Vitest, existing editor SDK and ranui.

**Spec:** `docs/superpowers/specs/2026-09-26-local-multilingual-assistant-design.md`

## Global Constraints

- 七语言：zh-CN、en、ja、ko、de、es、pt。
- 保留 `?agent=1` 实验入口；真实评测完成前不宣传正式 AI 功能。
- 不修改用户的 `content/zh-CN/convert/csv-to-xlsx.md`。
- 不加入 Pi/Jev，不在 Service Worker 内执行推理，不自动下载模型。

## Review Focus

- 初始化失败后重试必须重新创建引擎。
- 加载期间取消或切换模型不得残留 Worker。
- 文档编辑与推理并行时，资源不足不能破坏文件。
- 混合语言的输出必须按任务保留原文或使用明确翻译目标。
- 文档或选区变化后禁止应用旧建议，即使文字恰好相同。

## Task 1: Worker 和 provider 生命周期（首批实施）

Files: `packages/agent-core/src/llm/webllm.ts`, `webllm.worker.ts`, `factory.ts`, `test/unit/agent-llm-webllm.test.ts`。

Interfaces: 保留 `chat/chatStream/preload`；新增 `dispose(): Promise<void>` 和可注入异步引擎工厂；就绪仅表示引擎已加载。

- [x] 增加回归测试，验证加载失败重试、加载时 abort、串行生成、卸载后不可用、无 key 不回退云端。
- [x] 运行 `pnpm test -- test/unit/agent-llm-webllm.test.ts`，确认新行为失败。
- [x] 使用 Worker 引擎、真实 adapter/feature 探测、失败 Promise 重置和明确资源释放；模型改为小型多语言候选。
- [x] 更新面板显示内存估算，阻止未加载时发送，并在 provider/model 改变时释放资源。
- [x] 重跑 provider 测试；执行 `pnpm run lint:ts` 和 `pnpm build` 检查 Worker 产物。

## Task 2: 七语言任务与评测基线（首批实施）

Files: `packages/agent-core/src/llm/writing-task.ts`, `test/unit/agent-writing-task.test.ts`, `docs/evaluations/local-writing.md`。

Interfaces: `buildWritingMessages({ task, text, targetLanguage? }): LLMMessage[]`，任务为 rewrite/summarize/translate。

- [x] 测试空输入拒绝、翻译必须有有效目标、润色/摘要不受 UI 语言影响、文档内指令不进入系统指令。
- [x] 运行 `pnpm test -- test/unit/agent-writing-task.test.ts`，确认新增接口缺失。
- [x] 编写独立任务提示，不注入界面语言，不允许生成模型直接修改文档。
- [x] 保存七语言样本文本、人工评分标准和浏览器实测表；所有未执行结果标为未测。
- [x] 运行七语言任务测试和完整 `pnpm test`。

## Task 3: 选区预览与应用界面（依赖前两项）

Files: `lib/agent-plugin/ui/panel.ts`、独立选区工作流模块、`editor-bridge.ts`、七语言消息表、面板样式及对应测试。

- [ ] 在真实文字编辑器确认文档版本事件和稳定选区定位 API；如果无法获取定位，保持复制建议，不开放替换按钮。
- [ ] 添加任务按钮与目标语言选择，用 Task 2 的提示生成独立建议；不要把摘要自动覆盖原文。
- [ ] 原文/建议对照、明确应用和取消；捕获文档变化后使建议失效，并测试相同文字不同位置。
- [ ] 对话默认不落盘；增加主动保存选项和独立删除模型入口。
- [ ] 完成七语言标签、键盘交互和亮暗主题；运行相关 unit/e2e。

## Task 4: 真实模型与发布验收

- [ ] 使用 `docs/evaluations/local-writing.md` 对比 Qwen3-1.7B 与 Qwen3.5-2B；逐语言记录质量与性能。
- [ ] 测试冷启动/热启动、停止、失败重试、编辑并行、离线重新打开、模型切换、存储不足及 GPU 丢失。
- [ ] 按结果确定默认模型、设备范围和各语言可发布的任务，补齐实际分发许可。
- [ ] 通过验收后更新 README/SEO 文案，再移除实验门控。

## Execution record

开始：2026-09-26，分支 `feat/local-multilingual-assistant`。用户已授权直接实施；前两项构成首批可自动验证交付，后三项中的真实编辑器/GPU证据须如实记录。

### 首批验证记录

- Task 1 / Task 2：已实现代码及评测协议；`pnpm run lint:ts` 通过，`pnpm test` 63 文件 / 3484 测试通过，`pnpm run build` 通过并生成独立 Worker。
- RED→GREEN：初始化重试、串行请求、卸载后的请求结算、未加载时保留草稿、SDK 成功加载后自行卸载的通知、多语言任务输入契约。
- 独立代码审查：两项 Important 均已增加失败复现测试并修复。GPU 丢失通知依赖固定 SDK 0.2.85 的 `engine.unload` 路径，升级时需复核；尚未在真实 GPU 上验收。
- Deferred minor：同模型的缓存检查可能覆盖加载进度/已加载提示；不影响 provider 就绪状态与推理，但 Task 3 应以状态版本保护 UI 提示。
- Review rulings：真实 GPU 质量、性能、离线完整性及资源回收时机仍属于 Task 4，未测结果不得标为通过；未来选区应用及发布状态仍按 Task 3/4 的门控执行。若跳过这些验收，会有语言质量、资源不足或错误选区编辑风险，因此实验门控继续保留。
- 构建日志仍有 SDK 的 Node 模块浏览器外置及大 chunk 提示；测试日志有 PromiseRejectionHandledWarning，没有测试失败。不能将构建成功描述为无警告。
- Task 3 / Task 4 尚未完成；本次没有下载多 GB 权重、执行真实推理或开放正式 AI 功能。
