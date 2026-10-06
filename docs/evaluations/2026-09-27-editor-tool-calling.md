# 本地模型调用 DOCX / XLSX / PPTX 工具调研过程与结果

日期：2026-09-27。结论：**编辑器工具可以由程序直接调用，但当前本地聊天模型路径不能直接驱动它们。**
本次通过 Chrome DevTools 检查真实编辑器与固定 SDK 的请求校验，没有让模型自动修改用户文件。
只使用隔离上下文内新建的空白测试文件。

## 调研问题与环境

调研分别回答三个问题：项目有哪些可调用工具；固定版本运行时是否接受模型工具请求；
工具执行后真实编辑器内容是否变化。最后才判断能否组成模型自主调用链，避免将任何单个环节的成功当作端到端成功。

环境为 Chrome 153、macOS 15.5、Apple M1 Pro / 16 GiB、localhost Vite 开发服务。
WebLLM 固定 0.2.85，wllama 固定 3.6.1。模型请求校验使用静态测试页面，
编辑执行使用单独的 `editor-tool-validation` 隔离上下文。
原始 JSON 中的 pageId 只是本次浏览器会话标识，不是可复用的文档 ID。

## 实际调研过程

| 顺序 | 检查方法与对象                                                                      | 得到的证据                                                              | 如何影响判断                               |
| ---- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| 1    | 阅读 tools.ts、editor-bridge.ts、runtime.ts 与聊天面板                              | 找到 8 个编辑工具、同源 iframe 调用方式及工具循环；面板设置 chatOnly    | 编辑能力和模型调用能力需要分别验证         |
| 2    | 阅读 web-mcp.ts                                                                     | 找到 7 个文件级工具；与聊天面板注册表不同                               | WebMCP 注册不等于本地模型已接入            |
| 3    | 对照官方资料与安装 SDK 源码 / 类型                                                  | WebLLM 固定版本只接受指定 Hermes；wllama 类型包含工具字段，项目没有传递 | 区分上游支持、版本限制与项目接入缺口       |
| 4    | 打开 `/editor?new=docx&agent=1`，等待 SDK 的 isDocumentLoadComplete / isLoadFullApi | 插入 50 字符测试文本，读取一致，开启修订模式返回 true                   | DOCX 简单编辑工具真实可执行                |
| 5    | 打开对应 `new=xlsx` 页面，写 B2 并读回；尝试 Word 专用工具                          | 值为 1250；修订模式被拒绝                                               | XLSX 定点写值可用，类型 guard 生效         |
| 6    | 打开对应 `new=pptx` 页面，插入文本后读取                                            | insert_text 返回成功，全文读取为空；Excel 专用工具被拒绝                | 出现矛盾，不能仅依据工具成功返回值下结论   |
| 7    | 检查 PPT SDK 当前选择及幻灯片形状文本                                               | 选择为 drawing；第三个形状包含 PPTX tool probe                          | 确认插入成功，定位到读取范围不覆盖形状文本 |
| 8    | 将真实工具 schema 转换成 SDK function tools，调用请求校验                           | 四个 Qwen 均报 UnsupportedModelIdError                                  | 当前原生调用在推理前就被 SDK 阻断          |
| 9    | 执行相关定向单元测试并保存原始 JSON                                                 | 67 项工具/循环/WebLLM 测试、5 项 wllama 测试通过                        | 程序契约通过，仍不能证明模型调用质量       |
| 10   | 关闭本次新建测试页面，整理边界与实施建议                                            | 未修改用户文档；没有新增自动写入路径                                    | 留存证据，保持实验能力声明准确             |

官网资料访问中，工具示例目录与独立高级文档页面未成功返回内容；
后续使用成功读取的官方 README、配置源码以及本地已安装 SDK 检查，未将访问失败视为能力不存在。

## 复现关键检查

在新建的隔离测试文件上，通过 Chrome DevTools 执行以下等价步骤。
工具从 `/lib/agent-plugin/tools.ts` 导入；桥接从 `/lib/agent-plugin/editor-bridge.ts` 导入。
调用前必须确认编辑器已加载，不要在用户正在编辑的文件上运行这些写操作。

