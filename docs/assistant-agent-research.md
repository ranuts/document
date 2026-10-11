# Agent integration research and implementation scope

## Evidence

- Continue's [agent loop](https://docs.continue.dev/ide-extensions/agent/how-it-works)
  sends available tool definitions, applies tool permissions, executes calls,
  and returns results for the next inference.
- Open WebUI's [tools documentation](https://docs.openwebui.com/features/extensibility/plugin/tools/)
  recommends native function calling and documents small-model JSON and chaining
  failures. Its parameter-count guidance is a product recommendation, not an
  acceptance threshold for this editor.
- Qwen's [function calling guide](https://qwen.readthedocs.io/en/stable/framework/function_call.html)
  recommends model-specific tool templates and warns against stopword-based
  ReAct parsing for reasoning models. A JSON-only response proves syntax, not
  intent accuracy. The browser WebLLM adapter currently forwards native tools
  only for supported Hermes models; Qwen browser presets are chat-only.
- Aider's [modes](https://aider.chat/docs/usage/modes.html) separate planning and
  editing. Anthropic's [workflow guidance](https://www.anthropic.com/engineering/building-effective-agents)
  distinguishes bounded workflows from autonomous agents; adopt the least
  complex approach that works for the available model.
- The user-provided deepseek-harness reference separates agent-loop scheduling,
  tool schemas/execution policy, durable tool results, repeat-call reminders,
  and assistant stream assembly. Relevant source: packages/core/agent-loop/src/
  tool-calls.ts; packages/core/tools/src/json-schema.ts;
  packages/guard/repeat-tool-reminder/src/index.ts; packages/llm/llm/src/
  assistant-stream.ts. This is a source study, not copied implementation.

## Current problems

The editor has native adapters and a provider-neutral loop, but ordinary panel
chat exposes no tools. A separate task router chooses a single-operation planner;
this prevents natural read/result/write requests from using the existing loop.
Literal shortcut grammars are compatibility conveniences, not a general agent.
The generic runtime dispatches model arguments without JSON Schema validation,
has only an iteration bound, and does not distinguish a pending proposal from
an executed mutation. Browser small models cannot be treated as verified native
function callers. Reasoning, conversation prose, document artifacts and execution
receipts have different meanings and must not share write actions.

## Scope and design

Reuse AgentTool/LLMProvider/runAgent and existing native editor transactions.
Add a standard JSON Schema validator that works under the production CSP without
runtime code generation. Validate before every dispatch. Bound total tool calls,
stop duplicate mutations, preserve a result for each requested call on cancellation
or policy refusal, and expose terminal tool outcomes without fabricating prose.

Use native tools only for provider transports that explicitly advertise support.
Expose only current-editor capabilities and exclude mutations in read-only mode.
Bind the document/version/selection before inference. Reads can feed subsequent
calls; mutations use the existing review and native readback pipeline and conclude
the turn. Pending review is a tool outcome, never execution success. The browser
small-model path stays a constrained workflow, with no silent remote escalation.

Keep current UI, seven-language messages, cache/active lifecycle, editable
speech drafts, native Undo, cancellation, conversation persistence and local-first
behavior. Do not edit the reference repository, SDK vendor files, PWA/CSP policy,
or add generated-code execution. Do not expose raw reasoning as document text.

## Acceptance

Scripted protocol tests must reject invalid arguments, unknown tools, repeated
mutations, excessive calls and cancelled dispatch; maintain paired tool history.
Native editor tests must cover current scope, read-only protection, stale targets,
review versus execution and native Undo. Provider tests cover native tool payloads
and results. Real-model evaluation is separate from infrastructure tests and must
include paraphrases, negation, clarification, seven languages and unsupported tasks;
small-model presets are not promoted based on a single successful example.

This extends the previous repair without discarding its uncommitted changes.

## Feedback mapping and verification (2026-10-11)

