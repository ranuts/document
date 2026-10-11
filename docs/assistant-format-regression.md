# Supported-format regression — 2026-10-11

## Coverage

The real editor regression covers all 13 accepted extensions:

- Word: DOCX, DOC, ODT, RTF, TXT.
- Spreadsheet: XLSX, XLS, ODS, CSV.
- Presentation: PPTX, PPT, ODP.
- PDF: native annotation, save/reopen and read-only protection.

Thirty end-to-end cases passed: 27 format/product/agent cases and three real
legacy Office samples from Apache POI. Legacy samples exercise open, OOXML
conversion, PDF export and read-only behavior. TXT/RTF tests additionally check
that text survives native save and reopen. Agent cases check review before
writing, native Undo, cancellation, and Word/spreadsheet/presentation writes.
Nine PDF/agent cases were rerun after the final PDF capability correction.

Full unit regression: 161 files, 4,861 tests passed. Type checking, archive-aware
lint, formatting and the production build passed. Added source lines and new
files contain no absolute user paths or private user names.

## Repairs found during regression

- Ground chat in fresh editor content, distinguishing an empty readable scope,
  an unavailable read, and truncated content. The previous empty-sheet prompt
  fabricated cells; the same prompt now reports the empty spreadsheet.
- Identify PDF using the engine's native `isPdfEditor()` discriminator, rather
  than treating it as a Word editor or inferring type from annotation methods.
  PDF annotation APIs remain separate from AI Word body actions.
- Update obsolete end-to-end selectors to the current settings/history toggles
  and natural-language request flow. Review tests explicitly assert that cells
  remain unchanged until approval; cancellation uses the visible controls.

## Actual default-model checks

Qwen3 1.7B with WebGPU was tested separately from mocked provider tests:

- Word: empty content read; short prose generation; insert generated body;
  independent native body read; one Undo; fresh empty-content read.
- XLSX: empty content read; read a range and propose a numeric cell write;
  apply the proposal; fresh read returns the actual value; native Undo.
- PPTX: empty content read; propose and apply a text box; read returns the exact
  requested text; one Undo; fresh read reports no readable text.
- CSV: read all six cells in a synthetic A1:B3 range; change occupied B2 from
  7 to 9 after review; exported CSV contains 9; one Undo restores exported 7.
- The loaded model remains ready across same-page editor switches. A page reload
  still requires recreating the in-memory engine from cached files.

## Limits

Passing these cases establishes the tested integration paths, not reliability
for arbitrary documents or arbitrary natural-language instructions. The small
default model still misroutes some paraphrased requests; it remains experimental.
Complex file fidelity, seven-language model quality, and live microphone quality
require separate acceptance datasets. Unsupported PDF AI edits must not be
reported as successful operations. Success is based on native state or exported
content, never solely on the assistant's completion text.

## HITL follow-up

- Review proposals stay in chronological chat order. Insert, replacement and
  clear actions use their actual operation labels. Clear shows the captured body
  character count and expandable original text, without a meaningless Copy action.
- Pending, applying, expired, failed, sent and verified states are explicit.
  Completed proposals collapse to one status; Apply, Copy and Cancel disappear.
  Repeated confirmation cannot execute the operation twice. Cancel while applying
  aborts the operation. Settling a focused proposal restores the preceding focus.
- Completion feedback is not repeated as a second chat activity. Seven shipped
  locales include the new labels; source is rendered as text, never HTML.
- Regression: 4,863 unit cases passed; 10 product/editor end-to-end cases passed.
  The final six editor-write cases passed again after the last changes. Type
  checking, formatting, privacy scan and production build passed.
- Real Qwen3 1.7B: clear a Word body after confirmation, independently verify an
  empty body, then send 你好 and receive a normal greeting. Switch to CSV with the
  same loaded model, change occupied B2 to 9 after review, independently export
  the updated CSV, then send 你好 and receive a normal greeting again.
- Native editor Undo remains the recovery mechanism. A dedicated action-owned
  Undo button and rich editor-inline diffs are not introduced by this follow-up.

## PDF assistant follow-up

The assistant now reads selectable text on the current PDF page and can propose a page note for review. It identifies the page being read and does not claim to have read the whole file. Scanned image text is unavailable. Notes are attached to pages and do not replace body text; selected-text transformations are shown as copyable replies.

