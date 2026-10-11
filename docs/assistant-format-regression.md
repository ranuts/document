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

### Actual local-model Excel probe on 2026-10-11

At application commit `4b722e27`, a fresh Chinese-UI development session loaded
cached `Qwen3-4B-q4f16_1-MLC` into an independently created empty XLSX. No provider
substitution, prompt experiment or response postprocessing was used.

1. `在当前工作表的 A1:A100 填入从 1 到 100 的连续整数。` produced a reviewed
   A1:A100 proposal. CSV export before confirmation remained the original empty
   file. After confirmation, export contained exactly 100 rows with every value
   equal to its one-based row number, and their sum was 5050.
2. `当前工作表 A100 中的数字是多少？请只回答数字。` answered exactly `100`.
3. In a fresh conversation, `当前工作表 A1:A100 的合计是多少？请只回答数字，不修改表格。`
   answered exactly `5050`. Export remained byte-identical to the filled CSV.
4. One native Undo restored the original empty CSV. In a fresh conversation,
   `你好` answered `你好！有什么可以帮助你的吗？` without the reported spreadsheet
   operation refusal.
5. After native Redo, the visible name box was used to select only A1. The same
   sum question in another fresh conversation still answered exactly `5050`.
   Export was unchanged; a final native Undo restored the empty CSV again.

This records five actual-model requests, one confirmed write, independent CSV
readback and native Undo/Redo. Initial sum reading had A1:A100 selected; the final
sum reading had only A1 selected. Raw provider plans were not captured, so these
results do not attest which read operation the model selected. This small
Chinese-language development probe does not qualify all spreadsheet tasks,
other languages, production delivery, formula generation or other document
formats. The temporary browser tab was closed after restoring the test file.

### Actual local-model presentation probe on 2026-10-11

The same application commit and cached 4B model were used in a fresh Chinese-UI
PPTX session starting with one empty slide. Native PPTX exports were inspected
independently of the model response: slide XML parts were extracted from the ZIP
central directory, decompressed and parsed for DrawingML text.

- `在演示文稿末尾新增一页幻灯片，标题为“项目预算”，正文为“预算：120”。`
  produced only a new-slide proposal. Before confirmation, exported slide parts
  matched the baseline. Confirming added a second slide and preserved slide 1,
  but slide 2 contained no text: both requested title and body were missing.
  **The compound request failed acceptance.** A verified primitive operation and
  the UI completion receipt do not establish completion of the user's request.
- In a new conversation, `请在当前幻灯片中添加文字“预算：120”。` produced a
  correct text-addition proposal. After confirmation, exported slide 2 contained
  exactly one `预算：120` text value and three shapes.
- In another new conversation, `当前幻灯片里的预算是多少？请只回答金额。`
  answered exactly `120`; exported slide parts were unchanged by reading.
- One native Undo restored the pre-text slide parts. A second native Undo removed
  the added slide and restored all original slide XML parts. The temporary page
  was closed after restoring the baseline.

Code inspection explains the capacity boundary: `slide_action` accepts only an
add/duplicate/navigate action and optional page; it cannot supply title/body.
The schema planner explicitly chooses one operation and is instructed to refuse
multiple-operation requests, yet this model selected a partial operation. The
sequence wrapper provides a closed spreadsheet phrase sequence rather than a
general multi-operation path. These are separate model-choice and orchestration
limitations; neither language deletion nor a sentence-specific match repairs the
requested presentation workflow.

