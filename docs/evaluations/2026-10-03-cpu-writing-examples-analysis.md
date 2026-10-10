# Role-separated writing examples — rejected for default use

The question was whether a different message combination could improve the small CPU model's selected-text writing without weakening the production schema or fact guards. [Claude's prompting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#use-examples-effectively) motivated examples as a hypothesis, not a guarantee for Qwen. [Qwen's quickstart](https://qwen.readthedocs.io/en/stable/getting_started/quickstart.html) supports the existing non-thinking temperature/top-p baseline; those decoding settings were held at 0.7 / 0.8 with 512 maximum tokens.

The first variant replaced the engine system message with compact writing guidance and two bilingual user/assistant example pairs. The neutral variant preserved the provider's existing system message, put compact writing guidance in the first example user message, and left the actual request as a final independent JSON user message. The latter can fit the existing user/assistant LLMMessage interface without changing providers.

**This compares complete prompt combinations, not the isolated effect of adding examples.** Both candidate combinations remove the production request's taskInstruction/WRITING_SYSTEM_PROMPT/JSON-output prefix and introduce different compact guidance. The actual source, instruction, schema, decoding parameters, production validators and native action path were otherwise held constant.

## Authoritative completed observations

All used cached Qwen3-0.6B in desktop Chromium, WebGPU disabled, and actual native four-thread/multithread execution. The same loaded model served each report's requests. Primary reports alternate variant order across two repetitions. The seven-language extension has one current/candidate observation per distinct fixture, always current first; order/prefix reuse is not controlled there.

| Completed report                                | Native applications        | Qualitative quality assessment                                |
| ----------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| System replacement, 12 responses                | current 0/6; candidate 6/6 | Exploratory only; system replacement not adopted         |
| Original provider system retained, 12 responses | current 2/6; candidate 6/6 | Candidate 5/6 acceptable; one summary loses **proposed** |
| Seven-language extension, 14 responses          | current 2/7; candidate 7/7 | Candidate only 2/7 acceptable: Chinese and German        |

The candidate's failures in the extension:

- English keeps **Yo**, failing the formal-register instruction, despite preserving the negative amount and unapproved state.
- Japanese outputs `Lina 2030-02-06 75 USD 未承認承認待ち`: a noun/number string without the payment action or proposal fact, rather than a grammatical faithful summary.
- Korean retains **야** and conversational **낼 거예요**.
- Spanish changes `propuso pagar 75 USD` to `propuso 75 USD`; the payment action is no longer explicit, and the date can attach to the proposal rather than the planned payment. This did not meet the strict fidelity review.
- Portuguese retains **Ei** and **ok?**, failing formalization.

Current Portuguese also applies `isso é bom`, adding an unsupported judgment. In the earlier interrupted extension report, current Japanese applies `承認されており` while the source says the payment has not been approved. That contradiction is a serious semantic failure, not a successful summary. It is retained as diagnostic evidence, excluded from the 38-response completed-report aggregate.

These assessments are qualitative AI reviewer judgments against each fixture's source and instruction, not a general automated language/semantic detector. The observations do not establish statistically reliable quality or absence of example-fact leakage. No final candidate output was observed to copy Mira/980/2031 example facts, but finite examples cannot prove prevention.

## Native behavior and experiment limits

Every applied result in the completed reports restored exact selected text through native Undo and reproduced the applied text through Redo. Rejected results retained the exact original selection. Preview count was zero throughout. This does not prove Save/reopen for these writing results; earlier document-tool Save evidence is separate.

The probe instruments script responses only in its isolated context, without writing generated bundle bytes. Every report verifies the on-disk plugin and engine remained unchanged. It blocks Service Workers, unregisters the isolated origin's registrations and removes only generated agent-plugin/esm script cache entries, retaining model caches. Isolation headers are injected on the historical 5193 server; this is not an actual-host-header or physical-mobile test. No external browser request was observed in these cached-model runs; this is not a complete privacy audit.

The first navigation attempt failed at the missing favicon and generated no model result. The interrupted extension stopped after eight valid observations when immediate selection saw an incomplete native paste; a language-font request was still in flight at teardown. The probe now waits for exact source text before selecting, and waits for route callbacks before closing. The failed report remains. A diagnostic about:blank localStorage access error also remains in the system-replacement report; the later neutral reports guard the init script by origin and have no page errors. It is not asserted that these earlier harness issues were product bugs.

`verify-cpu-writing-examples.py` checks report terminal state, row counts, paired source/instruction/schema/decoding parameters, actual thread count, captured roles, independent final source JSON, native document retention/Undo/Redo and unchanged generated bytes. It deliberately does not label native applications as quality passes. Both candidate prompt combinations are **not adopted**; model defaults, production prompts and IM controls remain unchanged.

The next experiment should test stronger suitable-size models or more diverse task guidance on new fixtures, preserving proposal/negation/action meaning and formal style as separate acceptance criteria. Reusing these now-inspected fixtures for tuning must not be described as an independent heldout quality gate.

Reproduce after building with `node docs/evaluations/probe-cpu-writing-examples.mjs`; the neutral and extension variants use `WRITING_EXAMPLES_VARIANTS=current,neutral-examples`, `WRITING_EXAMPLES_REPORT=<report>`, and for the extension `WRITING_EXAMPLES_REPETITIONS=1 WRITING_EXAMPLES_CASES=docs/evaluations/2026-10-03-writing-examples-heldout-cases.json`. Run only the isolated profile in the script, with no concurrent process using it.
