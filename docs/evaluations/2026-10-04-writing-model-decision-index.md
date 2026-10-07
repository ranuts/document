# Browser writing model decision evidence

No tested candidate in this index has established acceptable seven-language factual writing quality. Keep the existing default provisional; successful document application is not an accuracy metric. This table covers known 21-case fixtures, one sample each, not heldout general accuracy. Loading failures and partial runs are explicitly retained.

| Model/report                                                                                 | Run status | Recorded | Refused | Edited | Accepted unchanged |
| -------------------------------------------------------------------------------------------- | ---------- | -------: | ------: | -----: | -----------------: |
| [Qwen3-1.7B-q4f16_1-MLC](2026-10-04-seven-language-writing-current.json)                     | completed  |       21 |       9 |     12 |                  0 |
| [Qwen3.5-2B-q4f16_1-MLC](2026-10-04-seven-language-writing-qwen35-2b.json)                   | completed  |       21 |      13 |      8 |                  0 |
| [Qwen3-4B-q4f16_1-MLC](2026-10-04-seven-language-writing-qwen3-4b.json)                      | completed  |       21 |       7 |     14 |                  0 |
| [Llama-3.2-1B-Instruct-q4f16_1-MLC](2026-10-04-llama32-1b-seven-language-writing.json)       | completed  |       21 |      14 |      5 |                  2 |
| [gemma3-1b-it-q4f16_1-MLC](2026-10-04-gemma3-1b-seven-language-writing.json)                 | failed     |        0 |       0 |      0 |                  0 |
| [gemma3-1b-it-q4f16_1-MLC](2026-10-04-gemma3-1b-sliding-window-writing.json)                 | failed     |       15 |      11 |      4 |                  0 |
| [gemma3-1b-it-q4f16_1-MLC](2026-10-04-gemma3-1b-full-context-writing.json)                   | completed  |       21 |      20 |      1 |                  0 |
| [Llama-3.1-8B-Instruct-q4f16_1-MLC](2026-10-04-llama31-8b-seven-language-writing.json)       | failed     |        0 |       0 |      0 |                  0 |
| [Llama-3.1-8B-Instruct-q4f16_1-MLC](2026-10-04-llama31-8b-seven-language-writing-retry.json) | completed  |       21 |      10 |     11 |                  0 |
| [Llama-3.2-3B-Instruct-q4f16_1-MLC](2026-10-04-llama32-3b-seven-language-writing.json)       | completed  |       21 |      11 |     10 |                  0 |
| [Qwen3.5-4B-q4f16_1-MLC](2026-10-04-qwen35-4b-seven-language-writing.json)                   | completed  |       21 |       5 |     16 |                  0 |
| [Phi-4-mini-instruct-q4f16_1-MLC](2026-10-04-phi4-mini-seven-language-writing.json)          | completed  |       21 |      12 |      9 |                  0 |
| [Qwen3-8B-q4f16_1-MLC](2026-10-04-qwen3-8b-seven-language-writing.json)                      | completed  |       21 |       3 |     18 |                  0 |
| [Qwen2.5-1.5B-Instruct-q4f16_1-MLC](2026-10-04-qwen25-15b-seven-language-writing.json)       | completed  |       21 |      17 |      4 |                  0 |
| [Qwen2.5-3B-Instruct-q4f16_1-MLC](2026-10-04-qwen25-3b-seven-language-writing.json)          | completed  |       21 |      20 |      1 |                  0 |
| [Qwen2.5-3B-Instruct-q4f32_1-MLC](2026-10-04-qwen25-3b-f32-seven-language-writing.json)      | completed  |       21 |      17 |      4 |                  0 |

These rows are not a controlled ranking: Qwen uses model-specific thinking controls; later code rejects unchanged translations; Gemma diagnostics override incompatible window settings. Qwen failures include changed roles/negation/conditions, while Llama 1B includes untranslated output and lost conditions. Gemma's first catalog run fell back to CPU and executed zero cases, its short-window run stopped after 15 cases, and full-context results showed repeated/length-limited output. Use each report's companion analysis for actual output examples and limitations. Refused outputs preserved source text; this is protective behavior, not task completion.