```ts
// DOCX：插入、读回、修订开关。读取全文会改变选区。
await agentTools.insert_text.execute({
  text: 'DOCX tool probe: budget 1,250 EUR, due 2026-10-08.',
});
// 等待编辑器应用变更后读取；本次等待约 400 ms，并核对内容。
await agentTools.get_document_text.execute({});
await agentTools.set_review_mode.execute({ enabled: true });

// XLSX：在另一个新建表格中运行，写入后等待应用再读回。
await agentTools.set_cell.execute({ cell: 'B2', value: '1250' });
await agentTools.get_cell.execute({ cell: 'B2' });

// PPTX：在另一个新建演示文稿中运行。
await agentTools.insert_text.execute({ text: 'PPTX tool probe' });
await agentTools.get_document_text.execute({}); // 本轮得到空字符串。
```

PPT 检查进一步访问了 `api.WordControl.m_oLogicDocument.Slides[0].cSld.spTree`，
并逐形状调用 `getText()`。这是用于定位问题的内部 SDK 检查，不应直接作为稳定的产品接口。

SDK 校验步骤：使用 `toLLMToolDefs(agentTools)` 转换定义，再将每项映射为
`{ type: 'function', function: { name, description, parameters: inputSchema } }`。
对每个模型调用安装包导出的 `postInitAndCheckFieldsChatCompletion`，传入用户消息、
`tools`、`tool_choice: 'auto'` 与 `ModelType.LLM`。这一步无需下载权重，不运行模型生成。

本轮实际验证命令为：

```sh
pnpm exec vitest run test/unit/agent-tools.test.ts test/unit/agent-runtime.test.ts test/unit/agent-llm-webllm.test.ts
pnpm exec vitest run test/unit/wllama-provider.test.ts
```

首次定向命令还包含不存在的 `agent-llm-wllama.test.ts`，实际仅匹配到前三个文件；
确认真实文件名后，单独运行 `wllama-provider.test.ts`，因此最终是 4 文件 / 72 项。
没有将未匹配的路径计为通过测试，也没有重新运行或声称全量 E2E 已通过。

## 当前工具与真实执行结果

聊天工具定义见 [agentTools](../../lib/agent-plugin/tools.ts)。

| 文件 / 操作                     | 当前工具                                      | 本次结果与边界                                                                  |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| DOCX 插入与读回                 | insert_text、get_document_text                | 插入预算及日期短句，读回一致                                                    |
| DOCX 修订模式                   | set_review_mode                               | 开启后 SDK 返回 enabled=true；未测试接受/拒绝修订                               |
| XLSX 单元格                     | set_cell、get_cell                            | B2 写入字符串 1250，读回一致；没有验证公式、范围或工作表选择                    |
| PPTX 插入                       | insert_text                                   | 文本已进入当前幻灯片的一个形状；通过 SDK 内容检查确认                           |
| PPTX 全文读取                   | get_document_text                             | 返回空文本；选择类型为 drawing，实际形状已有文本。不能将此工具视为 PPT 全文提取 |
| 选区替换与批注                  | get_selection、replace_selection、add_comment | 已有通用接口；本次未逐编辑器复测，不作为新增通过项                              |
| 创建幻灯片 / 版式 / 图表 / 动画 | 无专用工具                                    | 尚未提供；通用文本插入不能替代完整演示文稿生成                                  |

错误编辑器的调用被现有 guard 拒绝：XLSX 的 set_review_mode、PPTX 的 set_cell 均报不支持。
get_document_text 与 get_cell 都可能移动选区，readOnlyHint 不代表没有界面副作用。
工具返回 inserted=true 只是同步 API 调用返回；本次以读回或 SDK 形状内容确认实际结果，未验证保存重开。

另有 [WebMCP 工具](../../lib/web-mcp.ts)：open_document_url、open_document_buffer、
create_document、save_document、get_document_text、set_readonly、get_document_state。
它们覆盖 DOCX / XLSX / PPTX 的文件级操作，但不是聊天面板当前传给 runAgent 的工具注册表。
WebMCP 的注册、模型选工具、程序执行工具是不同环节；注册本身不证明本地模型能调用。
create_document 会替换当前打开文件，不能直接作为无条件自动执行动作。

