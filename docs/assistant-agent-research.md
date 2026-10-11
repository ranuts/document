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