The machine-readable index binds exact raw report hashes and derives counts from captured rows. Llama 3.1 8B initial shard-fetch failure and completed cached retry are both retained; the completed retry still has wrong-language and semantic failures. Model names and SDK memory estimates alone are not quality or physical-device compatibility evidence. Native Word history checks in these suites do not certify universal Save, formatting preservation, mobile memory or cold offline startup.

Llama 3.2 3B now has a completed 21-case run in this index, rather than relying only on its earlier six-summary diagnostic. Its ten native edits and eleven refusals do not meet the requested quality: wrong-language rewrites, omitted inspection conditions/status and Korean repetition remain. See [its analysis](2026-10-04-llama32-3b-seven-language-writing.md).

These historical reports are not reruns of the latest product. In particular, the later explicit-renminbi-label fix changes one refusal in a separate eight-case default-model regression, whose [analysis](2026-10-04-cny-unit-writing-regression.md) proves identical inputs/raw output and the changed guard outcome. That eight-case run and prompt diagnostics are outside this seven-language baseline index. Historical counts remain unchanged; the fix does not establish overall factual-writing quality.

Qwen3.5 4B completed all 21 cases, with 16 edits and five refusals. Its [analysis](2026-10-04-qwen35-4b-seven-language-writing.md) still documents wrong-language output, altered quantity meaning, omitted status and unclear payment subjects. More native edits are not stronger quality evidence. Phi-4 mini also completed all 21 cases, with nine edits and twelve refusals. Its [analysis](2026-10-04-phi4-mini-seven-language-writing.md) records a wrong year, changed payment direction, wrong-language summaries and unsupported investigation/parking claims. It is not adopted as default.

Qwen3-8B completed all 21 cases, with 18 edits and three refusals. Its [analysis](2026-10-04-qwen3-8b-seven-language-writing.md) shows some faithful condition/attribution outputs but wrong-language rewrites and unsupported investigation/causality claims. It is not adopted. The separate four-case screen is outside this baseline index.

The [payment-fixture correction](2026-10-04-repayment-fixture-correction.md) withdraws categorical English/German repayment-wording failure claims where the source already says pay back/zurückzahlen. Historical raw hashes/counts and no-adoption decisions remain unchanged; language/condition/investigation failures still require resolution.

## Later role and modality diagnostics (outside baseline counts)

The [four-language role contrast](2026-10-04-writing-role-holdout.md) tested eight preregistered paired fixtures with the production and minimal prompts. The minimal prompt reduced refusals but omitted a payment recipient, strengthened Spanish permission to future action, and added an unsupported French planning claim. The [explicit role-constraint follow-up](2026-10-04-writing-role-constraints.md) reused those fixtures as development data: it repaired the observed Spanish modality changes but retained casual tags and returned unchanged English/French source more often. Neither prompt is adopted; execution counts are not semantic accuracy.

These results challenge the assumption that a longer preservation prompt alone solves factual rewriting. The [schema-pressure diagnostic](2026-10-04-writing-schema-pressure.md) keeps the minimal system/user messages and sampling fixed and compares JSON-schema decoding against unconstrained decoding. Its completed run shows six identical paired responses, persistent Spanish/French semantic failures, and two extra-field responses without schema; schema removal is not adopted. This separates decoding pressure from prompt changes but cannot establish general quality on these already-seen development cases. Any eventual change still requires new heldout role/condition fixtures and broader language validation.

The [input-envelope contrast](2026-10-04-writing-input-envelope.md) retains identical minimal system prompt, source, instruction, schema and sampling, removing only user task/targetLanguage fields. It preserves Spanish modality in both known cases and removes one French planning claim, but leaves casual tags and unchanged English source. It shows framing sensitivity without proving a general fix; full/body application counts are not quality scores. No production change is adopted.

The [four-example development contrast](2026-10-04-writing-demonstrations.md) produces faithful formal text on all eight known short cases in manual review, with longer input/latency. Its [frozen multi-clause transfer screen](2026-10-04-writing-demonstrations-transfer.md), preregistered after freezing the candidate, preserves examined roles/negation/modality/status but retains informal wording in two of eight new sources. It also avoids a baseline unpaid→unapproved error. This is a promising targeted candidate, not production acceptance or general quality proof; broader language/operation/device validation is still needed.