## 运行时支持与当前接入

| 路径                   | 运行时 / 模型要求                                                                             | 当前项目                                                              | 能否直接让当前本地模型编辑                    |
| ---------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| WebLLM 原生工具调用    | 固定 0.2.85 的 functionCallingModelIds 为指定 Hermes 7B/8B 变体                               | 面板强制 chatOnly=true；当前四个 Qwen 不在支持表内                    | 不能                                          |
| wllama 原生工具调用    | 固定 3.6.1 类型定义包含 tools / tool_choice；上游 v3 声明支持工具调用。具体模型与模板仍需实测 | provider 忽略传入的工具参数，没有把 tools 发送到 createChatCompletion | 不能；需新增适配与真实模型测试                |
| 文本 / JSON 操作计划   | 普通文本模型提出结构化建议，由应用检查并执行                                                  | 尚无 JSON 计划解析、审批与执行通路                                    | 可以作为实施方向，当前未实现                  |
| 云端 / Ollama 工具路径 | 支持原生工具调用的 provider 与模型                                                            | runAgent 已有调用执行与结果反馈循环                                   | 本次未运行，没有远程 key 也不影响上述本地检查 |

官方来源：[WebLLM 配置源码](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)、
[wllama 工具能力说明](https://github.com/ngxson/wllama#readme)。
实际限制以安装的 0.2.85 / 3.6.1 及项目适配器为准，而不是上游主分支能力推断。

本次将真实编辑工具定义转换为 SDK 的 function tools，直接调用
postInitAndCheckFieldsChatCompletion 进行请求校验。
Qwen3-1.7B、Qwen3.5-0.8B、Qwen3.5-2B、Qwen3-4B 均得到 UnsupportedModelIdError。
这是**未加载模型的 SDK 协议校验**，不计为模型推理失败，也没有测试其 JSON 规划准确率。
无需下载模型就能确认取消 chatOnly 仍无法走当前 SDK 的原生工具路径。

## 建议实施顺序

1. 先按编辑器类型提供工具能力集合，并补充可靠的 PPT 形状文本读取和定位。不要向所有文件暴露同一份写工具列表。
2. 以当前 1.7B 实验基准测试小型操作计划：DOCX 插入、XLSX 定点写值、PPTX 当前幻灯片文本建议。先仅生成计划，不执行。
3. 对计划执行严格参数与工具白名单校验，验证当前文档身份、版本、选区或单元格位置；展示修改预览，用户确认后执行。模型输出中的工具名或 JSON 不能自行成为授权。
4. 补齐执行前取消检查、执行后内容确认、错误反馈与撤销验证。当前 runAgent 在收到工具请求后直接 execute，未做通用 JSON Schema 校验或写入确认，不能直接复用于未校验文本计划。
5. wllama 原生工具适配另做对照实验：固定工具能力模型及模板，检查流式参数组装、多步结果反馈、未知工具、错误参数、拒绝无关操作和提示注入。通过前保留可选且实验状态。

优先做应用控制的“建议 → 预览 → 确认应用”流程，因为此前 [348 条模型输出](2026-09-27-model-capabilities.md)
已经暴露语言、日期及注入失败。能生成合法工具参数不等于能做正确修改。
Hermes 大模型路径可以作为后续对照，但本轮没有下载或运行；不能声称它已经可靠支持三种编辑器。

## 证据与验证范围

[原始检查记录](2026-09-27-editor-tool-probes.json)保存四个 Qwen 的 SDK 拒绝结果和真实工具执行结果。
工具、运行循环与 WebLLM 的定向单元测试为 3 文件 / 67 项；wllama provider 的 1 文件 / 5 项也通过。
这些单元测试使用注入引擎或 mock，证明代码契约，不证明工具选择准确率。
本轮尚未完成任何模型到真实编辑器的自主多步调用评测，当前不能发布“本地 AI 可直接编辑三种文件”的能力声明。