| Feedback                                                 | Shared mechanism used                                                                                          | Evidence                                                                                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot read or operate Word/Excel/PPT                    | Editor-scoped tool registry, fresh bounded context, native adapters                                            | Real Word read/write/clear/Undo; Excel numeric A1:A100 plus CSV; PPT shape write/read plus PPTX, recorded in assistant-tool-workflow.md            |
| Model promises changes but nothing happens               | Call/result protocol, pending-review receipts, native readback; tool-call prose is not displayed as completion | Scripted read-result-next-inference-write sequence; pending review never invokes a mutation; streamed and non-streamed false-completion regression |
| Every reply has a write button                           | Distinct conversation and document-artifact roles                                                              | Artifact-only write regression; generated body excludes conversation framing                                                                       |
| Empty Sheet1/A1 preview                                  | Only nonempty selection is shown; background context includes the sheet used range                             | Request-context and panel tests; actual empty-sheet UI                                                                                             |
| Downloaded model still needs loading; buttons do nothing | Disk cache and active runtime have separate states; active button is disabled                                  | Cache/loading/panel regressions and live cached-model load feedback                                                                                |
| Voice is complex or fails silently                       | Direct start/stop, interim/final editable draft, no auto-send, localized failure states                        | Speech regressions; actual microphone accuracy remains unmeasured                                                                                  |
| Excessive settings and redundant actions                 | Existing component conventions, compact model/service settings, context-aware copy                             | Panel, chat and localization regressions; no new permanent tool-mode controls                                                                      |
| Small models may choose incorrect tools                  | Bounded structured workflow, capability filtering, schema validation, stale/readonly guards, review, budgets   | Guard tests establish infrastructure correctness, not model intent quality                                                                         |

The native endpoint path now uses the endpoint controller even for operation
requests. Tool-bearing streamed text is held until it can be classified: a response
containing calls cannot display its accompanying prose as a completion receipt.
Partial, unclassified tool-bearing streams are not archived as completed answers.
Completed call/result exchanges remain durable through interruption.

A standard non-code-generating validator (`@cfworker/json-schema`) replaces the
handwritten flat JSON Schema interpreter. Editor-specific limits (range size,
formula-like text, target overlap and transaction support) remain domain policies.
The JSON Schema dependency does not require relaxing production CSP.

Final regression run: 161 files / 4858 tests passed. Type checking, archive-aware
lint, formatting and production build passed. The native endpoint tests use
scripted protocol responses; they do not establish a remote model's quality.
Reference source and native tool-call documentation inform the protocol; neither
is a guarantee that a small browser model can reliably plan arbitrary tasks.

Acceptance of a model must score held-out requests by actual editor state and
wrong-mutation rate, not JSON validity or a judge reading completion prose. Cover
paraphrases, negation, absent/ambiguous targets, unsupported operations, multi-step
reads/writes, all seven languages, cancellation and changed context. Keep failed
cases as evaluation evidence rather than silently turning them into shortcut
regular expressions or promoting a larger model without measurement.

### Small-model counterexample and execution policy

A fresh real Qwen3 1.7B session was asked in Chinese to fill rows from A1 with
numbers 1 through 10, using a paraphrase rather than the original demonstration.
The model chose get_cell and returned the empty A1 content. This failed the task;
no numeric fill occurred and the host did not report a completed fill. A trial
with separate capability selection and argument generation still chose get_cell,
so that extra inference stage was removed rather than increasing latency without
measured benefit. No special regex was added for this wording.

All model-selected mutations, including fills into an empty range, now require
preview approval. This uses the existing shared review workflow for native calls
and bounded plans; an empty destination is not evidence that intent is correct.
Direct, host-owned operations retain their independently validated behavior.
The 1.7B default remains experimental for general natural task planning.

Final live acceptance after the policy change: the original natural Excel
request generated an A1:A100 preview. Confirmation wrote all 100 numeric cells;
the editor showed count 100, minimum 1, maximum 100 and sum 5050. One native Undo removed the entire fill and enabled Redo. The active-model
button read In use and was disabled. This successful request does not erase the
failed paraphrase recorded above.

### Rechecked upstream direction and current-model acceptance