The [frozen additional-language transfer](2026-10-04-writing-demonstrations-language-transfer.md) contradicts global adoption of the four examples: Japanese switches to French and copies demonstration names/date; Korean loses sender/roles; Portuguese keeps informal wording. German permissions improve, but that does not offset other failures. Some literal-changing outputs are refused, while role/obligation changes can still apply. Candidate remains diagnostic only; earlier narrow positive evidence is not general multilingual acceptance.

The [example-pair order contrast](2026-10-04-writing-demonstrations-order.md) changes Japanese French output into English/Spanish and also produces English Korean rewrites with changed roles. Reversing examples is not adopted. Eight applications in the reverse variant include wrong-language outputs, demonstrating the existing rewrite script-guard gap separately from prompt quality.

The [current-build rewrite script-guard regression](2026-10-04-writing-rewrite-script-guard.md) reruns identical actual requests/raw outputs from the order experiment. Three formerly applied complete Latin/CJK switches are now refused with source preserved; all other observed outcomes remain unchanged. This is protective validation, not factual-writing acceptance or adoption of the example candidate.

The [same-language demonstration development screen](2026-10-04-writing-matched-language.md) repairs observed Japanese language switches and Korean sender loss, while removing Portuguese filler on eight known sources. Same-language sets are selected from oracle fixture labels and differ in localized phrasing, so this is not production language routing or pure language-causality evidence. The candidate remains unadopted pending unused-source transfer, broader style/operation/device validation and routing quality.

The [frozen matched-language unused-source screen](2026-10-04-writing-matched-language-transfer.md) prevents several prior role/style failures but changes Japanese “permission not yet received” into affirmative receipt wording while retaining names/literals. That applied negation error rules out broad adoption of the candidate; the eight applications are not eight correct outputs. The new sources are now observed, so subsequent tuning requires other unused validation inputs.

Installed-catalog Qwen2.5 [1.5B](2026-10-04-qwen25-15b-seven-language-writing.md) and [3B](2026-10-04-qwen25-3b-seven-language-writing.md) each complete 21 current-production-route tasks without becoming suitable defaults. 1.5B changes dates/currency and binds 11 filters to 11 o’clock in an applied German summary. 3B produces repeated malformed ISO-date fragments containing unrelated characters; the cause is unisolated and calls for a precision/runtime contrast. Literal guards retain source on refusals; neither native edit count nor larger parameter count establishes semantic quality.

The [Qwen2.5 3B q4f32 catalog contrast](2026-10-04-qwen25-3b-f32-seven-language-writing.md) preserves exactly the q4f16 request bodies but still generates malformed date fragments in four summary languages. Its [schema-removal diagnostic](2026-10-04-qwen25-3b-f32-summary-schema.md) yields seven identical paired outputs, including those malformed dates without schema. Neither switching this variant nor deleting schema resolves the failure. Model assets/compiled libraries differ across precision variants, and root cause remains unisolated.

The [Qwen2.5 thinking-hint contrast](2026-10-04-qwen25-3b-thinking-hint.md) removes only the JSON path’s system /no_think suffix. Engine prompt counts decrease by four tokens, but malformed dates persist and previously correct English date becomes malformed. Hint removal is not adopted as a repair; cached model/tokenizer provenance and lower-level decoding remain unverified root-cause factors.

The [cached metadata audit](2026-10-04-qwen25-cached-metadata.md) matches config/tokenizer bytes and complete parsed tensor manifests to fixed model revisions; at that stage actual weight shards remained unverified. Later checks below close that specific gap. The [inherited repetition-penalty screen](2026-10-04-qwen25-3b-repetition-penalty.md) neutralizes 1.05 to 1.0, but date corruption persists and an applied Spanish output adds an unsupported per-item value. This setting is not adopted as a semantic or malformed-date repair.

## Follow-up evidence reconciled on 2026-10-05

The original sixteen-report outcome table remains a historical subset, not a
complete model ranking. Six subsequent reports are now separately hash-bound
in the index JSON. Their differing protocols do not justify adding their
application counts to that table or interpreting them as quality scores.

