# AI workspace craft and workflow completion

## Confirmed direction

The user approved implementing the concrete improvements discussed in this conversation, continuing in PR #274 with multiple commits. The product is a browser-first document AI workspace. Preserve a flat, quiet interface, one composer boundary, document scope, explicit review, local/offline operation and seven complete locales. The user does not want another confirmation round for this approved direction.

The preceding reliability/recovery stage is complete at cf76dbe: 19 remote checks passed, 6,008 unit cases passed locally, seven sources/artifacts browser cases passed. Independent review approved source recovery, artifacts, contracts and final Drive disconnect ordering. Google OAuth credentials have not been created or configured (user confirmation); live consent cannot be verified until configuration exists.

## Product outcomes

1. Stable writing: preserve draft, caret, scroll and appropriate focus across child views and conversations. Context labels reflect selection/document scope without changing a draft or submitting.
2. Immediate, local feedback: copy/save receipts beside the action; one-line truthful operation status; no unsolicited notifications, decorative loops or auto-send. Result follow-ups are bounded host actions that stage a draft and never overwrite an existing one without a visible choice.
3. Sources that can be understood: search, inspect a read-only excerpt, see limits/truncation and use stable source identifiers. Click citations to inspect the captured original and locate a supported document anchor. Support bounded local Office/PDF extraction independently from the active editor; Drive search and resource pagination remain explicit.
4. Persistent working results: select text in an artifact and ask AI to revise that range, or revise all. Bind expected version and original draft/selection; preview a proposal and never overwrite later edits. Add bounded structured table/slides payloads and offline exports, preserving old text records and atomic version conflicts.
5. Understandable changes: reuse ActionPreview diffs, add supported native target location and a temporary visual cue without modifying document formatting. Group known task actions into a compact task record. Offer conditional native Undo only while the owned history tail remains unchanged; otherwise explain that newer edits must be preserved.
6. Coherent organization: keep model services, source authorization, artifact persistence, view navigation, task review and native history ownership separate. Extract new integration from panel.ts instead of growing another monolith.

## Architecture and contracts

| Owner                                                          | Evidence / extension                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChatView in packages/chat-ui                                   | Existing scroll-follow control, textarea, copy states and optional host callbacks. Add explicit viewport snapshots and bounded host result actions; no connector/storage imports.   |
| ui/panel-context.ts / composer-context.ts / task-entry.ts      | Existing event-driven captured selection. Keep document/selection freshness; display intent and stage user text only.                                                               |
| ui/sources-view.ts / connectors/reference-sources.ts           | Immutable in-memory snapshots, per-operation validity and capacity bounds. Add search/read-only preview owner and stable citation ids; never interpret source text as instructions. |
| ui/request-context.ts + inference consumers                    | Existing bounded JSON excerpts in every inference route. Carry stable source ids into request and render-time metadata; resolve only captured ids, not arbitrary model URLs.        |
| artifacts/store.ts / ui/artifacts-view.ts                      | Separate IndexedDB, explicit persistence and expectedVersion checks. Add backward-compatible validated payload kinds and proposal ownership.                                        |
| DocumentToolTarget / ActionPreview / native history owners     | Existing freshness, review, verified outcomes and owned rollback. Extend capabilities only where a real native anchor/history contract exists.                                      |
| New ui/workspace-navigation.ts and focused integration modules | Own view/conversation snapshots and result workflow callbacks. panel.ts remains composition and request coordination.                                                               |

Artifact edits use an artifact-origin request binding (id, expectedVersion, draft revision/content, selected offsets, reference snapshot). They expose no Office write tools. A proposal is not a saved version; the user accepts it into the editor and explicitly saves. Table and slides payloads are declarative bounded data, never executable HTML/JS.

Sources have title, stable id, bounded text, format and optional safe location metadata. Standalone extraction must not call handleDocumentOperation or createEditorInstance. ZIP formats are parsed with inflated-size/entry/paragraph/cell bounds. PDF extraction requires a standalone lazy worker. Drive and MCP discovery are explicit, cancellable and scoped to the operation. Source indexing across an organization's entire account is not implied by adding search to explicitly accessible resources.

Undo receipts are volatile host objects tied to document identity and exact native history tail. A later edit, Undo/Redo, document replacement or mismatch invalidates the action. Do not loop Undo across user changes. Location/highlight is capability-based: use a native location/geometry anchor; otherwise show the available range/page and explanation rather than guessing by duplicate text or changing formatting.

## Scope lock

Allowed: app-owned agent UI/domain/integration, bounded standalone source readers, shared chat UI contracts/styles, seven shared locales, relevant converter helpers only when they do not open/replace the active editor, source backend search, docs, targeted tests and required dependency/worker setup.

Untouched: vendor/OnlyOffice bundles, app installation icon backgrounds, existing main document save/history identity and implicit model/provider behavior. No second agent runtime, review framework or conversation database. No arbitrary generated code execution, automatic authorizations, downloads, retries or sending. MCP tools/stdio and unrestricted app execution were capability comparisons, not selected product workflows; browser stdio additionally needs a separate native host.

## Alternatives

Adopt existing queue/review/provider/store owners and small explicit contracts. Reject a new UI framework and full agent framework as unnecessary. Prefer local search over attached/discovered material before account-wide embedding infrastructure. Prefer declarative structured artifacts and native review to running generated applications. Prefer a guarded Undo receipt to unsafe broad checkpoint restoration. Reuse tokens and existing components instead of copying third-party component source.

## Acceptance

Every listed outcome has focused red-green tests and browser verification in light/dark/narrow states. Preserve keyboard/IME, clipboard content, reference budgets, document freshness and explicit consent. Every error preserves the user's draft and offers an honest recovery. Inspect actual screenshots, not only computed CSS. Full coverage/type/lint/format/build and latest PR checks must pass; repeat overall review after CI. Report live OAuth as unverified until real deployment configuration exists, with actionable setup documentation.

Implementation budgets and the per-outcome acceptance map are normative in the companion plan’s “Binding limits and acceptance map” section. They bound structured storage, standalone extraction and capability-based fallbacks before implementation.