Cancellation leaves the file unchanged. Confirmed notes can be undone in the editor and survive saving and reopening. An injected failure after adding a note is rolled back, and the next note can still be added and undone. The desktop PDF editor exposes the same assistant entry on its existing left toolbar.

Updated ordinary-user guidance is available in the seven localized assistant and help pages, with matching README summaries. Model interpretation quality remains a separate acceptance requirement.

Final verification: 165 unit files and 4,915 tests passed. Type checking, lint, formatting and the production build passed. The final PDF editor run also verified a note on the second page, one-step Undo and persistence after saving and reopening. These controlled-response checks verify editor behavior, not the default model’s interpretation quality.

## Imported assistant formats

A new real-editor suite covers ODT, ODS, ODP, RTF and TXT using shared synthetic, non-private fixtures. Each case opens through the product file picker, verifies that the service receives the imported content as request context, waits for review without changing the file, confirms one native edit, reads the result independently and restores the original content with one native Undo. These checks cover the application contract with controlled service responses, not model interpretation quality.

All five assistant cases passed. Together with existing OpenDocument/text save and PDF export cases and picker coverage, the final run passed 11 tests. The initial ODS failure was a test-provider parameter mismatch (`address` instead of the schema's `cell`), verified in the captured response; the application rejected it without changing the cell. Corrected the fixture response and reran the complete set successfully.

DOC, XLS and PPT acceptance now uses genuine public legacy binary files. DOC insertion and XLS cell replacement pass review, native readback and one-step Undo. The PPT fixture has reserved title/body/footer regions: adding another box correctly fails for lack of room and rolls back, then editing the selected existing title succeeds after review and one Undo restores it. This does not imply arbitrary new text fits every slide. The opt-in corpus suite is not evidence of a pass when no corpus has been supplied.

### Reproducing the public legacy run

The legacy assistant cases use public LibreOffice regression files at pinned revision `63a2e191551b157adad367d020835e9ec21fc964`:

- [Word zoom.doc](https://github.com/LibreOffice/core/blob/63a2e191551b157adad367d020835e9ec21fc964/sw/qa/extras/ww8export/data/zoom.doc)
- [Spreadsheet universal-content.xls](https://github.com/LibreOffice/core/blob/63a2e191551b157adad367d020835e9ec21fc964/sc/qa/unit/data/xls/universal-content.xls)
- [Presentation tdf49561.ppt](https://github.com/LibreOffice/core/blob/63a2e191551b157adad367d020835e9ec21fc964/sd/qa/unit/data/ppt/tdf49561.ppt)

Download verification checks exact byte size, compound-file signature and SHA-256. Downloaded binaries remain in an ignored test output directory, not the repository. No private corpus is needed.

```sh
node bin/fetch-agent-legacy-fixtures.mjs
LEGACY_AGENT_CORPUS_DIR=test-results-legacy-fixtures pnpm exec playwright test test/e2e/agent-imported-formats.spec.ts --workers=1
CORPUS_DIR=test-results-legacy-fixtures CORPUS_DEEP=1 pnpm exec playwright test test/e2e/corpus.spec.ts --workers=1
```

Without the explicit corpus directory, the three legacy assistant cases are reported as skipped. They must not be counted as verified by the default suite. These representative files establish basic format-specific acceptance; they do not certify every legacy layout or every model's decisions.

The public legacy corpus run also passed three files with no findings, covering import, save, trusted editing, PDF export and read-only behavior. The first PPT test mixed multi-line native text with rendered paragraph text; its marker now uses the first native text line. A subsequent insertion attempt correctly rolled back because reserved boxes left no free area. The final PPT case checks that failure explicitly and then verifies a real selected-title edit and Undo. No product code was weakened to make a crowded insertion pass.

Final current-code imported assistant run: all eight cases passed with the explicit public corpus, including the legacy PPT insertion rollback followed by reviewed title replacement and exact Undo. No skipped legacy cases were counted. Targeted lint, formatting and diff checks passed; added-content privacy scan found zero local-path, username or token-shaped-secret matches.

## Read results followed by grounded answers

The controlled-provider PDF case now verifies a schema-planned content read followed by a separate tool-free answer, rather than allowing an initial chat response to stand in for that path. The expected answer is exactly `120`, and the provider must receive the native page text and matching read receipt. All eight imported-format cases similarly require a read-tool continuation before their existing native edit/review/Undo checks.

Helper tests cover all four editor kinds, unavailable completion, unexpected tool calls and a provider that ignores Stop. Panel tests verify late answers are discarded after Stop or captured target invalidation. The empty-presentation regression remains unchanged and still shows an explicit unavailable-source result. Full unit regression initially passed 4,940 tests; final follow-up includes two additional host boundary cases. These are application-contract tests, not default-model qualification.

Final host boundary checks passed after restoration. Temporarily removing the post-answer target guard made the target-invalidation test fail by displaying `LATE ANSWER`; restoring the guard made both Stop and target-invalidation cases pass. Final full unit run passed 166 files / 4,943 tests, including the reasoning-display regression. The combined PDF and imported-format browser run passed all 10 cases. Strict lint, TypeScript and formatting checks passed.

The new reasoning-display regression first failed by rendering the model's leading `<think>` block alongside `120`. The answer path now reuses the existing presentation filter; no parallel reasoning parser was introduced.

A fresh browser run with the final presentation filter and actual Qwen3 4B model answered “当前文档里的预算是多少？请只回答金额。” with visible text exactly `120` on the synthetic TXT source. No reasoning protocol tags were displayed. This single final-code trial does not establish repeated multilingual model qualification.

## Composer and reading-focus follow-up

- Keep the next request editable while a response is pending. Enter cannot submit
  or queue it during the active request, and completion does not send the draft.
- Announce actual reading and response phases in the existing polite status.
  Pending review uses the existing inline status and retains destructive scope
  information; completed changes remain compact.
- Appending a review follows the latest message only when already near the end.
  Completing a response does not move keyboard focus away from historical reading
  or another control. A focused Stop returns to the editable draft.
- Four native-editor cases cover pending drafts and focus in DOCX, XLSX, PPTX and
  PDF. The final combined browser run passed all 24 cases, including eight imported
  formats with the public legacy corpus enabled, native writes and Undo.
- Ordinary sequential request tests now wait for the active request to end rather
  than treating an editable input as completion. Initial parallel verification
  had two imported-file readback failures; both passed in isolated rechecks and
  the final sequential run. A repeated three-worker run alongside the heavy
  type check still had three failures; a dedicated six-case parallel rerun passed
  after the type check ended. Reliability under competing heavy workloads remains
  an open observation; the timing checks and native readback assertions remain intact.
- The first full unit run exceeded the existing timeout in the bounded model-file
  read test while other checks were running. Both file-read cases passed in an
  isolated recheck. No timeout or acceptance condition was relaxed.

Final full unit regression: 166 files, 4,949 tests passed. Formatting, strict lint and TypeScript checks passed.

These interaction checks use controlled provider responses. They do not establish
seven-language model quality or actual screen-reader acceptance.

## Sidebar interaction details

The draft reflows when the sidebar width changes; long drafts scroll within the
existing input. Layout changes keep the latest answer visible only when the reader
was following the end. Reading history does not resume following implicitly.
Copy uses fixed-size success/failure icons, a separate polite announcement and an
available retry action. Feedback does not replace running activity. Message block
edges, nested lists and table text use the existing theme and type scale. Code
and overflowing tables are keyboard-reachable and retain their own scroll areas.

The first browser run found a real viewport-ordering defect: a scroll event from
composer growth was mistaken for intentional scrolling. A new regression models
that event arriving before the resize notification. A later run rejected resize
observer delivery errors through the existing L0 check. Layout writes now run in
the next animation frame and only changed widths trigger input reflow, following
the [browser guidance on resize observation errors](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors).
The L0 check and its error allowlist were not changed. A separate test-locator
failure was corrected to select the runtime sidebar rather than the hidden
onboarding panel; no product assertion was removed.

Final current-code verification: 167 unit files and 4,956 tests passed. The
production-build browser run passed all 24 cases, including sidebar resizing,
long drafts, history position, clipboard feedback and keyboard scrolling in
DOCX/XLSX/PPTX/PDF, eight imported formats, native writes, Undo and scoped PDF
behavior. These interaction cases use controlled provider responses; actual
screen-reader acceptance and repeated multilingual model qualification remain open.

## Exploratory repeated model reading

A separate on-device Qwen3 4B session used a synthetic DOCX containing exactly
`Project budget: 120.Due date: 2026-11-01.` plus the native final newline. The
question asked for the budget alone, with expected visible answer `120`. The UI
language stayed English; question languages varied. Each request started a new
conversation. Native reads before and after the session confirmed the source
was unchanged.

| Question language | Trials | Exact expected answers | Observed failures                                                            |
| ----------------- | -----: | ---------------------: | ---------------------------------------------------------------------------- |
| English           |      3 |                      3 | None in these trials                                                         |
| Chinese           |      2 |                      2 | None in these trials                                                         |
| Japanese          |      1 |                      1 | None in this trial                                                           |
| Korean            |      1 |                      1 | None in this trial                                                           |
| German            |      1 |                      1 | None in this trial                                                           |
| Spanish           |      1 |                      1 | None in this trial                                                           |
| Portuguese        |      3 |                      0 | One operation-selection refusal; two answers included the unrelated due date |

These are exploratory observations, not a balanced benchmark or final-build
qualification. Repeating the question after a temporary prompt-order experiment
still produced a selection refusal and an answer with the extra date. Delivery
of that experimental prompt was not independently attested in the live session,
so this is not a controlled A/B result. The experiment was removed instead of
being promoted as a fix. The local model's multilingual task selection and answer
formatting remain unqualified; neither a green CI run nor passing editor adapter
tests establish those capabilities.

### Equal-count follow-up on 2026-10-11

A fresh workspace development session loaded the cached
`Qwen3-4B-q4f16_1-MLC` model and used the same synthetic DOCX text above. The UI
remained English. Each request started a new conversation; the seven questions
were repeated in the same order for three rounds. There was no prompt experiment,
provider substitution or answer postprocessing. The current copy-feedback DOM
marker was present. Native reads before and after all 21 requests returned the
exact same source text and final newline.

| Question language | Trials | Exact `120` answers | Failures                                         |
| ----------------- | -----: | ------------------: | ------------------------------------------------ |
| English           |      3 |                   3 | None                                             |
| Chinese           |      3 |                   3 | None                                             |
| Japanese          |      3 |                   3 | None                                             |
| Korean            |      3 |                   3 | None                                             |
| German            |      3 |                   3 | None                                             |
| Spanish           |      3 |                   1 | Rounds 1 and 2: no executable operation selected |
| Portuguese        |      3 |                   3 | None                                             |

Questions, unchanged between rounds:

- English: What is the budget in the current document? Answer with the amount only.
- Chinese: 当前文档里的预算是多少？请只回答金额。
- Japanese: 現在の文書の予算はいくらですか？金額だけを答えてください。
- Korean: 현재 문서의 예산은 얼마인가요? 금액만 답해주세요.
- German: Wie hoch ist das Budget im aktuellen Dokument? Antworte nur mit dem Betrag.
- Spanish: ¿Cuál es el presupuesto del documento actual? Responde solo con el importe.
- Portuguese: Qual é o orçamento no documento atual? Responda apenas com o valor.

The visible Spanish error was "No executable operation was selected. Clarify the
request or try another model." Raw provider selection output was not captured,
so this does not identify a malformed selection, unsupported operation or model
reasoning error as the specific cause. The condition that only Portuguese fails
is contradicted by this session; language support remains unchanged. Earlier
Portuguese failures remain recorded rather than replaced by these successes.

This is an equal-count reading probe, not full language acceptance. It covers one
short source, one question per language, an English UI, three samples and a
development server. It does not qualify production delivery, matching-language
UIs, writing fidelity, complex operations, other formats or long contexts.

## Reflow and content-arrival interleaving

Layout tests reproduced a loss of bottom following when a streamed delta, a
finished message, Markdown completion or a review arrived after viewport reflow
but before its scheduled layout frame. Content arrivals were overwriting reader
attachment using the temporarily changed geometry. They now consume the existing
following state; scroll handling updates attachment, and jumping to the end or
clearing the conversation resets it.

Four regression cases failed before the repair and pass afterwards. A fifth case
checks that scrolling into history before the pending frame still prevents the
next delta from pulling the reader back. The full unit suite passed 4,961 tests;
two asynchronous Promise warnings were emitted during that run. The production
composer UX suite passed all four DOCX, XLSX, PPTX and PDF cases, covering draft
reflow, bottom following, historical position, focus and keyboard interaction.
Those browser cases use controlled provider responses and do not qualify actual
model accuracy or independently reproduce the exact frame interleaving.

### Tool-purpose clarification follow-up on 2026-10-11

Temporary diagnostics on the same synthetic source captured two fresh Spanish
requests. Both selected the `tools` task and Spanish response language, then
returned the valid `unsupported` operation. This locates those failures in
operation choice rather than malformed JSON or initial task routing. Restricting
the available operations to selection and document reading still returned
`unsupported` in one trial; that experiment was removed.

A separate description-only experiment retained the eight available Word tools
and clarified that `get_document_text` supplies source text for answering factual
questions, including when nothing is selected. Three fresh requests selected
`get_document_text` with `maxChars: 8000` and answered exactly `120`. Temporary
request matching and diagnostic logging were removed. The retained change is a
generic tool description; schemas, permissions, execution and refusal handling
are unchanged. This follows the tool-description guidance in
[OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
and [Anthropic tool design](https://www.anthropic.com/engineering/writing-tools-for-agents).
Those guides do not establish this local model's reliability.

The final development code was then tested in a fresh browser session with the
same cached model, English UI and source. Every request used a new conversation.
Native reads before and after returned the unchanged source and final newline.

| Spanish request                                                                       | Trials | Visible results                                                | Strict requested-format passes |
| ------------------------------------------------------------------------------------- | -----: | -------------------------------------------------------------- | -----------------------------: |
| Original budget question above                                                        |      3 | `120` each time                                                |                              3 |
| Indica únicamente la cantidad presupuestada que figura en este documento.             |      1 | La cantidad presupuestada que figura en este documento es 120. |                              0 |
| ¿Qué fecha de entrega aparece en este documento? Responde solo en formato AAAA-MM-DD. |      1 | `2026-11-01`                                                   |                              1 |

All five final-code requests produced the correct source fact without an
operation-selection error. The paraphrase failed the requested answer format and
remains a failure. Final-code trials captured visible results, not raw provider
plans. These small, fixed-order experiments on one source are exploratory; they
are not randomized comparisons, production qualification or full multilingual
acceptance. Language support remains unchanged.

For the generic description change, the full unit suite passed 4,961 tests
(with the same two asynchronous Promise warnings), strict lint and TypeScript
checks passed, and all ten production browser tests in the native editor write
suite passed. The write suite uses controlled providers and protects execution
behavior; it does not measure local model accuracy.

## Current-code cross-format acceptance on 2026-10-11

At application commit `08aa6131`, a production-build run passed all 14 cases in
`agent-composer-ux`, `agent-imported-formats` and `pdf-agent-contract` with one
worker. The explicit public legacy corpus was supplied; all three file hashes
matched the pinned fixture definitions and no legacy cases were skipped.

- DOCX, XLSX, PPTX and PDF: editable next drafts, sidebar reflow, bottom following,
  historical focus, stable copy feedback and keyboard scrolling of code/tables.
- ODT, ODS, ODP, TXT, RTF, DOC and XLS: imported context reaches the service,
  reviewed native modification is independently read back and one Undo restores
  the original content.
- PPT: a crowded insertion fails and rolls back, then reviewed selected-title
  replacement succeeds and one Undo restores the original.
- PDF: virtual text reads preserve the real selection; scoped reading and reviewed
  page notes exercise cancellation, rollback, Undo, and saving/reopening; a
  body-rewrite request produces an answer without offering a document write.

These browser tests use controlled providers. They establish the tested editor
and interaction contracts, not local model quality or universal document-layout
compatibility. CSV native writes passed in the preceding ten-case write suite;
CSV is not included in this 14-case run.

### Remaining interaction acceptance

Source review still finds a two-step speech-language interaction: a button opens
a wrapper containing an `r-select`, then a second interaction opens its options.
The service, download and advanced-settings disclosures also have different
structures. These remain redesign work, rather than completed UX acceptance.

A temporary layout unit probe additionally reproduced a boundary absent from the
passing composer browser cases: upward wheel input, viewport-height change and a
scroll event in the same interval retain bottom attachment. The next streamed
update and pending layout frame both call scroll-to-end. Eleven existing layout
cases passed while that new probe failed. The probe was removed after diagnosis;
production code is unchanged. A real-browser reproduction and a repair covering
wheel, touch, keyboard and scrollbar navigation are still required. This is not
claimed as a browser-proven production regression.

Actual screen-reader acceptance, the proposed layout responsibility split,
unified settings/language interaction and broader multilingual model acceptance
remain open. Passing the above cases does not close these requirements.