| Question                                         | Later evidence                                                                                                                                                  | Remaining limit                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Corrupted cached weights?                        | [124 weight shards](2026-10-04-qwen25-cached-weight-shards.md) match declared size/MD5, totaling 3,472,375,808 bytes                                            | No detected accidental corruption in the audited profile; not adversarial authenticity      |
| Different compiled library?                      | [Both WASM libraries](2026-10-04-qwen25-pinned-libraries.md) match fixed upstream artifacts by size/SHA-256                                                     | Does not prove ABI, compiler or GPU arithmetic correctness                                  |
| App parsing changes dates?                       | [24 repeated token-boundary calls](2026-10-04-qwen25-3b-date-tokens.md) show the malformed addresses already generated inside the engine                        | Model/compiler/browser root cause remains unisolated; logprobs are not confidence estimates |
| Can an independent CPU runtime copy these dates? | [Native llama.cpp](2026-10-04-qwen25-3b-llamacpp-reference.md) copies four known sources correctly under both tested penalties                                  | Different quantization, template, sampler and arithmetic confound GPU comparison            |
| Can browser CPU copy the same dates?             | [Shipped browser CPU SDK](2026-10-04-qwen25-3b-browser-cpu-reference.md) copies the four known sources correctly                                                | Direct SDK test, not the full native IM writing route                                       |
| Is CPU 3B a suitable document-writing default?   | [Seven native IM summaries](2026-10-04-qwen25-3b-cpu-im-summary.md) reveal language, grammar, sentence-count and valuation issues; observed latency 17.3–56.8 s | Six applied summaries are not six accepted summaries; no promotion                          |

The current source configuration remains Qwen3-1.7B for GPU and revision-pinned
Qwen3-0.6B GGUF for automatic CPU availability fallback. The GPU selector also
offers Qwen3.5-2B, Qwen3.5-0.8B and Qwen3-4B. These are provisional candidates;
runtime availability and native Undo/Redo do not establish semantic acceptance.
The index snapshot binds the two configuration source files and checks these
identities separately from historical result hashes.

Next model work must address factual relations, negation, modality, language
and usable latency with previously unused sources. Do not repeat weight/library
identity checks or treat known date-copy success as summary acceptance. The
specific GPU malformed-date cause still needs an isolating runtime/compiler
experiment. No production prompt, sampling, model or default is changed by
this reconciliation. Historical inference reports bind older bundles; later
UI builds require fresh runtime validation before claims about current behavior.

## Later conditional-summary evidence

The [supplementary decision index](2026-10-05-summary-decision-index.json) binds four later completed native CPU Qwen2.5 3B runs to exact report/review hashes: production conditional summaries (3 outputs), explicit-status transfer (6), final-user single-sentence transfer (4), and five further-language transfer (10). These are separate diagnostic comparisons, not additional independent benchmark cases to pool into a model score.

Their human reviews still reject global candidate/default promotion. Successful native application and exact Undo/Redo establish document mechanics, not semantic fidelity. Local improvements coexist with missing actors/current states, ambiguous approval objects, an unsupported causal connector and sentence-form failures. Every source in these runs is now observed; none is eligible as untouched transfer evidence after further tuning. The earlier index remains historical rather than an exhaustive statement of current quality validation.

Reproduce the supplement with `python3 docs/evaluations/audit-summary-decision.py`. This checks report completion, absence of preview cards, native history evidence for applied rows and file identities. It does not independently validate the language judgments or certify any model. The next semantic gate requires a frozen general candidate evaluated on other unused sources and operations; no product prompt or default is changed by this reconciliation.

## October 7 Gemma follow-up (outside baseline counts)

Gemma 4 E2B now loads in the matched browser CPU runtime. Its [three remaining original-product summaries](2026-10-07-gemma4-summary-analysis.md) still omit/transform requested current states; exact native writes/history are not semantic acceptance. The [unused-source message comparison](2026-10-07-gemma4-consistent-analysis.md) completes four rows but leaves a Chinese actor/action/only-after relationship implicit, so that prompt candidate is not adopted.

The [model-recommended sampling contrast](2026-10-07-gemma4-sampling-analysis.md) retains the explicitly pending budget state on one known Chinese source, while product greedy sampling repeats the omission. Both preserve original product messages/schema and have exact native application/history. This is a joint sampling-configuration comparison with one sample each, about 127–129 seconds per request, not general quality or a new default. Gemma's imported 2.84-GB model remains a higher-resource desktop diagnostic, not the lightweight CPU availability fallback.