On 2026-10-11 the [Open WebUI tool guidance](https://docs.openwebui.com/features/extensibility/plugin/tools/) explicitly identifies native function calling as its supported default and prompt-based tool selection as legacy. It recommends a stronger tool-calling model when native calls are unreliable. This does not make an existing chat-only browser adapter a native caller. [Anthropic’s workflow guidance](https://www.anthropic.com/engineering/building-effective-agents) supports bounded workflows and measured evaluation before adding complexity. Applied here: keep the editor execution protocol and scoped review independent of model interpretation; qualify transport and task quality separately, with no silent remote fallback.

A current-code Qwen3 1.7B Word session correctly distinguished an empty document from earlier chat, but failed a preview-only exact-content request by adding unsolicited content. A second natural insertion request retained the instruction prefix in the proposed body. A spring-to-winter revision returned unchanged text. None of these proposals was applied; independent file readback stayed empty. These fresh failures confirm that infrastructure regression success does not qualify the default model for general document editing. They also identify an application issue to address: unchanged refinements must not be represented as revised suggestions or supersede their original review.

### Qwen3 sampling configuration check

The [Qwen3 1.7B model card](https://huggingface.co/Qwen/Qwen3-1.7B/blob/main/README.md) recommends temperature 0.7 and top-p 0.8 for non-thinking generation. The browser adapter had forced temperature 0 for schema-constrained responses. Qwen3 structured responses now respect configured sampling (default 0.7); other model families retain their previous behavior. This follows upstream settings, not a demonstrated general accuracy fix.

In a fresh real-model comparison, the exact insertion preview omitted the instruction prefix after this change, but a spring-to-winter refinement still returned unchanged content. The original pending review was correctly retained and no write was approved. One successful preview does not qualify the model; refinement quality remains an open acceptance requirement.

The sampling regressions passed 45 tests after rebuilding package exports. The complete unit run passed 165 files / 4,928 tests. Eleven actual Word, spreadsheet/CSV, presentation and PDF editor cases passed; TypeScript and targeted lint passed. Controlled responses establish host execution behavior, not model semantic accuracy.

### Candidate evaluation protocol

Following [Anthropic’s agent evaluation guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), keep application regression and model capability trials separate. Compare the existing Qwen3 1.7B default and Qwen3 4B candidate with the same current adapter and prompts. Each task starts a fresh conversation and unchanged synthetic file, with three trials; refinement follows its own unapplied proposal. Record requested content, proposed tool/arguments, actual result, failure and response time. Score final native state independently after approved edits and Undo. JSON validity, fluent completion prose and a single correct example are insufficient. No model default changes follow from the initial counterexample checks.

Required task families: grounded reading; exact insertion without instruction prefixes; minimal refinement preserving all other words; preview-only requests; spreadsheet range fill/formula; presentation selected-text edits and new-slide requests; PDF current-page reading and page notes; unsupported/ambiguous tasks; cancellation and changed-target protection. A correct refusal where the editor cannot perform an operation is distinct from a model failing to choose a supported operation.

Seven-language fidelity requests use identical synthetic facts and fixed expected text. Each first asks for an unapplied insertion; each follow-up changes only EUR to USD. All remaining characters must stay unchanged.

| Locale | Initial request                                                                                             | Revision request                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| zh-CN  | 请在文档中添加这一句，先给我检查：Alex owes 1,250 EUR on 2026-10-08.                                        | 只把建议中的 EUR 改成 USD，其他内容保持原样。                           |
| en     | Please add this sentence to the document, showing me the proposal first: Alex owes 1,250 EUR on 2026-10-08. | Change only EUR to USD in the proposal. Keep everything else unchanged. |
| de     | Füge diesen Satz zum Dokument hinzu und zeige mir zuerst den Vorschlag: Alex owes 1,250 EUR on 2026-10-08.  | Ändere im Vorschlag nur EUR in USD. Lass alles andere unverändert.      |
| es     | Añade esta frase al documento y muéstrame primero la propuesta: Alex owes 1,250 EUR on 2026-10-08.          | Cambia solo EUR por USD en la propuesta. Mantén todo lo demás igual.    |
| ja     | 次の文を文書に追加する提案を先に見せてください：Alex owes 1,250 EUR on 2026-10-08.                          | 提案の EUR だけを USD に変えて、ほかはそのままにしてください。          |
| ko     | 다음 문장을 문서에 추가할 제안을 먼저 보여 주세요: Alex owes 1,250 EUR on 2026-10-08.                       | 제안에서 EUR만 USD로 바꾸고 나머지는 그대로 두세요.                     |
| pt     | Adicione esta frase ao documento e mostre primeiro a proposta: Alex owes 1,250 EUR on 2026-10-08.           | Altere apenas EUR para USD na proposta. Mantenha todo o resto igual.    |

These are unrun evaluation requirements until accompanied by actual outputs; they are not passing regression cases. Changes prompted by an evaluation failure must be checked on separate held-out paraphrases. Candidate weights can be downloaded for testing without changing the application’s configured default.

### Initial real Qwen3 4B results

The existing quantized 4B candidate loaded successfully on the 16 GiB test device. Three fresh-conversation trials of “在光标处插入文字：春天来了，小河边开满了花。” produced exactly the requested body. All three follow-up revisions “把建议里的‘春天’改成‘冬天’，其他文字保持不变。” produced “冬天来了，小河边开满了花。” without dropping the remaining words. No suggestion was approved; independent native text readback remained a paragraph newline. This is better observed refinement behavior than the 1.7B counterexample, not a statistical comparison or full model qualification.

A separate request “请在这份文档里新增一句：春天来了，小河边开满了花。先给我看看，不要直接写入。” failed all three fresh trials, displaying “没有找到可读取的文本。” rather than a proposed insertion. There were no browser error/warning logs. This establishes a user-visible planning failure; the observation did not capture the raw chosen tool, so do not attribute it to a specific read tool.

A single planner-prompt intervention clarified intended modification versus later approval, leaving model settings and routing unchanged. The same request still failed. The ineffective line was removed rather than layering more instructions or adding a phrase-specific regex. Two routing/planner unit files passed 130 cases during the trial; this did not prove the failed real request correct. Further multilingual, cross-editor and native-state qualification remains necessary. The application source default was not changed.

### Seven-language first trial, Qwen3 4B

Ran the fixed requests above in seven fresh conversations, with the UI kept in Chinese and identical English literal content. This measures multilingual instructions around one body, not seven localized UI variants or seven native-language prose bodies. No suggestion was approved. Independent native readback after all cases was a paragraph newline. Raw user-visible transcripts are retained in ignored evaluation output, not product documentation.

| Request language | Initial proposal         | EUR-only revision             |
| ---------------- | ------------------------ | ----------------------------- |
| English          | Exact body               | Exact USD body                |
| Chinese          | Failed: no readable text | Not run: no original proposal |
| German           | Exact body               | Exact USD body                |
| Spanish          | Exact body               | Exact USD body                |
| Japanese         | Exact body               | Failed: unchanged EUR body    |
| Korean           | Exact body               | Exact USD body                |
| Portuguese       | Exact body               | Exact USD body                |

Numbers, name and date were preserved in every successful proposal. The unchanged Japanese response retained the original proposal with explicit feedback instead of replacing it or reporting execution. These are first-trial observations, not repeatability scores. The remaining repeated trials, held-out paraphrases, native-language bodies and cross-editor state checks remain open. No default model promotion.

The [Qwen3.5 2B model card](https://huggingface.co/Qwen/Qwen3.5-2B/blob/main/README.md) recommends different sampling for non-thinking text tasks than Qwen3; it also says the Qwen3 soft thinking switch is unsupported. The current adapter correctly limits that soft switch to Qwen3-. Before comparing 3.5 candidates, distinguish the actual runtime configuration from upstream recommended settings. Do not assume 4B is the best browser candidate solely from parameter count or this partial test.

### Native spreadsheet and presentation first trials, Qwen3 4B

In the same real browser runtime after loading 4B, switching from Word to spreadsheet and presentation preserved the loaded model. A fresh spreadsheet conversation requested a column from the current cell with integers 1 through 10. The review showed A1:A10 and the requested values. Before approval, CSV export contained only its byte-order mark. After approval, independent CSV decoding contained exactly 1 through 10 in separate rows; one native Undo restored the original export. This is one blank-sheet trial, not evidence about populated-sheet preservation or repeated model accuracy.

A fresh presentation conversation requested one additional slide at the end of the one-slide file. Approval changed the native view to two slides; one native Undo restored one. Independent PPTX XML inspection counted slide references as 1 before, 2 after and 1 after Undo. The trial also exposed raw JSON in the pending review. Add/duplicate slide reviews now use localized operation descriptions in all seven interface languages, while retaining the captured target and approval boundary. Two unit regressions reproduced the JSON display before repair and passed afterward; a controlled-provider real-editor case verifies plain-language review, no change before approval, actual slide addition and Undo. This controlled-provider case does not establish model quality.

The real-model trial records are stored in ignored evaluation output. PDF model selection and reading/comment trials, repeated cross-editor tasks and localized content bodies remain open. The default model is unchanged.

### Native PDF first trial, Qwen3 4B

Loaded the cached 4B model in an independent browser page and opened a one-page synthetic PDF with selectable text, “Budget is 120. Please review it.” A fresh request “当前 PDF 页面写的预算是多少？请只回答金额。” returned the page-scoped source text rather than the requested amount. Inspection found that the application renders read-only planner results directly; it does not continue with a grounded answer to the original question. This is an application orchestration gap, not sufficient evidence of model comprehension failure. The general repair must cover read tools across editor types, preserve result scope and cancellation/context checks, and avoid introducing an editor mutation or claiming more content than was read.

In a separate fresh conversation, “请在当前 PDF 第 1 页添加批注：Review this budget.” produced exactly that pending page-one note. Native export before approval had zero notes; after approval, independent PDF parsing found exactly one Text annotation with Contents “Review this budget.”; one native Undo restored zero notes. All three exports preserved the original page text and page count. This is one actual model trial, not repeated qualification. Reading-to-answer orchestration remains an explicit acceptance defect.

### Product default change after the first trials

At the user's explicit request, the browser GPU preset list now contains only Qwen3 4B. The former 1.7B, 2B and 0.8B presets are retained solely as cache identities so previously downloaded files remain discoverable and removable without a Use action. Restored retired preset/task choices fall back to 4B. The preparation script also defaults to 4B. This is a product selection decision, not a model-quality acceptance result; the failures above remain open. Custom model sources and the existing CPU path are separate from this preset change.
