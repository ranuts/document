# Editor review fixes implementation plan

**Goal:** Fix all six findings from the October 15 review, preserving the existing dependency updates.

**Architecture:** Keep the current browser-only editor, storage schema and public APIs. Bind saves to the exported SDK revision; fit optional context inside the runtime budget; use ordered IndexedDB reads. Extract panel responsibilities into focused local modules.

**Evidence and scope lock**

| Finding                                      | Evidence                                                                                                            | Accepted outcome                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Save clears later changes and does not rearm | Chrome standalone reproduction, SDK history 5 → 11 while unload guard stays clean; delayed writer unit reproduction | Save points checked at export and disk completion; subsequent edits rearm recovery       |
| Context character/byte mismatch              | 2,500 Chinese characters make a short question fail before inference                                                | Optional reference context fits after reserving the user request; truncation disclosed   |
| Oversized snapshot evicts unrelated history  | 120-byte snapshot against 100-byte budget removes earlier recovery                                                  | Reject impossible writes before eviction; trim own revisions before unrelated documents  |
| Recovery reads all versions                  | `history/store.ts` getAll on blob index                                                                             | Latest reads one version; trimming reads only discarded versions                         |
| Two upgraded-jsdom tests fail                | Full suite: 5,321 pass, two fixture failures                                                                        | Model cross-origin property access and actual focus ownership                            |
| Panel mixes lifecycle, tasks and DOM         | `ui/panel.ts`, 2,905 lines                                                                                          | Extract endpoint lifecycle, controller task bindings and settings view into local owners |

Allowed files: `lib/onlyoffice/{save-point,save-stream}.ts`, `lib/onlyoffice/guards/serverless-save.ts`, `lib/history/{store,index,autosave}.ts` if needed for save/recovery integration; `packages/agent-core/src/{runtime,context-budget}.ts`; `lib/agent-plugin/ui/{panel,controller,request-context}.ts` and new adjacent focused panel modules; related unit/E2E tests; `CHANGELOG.md`, `CLAUDE.md`, this plan and an exploration record.

Implementation scope excludes changes to the vendored SDK, fonts and models, hosting and CI, the public embed protocol and storage schema. The pre-existing dependency manifest/lockfile updates are retained in a separate tooling commit for the PR.

Scope clarification: update the existing `agentContextTrimmed` wording in all seven `packages/shared/src/i18n/messages/*.ts` tables so it accurately covers a partial document reference as well as older conversation turns. No translation keys or public types change.

Compatibility red lines: keep original model consent/defaults, explicit cloud selection, review-before-apply, standalone/embed save separation, readonly restrictions, seven-day retention, cancellation and file association behavior. The initial fix request excluded pushes and deployments. The follow-up explicitly authorizes creating a PR with multiple commits, one feature per commit; deployments remain outside scope.

## Tasks

1. **Save correctness:** Add failing unit tests for edits during export/write, same-history-point edits and document replacement. Persist the standalone export save point and commit only for the same editor/revision. Add real editor save → edit and delayed write E2E regressions.
2. **Context budgeting:** Add failing runtime tests for Unicode/escaped context, full user requests and exact-budget providers. Fit optional request context without corrupting user prompts/history or tool exchanges. Preserve structure and explicit partial-read flags for document reference data.
3. **History budget and reads:** Add failing tests for impossible writes preserving existing records, own-revision budget trimming, and bounded blob reads. Use reverse ordered lookup for latest and key-first retention. Keep accounting/deletion transactional and cancellation-safe.
4. **Test fixtures:** Repair the two previously reproduced fixtures without weakening the production behavior assertions.
5. **Panel responsibilities:** Extract endpoint lifecycle (stale connection cancellation/disposal), controller task bindings (scope/tools/review/context), and settings DOM composition. Reuse existing behavioral tests and add focused lifecycle tests for stale connections.
6. **Verification and documentation:** Update changelog and exploration evidence. Run format, lint/types, full unit suite with coverage, production build, and focused real-editor/assistant E2E. Review the complete diff with a fresh reviewer, address substantive findings, then report limitations.

## Acceptance

- Saving an old export never clears newer edits or another document; another edit after save reactivates unload/recovery.
- Short questions remain usable with long Chinese, emoji and escaped document context; genuinely oversized user prompts still reject explicitly.
- A failed oversize recovery write leaves existing history and file handles intact; accepted history fits the effective budget.
- Latest recovery reads one blob; retention never clones retained blobs merely to count them.
- All existing unit tests pass under the current installed dependencies.
- Panel extraction preserves source/provider selection, cancellation, review and conversation behavior.

## Simplest alternatives and execution rulings

- Reuse and strengthen the existing save-point helper; do not add another dirty-state owner.
- Keep the conservative default runtime byte ceiling; shrink optional context instead of increasing all model limits.
- After synchronizing main, preserve its v3 revision-size key index and reverse latest-value cursor; this branch adds no IndexedDB migration.
- Move responsibilities into local modules; no new framework or shared package.
- User explicitly requested all proposed fixes; execute inline under that scope without another permission round.
- The PR follow-up supersedes the initial uncommitted-delivery ruling: commit by feature, retain the pre-existing dependency update in its own tooling commit, push the branch and create one PR.

## Progress

- Baseline: main at `1330b3c5`; created `codex/editor-review-fixes`; pre-existing `package.json` and `pnpm-lock.yaml` modifications preserved.
- Tasks 1–5 implemented; save point/lifecycle tests 48 passed, history/fixture tests 75 passed, AI context tests 44 passed, panel/endpoint tests 185 passed. New failure cases were observed before implementation.
- Initial complete unit suite with coverage and production build passed. Final E2E, reverse verification and review remain in progress.
- Complete: final full suite 177 files / 5,344 tests passed with coverage thresholds; nine save Chrome tests and twelve other focused Chrome tests passed. Lint/types, format, build and diff checks passed. Original-source reverse verification produced 17 expected failures. Independent final source review approved.
- Follow-up rulings: SDK busy state ends before conversion finishes, so bind save points to conversion result identity and actual stream order. Serialize disk writes and suppress late older ordinary-save results, while preserving independent other-format exports. The initial delivery kept changes uncommitted for user review.

- PR preparation: split into seven commits and replayed onto main at `03e6b7cd`. Preserve upstream queue/conversation/speech/model-cache ownership, request-scoped native tool binding and v3 key-only retention. The latest-read optimization already exists on main; its separate commit now adds regression coverage. Fresh integrated unit coverage passed: 201 files / 5,879 tests, all thresholds; lint, rebuilt workspace declarations, type checks, production build and independent review passed. Fresh focused Chrome verification passed all 21 cases (9 save, 3 embed dirty-state, 5 assistant entry and 4 composer cases).