The [frozen transfer protocol](2026-10-07-gemma4-sampling-seven-language-protocol.md) starts seven source-language versions across rewrite, summary and translation with the unchanged recommended sampling candidate. Sources are correlated and shared across three tasks; 21 task executions do not mean 21 independent sources. Translation directions cover English/Chinese targets only. At this index update the process is in progress, with no completed-screen acceptance claim. Native-speaker review, broader language directions, usable latency and full device/editor/offline lifecycle requirements remain open. The original sixteen-report table and its byte-bound outcome counts are unchanged.

### Completed Korean readiness correction (October 7)

The separately frozen corrected Korean run completed three real inference requests after exact native source readiness. Rewrite and translation retain the checked facts; summary omits Mei Tan and the technical team. Together with the original 18 valid requests, coverage is 21 valid task executions, with the original three zero-inference setup failures preserved separately. Manual narrow reviews total 11 passes, six failures and four uncertain results; six of seven summaries fail. Seven translated versions of one source are correlated and cannot establish independent accuracy. No candidate is adopted. See `2026-10-07-gemma4-sampling-korean-corrected-analysis.md` and its hash-bound receipts.

## October 7 Instruct-2507 follow-up (outside baseline counts)

The [pinned Qwen3-4B-Instruct-2507 CPU screen](2026-10-07-qwen3-instruct2507-seven-language-analysis.md) completes 21 development tasks across seven distinct source topics and seven translation pairs. Bounded manual checks pass six rows and fail fifteen; failures include source-language changes, changed date/name spelling, omitted actors, multiple sentences and introduced grammar. All requests/native histories and unchanged frozen artifacts are verified separately. Refusals are not completion, fixtures lack native-speaker certification, and no candidate/default is adopted.

The [original-policy placement contrast](2026-10-07-qwen3-instruct2507-policy-placement-analysis.md) completes six known-source rows. All product baselines exactly reproduce prior requests and raw choices. Moving the original preamble verbatim into system and keeping task JSON verbatim improves English-to-Japanese name preservation, but Chinese summary remains English with a missing actor and Japanese-to-Korean still omits Ken Sato and corrupts its ISO date. This is not a general repair or untouched transfer. Production behavior is unchanged; seven-language factual writing and the broader device/editor/offline/privacy gates remain outstanding.

### Completed Q4/Q6 known-source contrast (2026-10-07)

Eight native CPU inference rows completed with verified artifacts and unchanged before/after runtime hashes. Q4 failed all four selected known failures; Q6 narrowly passed the German rewrite but still failed Chinese summary, Japanese-to-Korean actor/name retention and Spanish source-language rewrite. No candidate adoption or seven-language acceptance follows. See [analysis](2026-10-07-qwen3-instruct2507-q6-analysis.md), [semantic review](2026-10-07-qwen3-instruct2507-q6-review.json), [raw receipt](2026-10-07-qwen3-instruct2507-q6-native.json) and [bindings](2026-10-07-qwen3-instruct2507-q6-bindings.json).

### Completed larger GPU known-source screen (2026-10-07)

Pinned Qwen2.5-7B MLC loaded on the actual Apple GPU and completed four frozen SDK writing requests. Bounded manual checks narrowly pass Japanese-to-Korean translation, German rewrite and Spanish rewrite; Chinese summary preserves examined facts but fails the one-sentence instruction. These are selected known sources with no native application, unused-source transfer or seven-language acceptance. See [analysis](2026-10-07-qwen25-7b-gpu-analysis.md), [review](2026-10-07-qwen25-7b-gpu-review.json), [raw receipt](2026-10-07-qwen25-7b-gpu-screen.json) and [bindings](2026-10-07-qwen25-7b-gpu-bindings.json). No default is promoted.

### Completed native larger GPU development screen (2026-10-07)