The provider-neutral runtime already has bounded tool-call/result round trips.
Any general repair must retain scope checks, reviewed writes, cancellation,
readback and Undo while distinguishing primitive success from whole-task
completion. The documented
[function-call loop](https://developers.openai.com/api/docs/guides/function-calling)
and [composable agent workflows](https://www.anthropic.com/engineering/building-effective-agents)
provide reference patterns; they do not prove that a 4B model can plan arbitrary
multi-step edits. No multi-operation repair is claimed in this probe.

### Actual local-model PDF probe on 2026-10-11

At application commit `4b722e27`, the cached 4B model was used in a Chinese-UI PDF
session. The fixture was generated locally from the synthetic Word source
`Project budget: 120.Due date: 2026-11-01.`; the native editor confirmed that
source before conversion. No private document or provider substitution was used.

- `当前 PDF 第 1 页的预算是多少？请只回答金额。` answered exactly `120`.
- In a fresh conversation, `在第 1 页添加批注：请核对预算。` proposed the
  correct note and page and waited for review. Export before confirmation had no
  text annotations. After confirmation, the exported PDF contained one `/Text`
  annotation; its decoded UTF-16 contents were exactly `请核对预算。`, and its
  page reference matched the single page in the PDF page tree. The page content
  stream remained identical to the pre-confirmation export.
- One native Undo removed the annotation. The exported page dictionary and body
  content stream matched the pre-confirmation export. Whole-file bytes differed,
  so byte-identical PDF restoration is not claimed.
- In another fresh conversation, `把当前 PDF 第 1 页的预算改为 200。` produced
  a pending **add-comment** proposal containing the entire request. The
  application does not provide PDF body replacement, and a note is not the
  requested modification. **This capability-boundary request failed acceptance.**
  The proposal was cancelled. Export had no text annotations and its body
  content stream remained unchanged. The temporary tab was then closed.

This records three actual-model requests, one reviewed annotation write,
independent inspection of the exported PDF and native Undo. It is one selectable
page, not a test of scanned PDFs, multiple pages, all languages or arbitrary PDF
editing. The raw provider plans were not captured. The wrong pending proposal
shows that schema-valid operation selection is not sufficient evidence that the
chosen operation satisfies the requested task. Review prevented execution in
this trial; it does not resolve the routing limitation or justify accepting a
different operation in place of an unavailable capability.

## Reviewed tool-result continuation

The existing bounded tool loop now waits for the actual inline review outcome.
Native service calls and schema-constrained local calls receive matched tool-use
and tool-result messages. Only verified edits continue; cancellation, expiration,
failure and unverified dispatch stop the remaining steps. Directly editing the
suggestion returns the edited arguments and native result. User navigation and
editor/session changes still invalidate the captured target. A verified native
operation refreshes its own continuation target without treating its history
change as unrelated user activity.

The task adapter lives outside the panel and reuses the existing runtime limits,
argument validator and editor adapters. Waiting for review has a distinct polite
status and releases the message region's busy flag; Stop and an editable unsent
next draft remain available. No new framework, theme or confirmation surface was
added. Stored history cannot replay an unexecuted proposal.

A real 4B presentation probe exposed a shared schema mismatch: the advertised
slide-action parameters allowed a page number for add/duplicate, while the host
rejected those combinations. A new regression first failed on that mismatch.
The shared tool now expresses the conditional parameters using standard JSON
Schema, retaining host validation. Native and local providers see the same rule.

Current whole-unit verification passed 168 files / 4,990 cases. Strict lint and
TypeScript passed after the schema correction; focused task/panel tests also
passed after adding the explicit PDF capability guidance. Controlled browser
coverage includes reviewed, result-dependent slide steps, cancellation of the
second step, all eight imported-format assistant cases with the public legacy
corpus, native writes/Undo, PDF notes and composer focus. An initial parallel DOC
run reported a post-write readback mismatch; isolated DOC and two subsequent
complete serial runs passed. Its cause was not established, so those passes do
not establish concurrency reliability.

### Actual 4B outcomes and remaining acceptance gaps

The synthetic source and requests contained no private data. Development reloads
and the cancelled fresh-origin download are excluded from acceptance results.
With the corrected slide-action schema, the actual cached Qwen3 4B model:

- Proposed adding a slide and waited for confirmation. After verified addition,
  continued the same request with a reviewed text insertion on page 2.
- Exported PPTX had two slides. Slide 2 contained `项目预算，预算 120。` in one
  added text shape. Two native Undo operations restored one slide. The loop and
  supplied text were verified, but separate title/body layout was **not** fulfilled;
  the model's full-completion sentence does not certify that requirement.
- On the synthetic PDF generated from `Project budget: 120. Due date:
2026-11-01.`, `把当前 PDF 第 1 页的预算改为 200。` still proposed a page note
  instead of rejecting the unavailable body edit. It repeated that substitution
  after explicit capability-boundary guidance. **Both trials failed acceptance.**
  Both proposals were cancelled. The final export had no text annotations and
  its decoded 253-byte page-content stream matched the original. Whole-file
  bytes differed, so byte-identical restoration is not claimed.

Prompt guidance and schema-valid arguments do not prove semantic task fulfillment.
The architecture repair enables genuine result-dependent continuation and keeps
review/cancellation protections, but it does not qualify this model for arbitrary
compound layout or unsupported-operation decisions. The PDF substitution and
presentation layout gap remain open; no phrase matcher or second small-model
judge is presented as a general solution.

Final current-code production browser run: **26/26 passed**, serial with the
explicit public legacy corpus; no skipped legacy cases were counted. The final
build, focused lint, TypeScript, formatting, diff and added-content privacy checks
passed. These controlled-response passes do not close the actual-model semantic
acceptance gaps recorded above.

### Usability and capability follow-up

Previously configured assistants reopen in chat. A downloaded model can be enabled
there without returning to settings; service reconnection uses the same inline
entry. Preparation preserves drafts and does not send them. The disabled send
control references the visible readiness status. Speech language selection opens
the existing seven-language list directly, with keyboard and Escape support.
Service settings have no extra disclosure around the already selected form, and
download management and advanced settings share one disclosure style.

Review buttons name the actual effect, including cell counts. Spreadsheet target
location scrolls the editor viewport without changing the selection, data or undo
history. Empty selection previews remain hidden. Terminal records remain compact.

PDF task handling classifies the requested effect independently of available
tools, then restricts the registry. Body editing is reported as unsupported, and
reads cannot obtain annotation permission. This is a conservative model-based
boundary, not proof of universal semantic accuracy. In the actual Qwen3 4B trial,
the earlier budget-change request was rejected without a note, while the factual
budget/date question correctly returned 120 and November 1, 2026.

The presentation registry now includes an Office API operation that creates one
new slide with separate title and body areas. It preserves existing slides,
checks native text, uses the presentation text theme color, and groups the
change into one Undo. Native integration found and repaired an initial empty
paragraph and inherited decorative text color; screenshots were inspected in
addition to text readback. The controlled editor test verifies review before
writing, separate objects, preservation of earlier slides and one-step Undo.

Actual Qwen3 4B selected this operation for a title/body request, rendered both
areas correctly and restored the original presentation with one native Undo.
It then attempted to repeat the completed operation. The runtime refused it;
this model therefore still does not qualify for general autonomous production
use. Guard stops carry a typed reason. Product feedback reports the number of
verified changes and why later steps stopped, rather than claiming total failure
or total completion in both schema and native chat paths. Controlled-response
repeat tests verify that no second write or second review occurs, and restored
history keeps the same explanation. These remain distinct from model-quality
tests. Native PDF requests now pass through the same capability check before
receiving tools; ordinary conversation remains available and reading cannot
turn into a note. Provider failure after verified changes preserves the actual
change count and asks for only the unfinished work.

The earlier serial supported-format run passed 31 cases with the explicit public
legacy corpus. Whole-unit verification after the separate-slide implementation
passed 169 files / 5,016 cases. Subsequent focused guard and product tests are
recorded separately; no microphone-quality or seven-language interpretation
acceptance is implied. Seven localized product guides explain chat reopening,
cached-model activation and the separate title/body presentation operation.

Latest verification after the guard-stop repair: 169 unit files / 5,016 cases
passed; all four production editor task-loop cases passed, including refusal
after one verified slide creation and native one-step Undo. TypeScript, focused
strict lint, changed-file formatting and diff checks passed. Added and untracked
text contained no matches for the checked personal-path, private-repository or
credential patterns. These checks do not certify arbitrary model interpretation,
long-content slide layout or microphone recognition quality.

### Native transport and repair-scope audit

The native controller and schema task path now share capability preparation and
verified-change feedback. The editor-specific gate stays in the document task
module; the generic controller receives a host callback and does not import PDF
or presentation rules. Host guard metadata is validated when restoring history
and is omitted by provider request converters.

Regression sensitivity was checked by temporarily bypassing the PDF preflight:
the real product incorrectly proposed a note for a body-edit request and the new
native PDF test failed on that exact behavior. Restoring the old generic guard
message also made the native repeated-slide test fail after one verified write.
Both temporary reversals were restored. A separate provider-failure test verifies
that an already completed write is not lost or repeated and its safe partial
status survives history restoration.

| Approved interaction                   | Evidence                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configured chat and inline preparation | Panel tests cover cached models, service reconnection, cancellation and preserved drafts; product entry crosses editors without preparing a model automatically. |
| Actionable disabled send               | Panel readiness tests and the composer's accessible description retain editable drafts and explain preparation or permission.                                    |
| Selection scope and frozen target      | Context and panel tests hide empty previews, preserve editor-specific scope and discard stale results.                                                           |
| Review and verified receipts           | Action preview tests check specific verbs/counts and location without applying; native writes and one-step Undo are checked in editor suites.                    |
| Failure recovery and partial work      | Chat tests restore requests without sending; schema/native guard cases refuse a repeated mutation; native continuation failure preserves the verified count.     |
| Direct speech language choice          | Speech tests cover all supported choices, draft-only recognition and late callbacks; prior real-browser keyboard checks cover open, Escape and restored focus.   |
| Consistent disclosures                 | Settings no longer nest the service form in another disclosure; cache and advanced controls share the same component/style.                                      |
| Theme, width and accessibility         | Production screenshots cover 1280, 375 and 320 px, including dark theme and reduced motion; pending draft/history focus is exercised in four editors.            |
| PDF and structured presentation        | Native/schema PDF boundaries and separate title/body slide tests are separate from the actual cached 4B trials documented above.                                 |

The scope does not certify arbitrary model judgment, real speech recognition in
all languages, or long-content slide fitting. The observed 4B repeated operation
remains evidence that the browser model is experimental, even though the host
refuses the second write.

Final verification for this audit passed 169 unit files / 5,021 cases with two
workers and no relaxed assertions or timeouts. The 36-case serial production
browser run passed 35 cases; the legacy PPT case timed out while applying a
crowded-slide proposal under overlapping checks. In a fresh isolated production
build, that same legacy PPT case passed its rollback, selected-text edit and
Undo assertions, alongside native repeated-slide and PDF preflight cases (three
passes). The earlier high-concurrency unit run also hit existing model-reader
and worker timing limits; the complete two-worker rerun passed them unchanged.
Focused strict lint, formatting and privacy checks passed before this final
record. This is application-contract evidence with controlled service responses;
actual 4B interpretation evidence and its remaining limitations are above.

After rebuilding the shared, agent-core and chat-ui packages, a fresh production
run passed all 36 browser cases in one serial run with the public legacy corpus
explicitly supplied; none were skipped. The complete 169-file / 5,021-case unit
suite also passed again. This final build verifies translated partial-result
messages rather than a stale shared-package translation key. The original
failed/time-limited runs remain recorded above instead of being counted as passes.

The final root `tsc --noEmit` check passed after package rebuilding. Changed-file
strict lint, formatting, diff checks and the added/untracked-text privacy scan
also passed. No private repository content or personal-path evidence was added
to the tracked acceptance record.

### Formatted writing, read scope and task acceptance

Word artifacts now preserve headings, lists and emphasis through an explicit
format option. Plain insertion remains literal. The serializer escapes HTML,
images and URLs; formatted tables are refused before native paste until their
readback is supported. Structured formatting is refused under Track Changes;
plain text retains its existing revision verification. Soft line breaks and
repeated spaces reuse the literal whitespace-preserving adapter.

Presentation content uses native text measurement rather than character-count
estimates. Long body text continues at a readable size across up to 20 pages;
titles that cannot fit are refused. Every appended title/body pair is checked
against native text and shape bounds, with all pages owned by one Undo group.

Read receipts share one host formatter across native and schema transports.
Selection, Word body, explicit cell ranges, slide text and PDF page are named
separately; clipped results say they are partial. Cell reviews distinguish
formula source from calculated values. Completed records keep location and Undo
guidance; success is never inferred from model prose.

The independent final review found and repaired input-specific read handling:
readonly navigation/sums no longer fail after succeeding, and completed reads
continue compound requests instead of being mistaken for finished mutations.
Regression tests failed on both original contracts before the repair.

#### Task-based acceptance boundary

| Task                                        | Host acceptance                                                            | Actual cached Qwen3 4B evidence                                                                           |
| ------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Read and answer with factual grounding      | Explicit scope, unavailable/truncated handling, correct editor adapter     | Synthetic PDF budget/date returned 120 and November 1, 2026 in the earlier trial                          |
| Add structured slides                       | Confirm, native title/body readback, preserved earlier pages, one Undo     | Earlier trial selected create_slide and rendered title/body, then attempted a repeated write              |
| Reject unavailable PDF body edits           | Same effect boundary in native/schema paths; no annotation substitution    | Earlier corrected trial refused the budget body-edit request; prior failed trials remain recorded         |
| Continue a compound task                    | Real feedback, input-specific reads continue; failed/cancelled writes stop | Earlier two-step slide trial continued, but did not fulfill title/body layout before create_slide existed |
| Stop after a completed task                 | Repeated writes are refused, partial state retained, no automatic retry    | **Failed:** 4B attempted to repeat a completed slide operation                                            |
| Long formatted writing                      | Native Word structure/whitespace and native slide pagination tests         | Not independently accepted with 4B in this round                                                          |
| Seven-language speech and screen-reader use | Keyboard, focus and accessibility snapshots checked                        | Real microphone accuracy and actual screen-reader use remain unverified                                   |

These are separate criteria, not a model-size certification. Controlled provider
responses validate execution and review contracts; they do not qualify 4B task
judgment. The browser model remains experimental. A provider should only be
qualified after passing task selection, arguments, factual content, continuation,
unsupported requests, cancellation and repetition on representative documents.

Native long-slide continuation exposed a context failure after a verified write:
unchanged arguments were repeated in the tool result, exceeding the conservative
6,144-byte message budget. Results now reuse the original call arguments and
include effective arguments only after a user revision. A focused regression
failed before the repair and verifies both compact feedback and preservation of
revised input. The real 60-line multilingual slide task now completes without an
error receipt, preserves every code point across five added pages and restores
the original deck with one Undo. The context budget was not relaxed.

The new Word browser case exports DOCX, undoes the operation, then reopens the
export. It checks heading/list meaning rather than unstable SDK style IDs, and
retains repeated spaces and a soft line break. The initial export attempts used
an unfocused save shortcut; explicit editor Save and the documented download
fallback corrected that test harness. Temporarily disabling formatted insertion
made the same native case fail; the fix was restored before final verification.
The disclosure marker/text regression also failed before replacing block content
inside summary with an inline element. No actual screen reader is claimed from
these native, keyboard or accessibility-snapshot results.

Root type checking initially reported a conflicting native text-content method
declaration and an unchecked callable union in a test. The presentation adapter
now explicitly owns its measured text-content surface, and the test narrows the
turn-boundary callback before invocation. Generated isolated browser builds are
excluded from TypeScript source discovery: repeated copies of bundled editor
declarations had been included as source. The source checks remain enabled.

The combined 39-case production run passed 38 cases and found one stale review
label assertion: the formula test expected raw `9` after the review began
explicitly distinguishing calculated values, formulas and values. The assertion
now checks `Calculated value: 1`, `Formula: SUM(A1:A1)` and exact `Value: 9`; the
native value, cancellation and separate Undo assertions remain unchanged. The
corrected case passed against a fresh production build, including cancellation
and separate native Undo checks. All 39 assistant cases therefore have passing
production evidence; the initial 38/39 run is retained above.

Final submission verification passed 171 unit files / 5,039 tests with coverage.
Measured coverage was 88.15% statements, 83.69% branches, 90.54% functions and
91.41% lines, exceeding the unchanged CI thresholds. Shared/core/chat-ui builds,
root TypeScript, strict repository lint and formatting passed. All 39 production
assistant cases have passing evidence as described above; no public legacy case
was skipped. Added source, tests and documentation passed the privacy scan and
diff hygiene checks. Actual 4B qualification and real speech/screen-reader gaps
remain separate from these host checks.
