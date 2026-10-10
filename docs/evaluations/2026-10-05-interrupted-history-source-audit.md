# Interrupted conversation source audit

Current source inspected after `56c3988`; diagnostic evidence is `2026-10-05-stop-visible-partial.json`. This is a source audit and proposed bounded repair, not an implemented repair or model-quality acceptance.

## Confirmed behavior

`lib/agent-plugin/ui/controller.ts` saves the user message before inference. Stream presentation emits sanitized visible deltas but does not retain them in history. A rejected aborted inference emits a stopped status without saving a partial assistant response. The resolved `result.aborted` path likewise replaces history with runtime messages, which omit an interrupted in-flight response. Thus the live visible answer can disagree with saved/model history. `historyToTurns` reconstructs only saved messages; the displayed partial cannot survive reopening from those messages.

`packages/agent-core/src/runtime.ts` checks abort before pushing a returned assistant. Tool exchanges are separately recorded through `onToolExchange`; these must remain intact. `AssistantDisplayStream` suppresses leading reasoning and ambiguous tool JSON. Raw SDK chunks are therefore not an authoritative source for what the user saw. Calling its normal finish path on cancellation could reveal previously held incomplete content and must be avoided.

Existing controller tests cover rejected cancellation status, disposal detaching late results, streamed completion and tool persistence. They do not prove that visible interrupted text survives saving, reopening or the next request. The browser diagnostic inserts actual visible source only into count/completion requests; it does not fix these source-level invariants.

## Proposed bounded repair and acceptance

Retain exactly the presentation deltas emitted for the current in-flight assistant segment. On explicit user cancellation, save that visible partial as assistant content and a truthful stopped status, preserving prior completed turns and verified tool exchanges. Track segments so an already completed assistant response is not duplicated when a later tool/iteration is cancelled. Do not flush held reasoning/tool JSON. An empty partial still needs a truthful stopped boundary. Model faults remain errors; disposal/reset must continue rejecting stale writes. Use existing session and host-guidance conventions rather than adding preview or confirmation UI.

Regression coverage must exercise both resolved-aborted and rejected-aborted paths, hidden reasoning, empty partial, completed earlier turns, tool exchange followed by interrupted follow-up, save/reopen, provider disposal and reset, and the next request containing the preserved history. Review context-budget handling of status metadata before choosing its representation. Then verify the production browser with no diagnostic message substitution. Current-label correctness and strict formatting remain separately reported; one 0.5B result cannot justify general model promotion.