Qwen2.5-7B completed all 21 known-source original-product Word writing tasks. Bounded manual review yields 9 narrow passes, 11 failures and 1 uncertain result; exact native write/history and actual Apple GPU/runtime checks pass independently. Missing actors/current status, changed recipients/actions/objects, wrong language/date format and target-language issues prevent adoption. See [analysis](2026-10-07-qwen25-7b-gpu-native-analysis.md), [review](2026-10-07-qwen25-7b-gpu-native-review.json), [raw receipt](2026-10-07-qwen25-7b-gpu-native.json) and [bindings](2026-10-07-qwen25-7b-gpu-native-bindings.json). This screen is not unused-source transfer, native-speaker or full device/offline acceptance.

### Larger GPU original-policy placement follow-up (2026-10-07)

Twelve SDK replies completed across six frozen known-source pairs, but the overall process exited 1 because no fresh pinned-library network fetch was observed; the successful-screen verifier correctly rejects that receipt. A separate post-run cache probe found the declared exact WASM bytes at the pinned URL. All six product raw bodies reproduce the prior native screen. All six policy-system candidates still fail bounded task checks; Korean language/recipient improvements coexist with changed date formatting. This is no prompt adoption or untouched/native acceptance. See [analysis](2026-10-07-qwen25-7b-policy-placement-analysis.md), [review](2026-10-07-qwen25-7b-policy-placement-review.json) and [failed-gate bindings](2026-10-07-qwen25-7b-policy-placement-bindings.json).

- 2026-10-07: Completed header-preserving Qwen2.5-7B fixed-example rewrite contrast: product 4 narrow pass/2 fail/1 uncertain, minimal policy 3/4/0, fixed examples 5/2/0. Examples cause English-to-Chinese output and retain Japanese actor loss; no variant or product adoption passes seven-language acceptance. See `2026-10-07-qwen25-7b-fixed-examples-headers-analysis.md`.

- 2026-10-07: Post-inference Qwen2.5-7B owned-cache audit matches all 88 pinned tensor shard sizes/MD5s (4,284,263,424 bytes), process exit 0. This closes current-cache mismatch evidence only, not exact earlier consumption or seven-language quality. See `2026-10-07-qwen25-7b-cached-weight-shards-analysis.md`.

- 2026-10-07: Read-only Qwen2.5-14B feasibility inventory finds 194 pinned shards/8,309,352,448 bytes but no matching Qwen 14B library in the fixed official WebGPU runtime tree and no shipped SDK 14B catalog entry. No weights download, inference, quality verdict or default adoption. See `2026-10-07-qwen14-runtime-inventory-analysis.md`.

### Locally compiled Qwen2.5-14B follow-up (2026-10-07; screen ongoing)

The earlier feasibility inventory is historical. Matched locally compiled 7B and 14B WebGPU libraries now load on the observed Apple Metal adapter; [14B native load receipt](2026-10-07-local-qwen14-library-native.json) records actual inference. Static tensor-contract agreement does not establish cached shard integrity or semantic quality.

The original minimal model record timed out on the structured writing request. An otherwise matched explicit 2048-token context completed that request; see [context control](2026-10-07-qwen14-context-control.json). Exact allocation/kernel cause is not measured. The ongoing Word screen uses diagnostic model-record overrides (context 2048, prefill 1024), unchanged product writing messages/schema and existing known sources. Product defaults remain unchanged.

Eighteen completed tasks have been reviewed so far: five narrow passes, eleven failures and two uncertain outputs. Failures include changed ISO date format (correctly rejected by the editor), omitted permission actors, introduced German grammar/translation issues and sentence-count violations. Applied documents and Undo/Redo do not convert these failures into semantic passes. See [Chinese review](2026-10-07-qwen14-chinese-interim-review.json), [English/Japanese/Korean review](2026-10-07-qwen14-en-ja-ko-interim-review.json), [Korean/German review](2026-10-07-qwen14-ko-de-interim-review.json) [German summary review](2026-10-07-qwen14-de-summary-interim-review.json) [German translation review](2026-10-07-qwen14-de-translation-interim-review.json) [Spanish rewrite review](2026-10-07-qwen14-es-rewrite-interim-review.json) and [Spanish summary/translation review](2026-10-07-qwen14-es-final-interim-review.json); each binds its completed-case snapshot by SHA-256.

This is an interim development result, not a completed seven-language screen, unused-source transfer, native-speaker certification or full editor/device/offline acceptance. No candidate is promoted.

### Completed bounded 14B native screen (2026-10-07)

The above interim counts are historical. The [completed screen analysis](2026-10-07-qwen14-bounded-gpu-native-analysis.md) and [hash-bound review](2026-10-07-qwen14-bounded-gpu-native-review.json) cover all 21 tasks: 7 narrow passes, 12 failures and 2 uncertain outputs. Process exit 0 and closed context are confirmed; document history checks pass separately. No candidate/default is adopted, and unused-source, broader editor/device/offline acceptance remains open.

### 14B original-policy placement contrast (2026-10-07)

[Eight completed SDK replies](2026-10-07-qwen14-policy-placement-analysis.md) reproduce all four native product baseline raw bodies exactly. System placement fixes one Portuguese translation locally but retains Chinese actor loss, Japanese date-format changes and Portuguese summary omissions/modality change. Candidate outcomes are one narrow pass and three failures. Process exit 1 reflects the unobserved pinned-library fetch gate; no overall successful-runtime or candidate-adoption claim follows.

The [two-stage fact-ledger diagnostic](2026-10-07-qwen14-fact-ledger-native-analysis.md) completes twelve SDK requests on four selected known failures. All four original product raw contents reproduce the prior baseline. Bounded manual final-output review gives two narrow passes and two failures: Chinese actor retention and Spanish-to-Portuguese improve, while Japanese ISO-date reformatting and Portuguese missing actor/approval plus changed modality persist. Extraction is itself incomplete; even correct intermediate fields do not guarantee final fidelity. The extra rendition prompt is a confound until compared alone. No product/model adoption, seven-language acceptance or exact cached-library consumption claim follows.

The [rendition-prompt-only contrast](2026-10-07-qwen14-rendition-prompt-only-native-analysis.md) reproduces the two narrow improvements without extraction. All four actual requests differ from the prior final requests only by removing the ledger line. Japanese date reformatting remains; Portuguese still changes actor/modality and unvalidated backup to unmade backup. Extra prompting remains unadopted, and the ledger has no demonstrated added benefit on these four known sources.

The [protected-date contrast](2026-10-07-qwen14-date-protection-native-analysis.md) completes nine requests on three known rewrite failures. Marker instruction alone does not stop date reformatting; source masking allows exact date restoration in all three outputs. Bounded final review gives two narrow passes and one failure because Korean loses the permission actor that both controls retained. Date protection is unadopted: literal correctness can coexist with a new semantic regression.

The [per-sentence diagnostic](2026-10-07-qwen14-segmented-writing-native-analysis.md) restores the missing Korean permission actor while preserving examined facts in one known rewrite. Portuguese core facts survive but host assembly produces duplicate semicolons and two model fields largely copy their source sentence. This combined schema/prompt/assembly experiment is unadopted and does not establish general abstractive summarization or seven-language quality.

The [new-source seven-language segmented screen](2026-10-07-qwen14-segment-transfer-native-analysis.md) completes 42 baseline/candidate requests across 21 tasks. Bounded manual review: baseline 3 narrow passes/16 failures/2 uncertain; segmented 5 narrow passes/9 failures/7 uncertain. New failures include passed-to-completed status change, an inverted Japanese prerequisite, required marker loss and untranslated Spanish headings. Several candidate summaries retain facts without establishing the frozen meaningful-compression instruction. No workflow/model adoption or seven-language acceptance follows.

The [independent revision screen](2026-10-07-qwen14-independent-revision-native-analysis.md) completed 21 further 14B SDK generations from fixed prior product drafts, without human gold corrections. Bounded manual review found 2 narrow passes / 19 failures; the passing tasks already passed their baselines. A repaired Japanese permission construction lost the payment-for-parts relation. No revision workflow is adopted.

The [specialized Hy-MT2 CPU translation screen](2026-10-07-hymt2-cpu-translation-native-analysis.md) completed seven cyclic translations with fixed SHA-256-verified model bytes using the current CPU SDK/native pair. Bounded manual review found 1 narrow pass / 4 failures / 2 uncertain, including date/name changes and terminology/grammar issues. This establishes scoped SDK compatibility, not product/default adoption, general accuracy, all translation directions, rewrite/summary or device/offline acceptance.
