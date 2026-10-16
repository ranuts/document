# AI workspace sources and artifacts

## Confirmed scope

The user approved both connector classes in PR #274, staged commits, and optional Google authorization with a Cloudflare backend. The editor remains usable without an account. Existing uncommitted interaction improvements are retained and verified first.

## Assumptions and owners

| Assumption                                                                            | Evidence                                                                                | Status                                                   |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Model configuration and layout already have separate owners                           | `lib/agent-plugin/ui/settings-view.ts`, `endpoint-settings.ts`, `endpoint-lifecycle.ts` | Code fact                                                |
| Request context is bounded and captured per request                                   | `lib/agent-plugin/ui/request-context.ts`, `controller-bindings.ts`                      | Code fact                                                |
| Requests execute sequentially with captured bindings                                  | `lib/agent-plugin/ui/request-queue.ts`, `panel.ts`                                      | Code fact                                                |
| Document mutations require the existing review owner                                  | `lib/agent-plugin/ui/action-preview.ts`                                                 | Code fact                                                |
| Google connection is optional; both connector categories belong in the same PR        | User statements                                                                         | Confirmed                                                |
| Production OAuth credentials and Google app verification are deployment prerequisites | Google OAuth server flow documentation                                                  | External requirement; not configured by this code change |

## Stages and change list

1. Retain compact composer, collapsed queue, settled result receipts, safe actionable errors and transparent tab icons. Verify pending regressions before committing.
2. Scope settings to selected execution source. `settings-view.ts` owns conditional local fields; `panel.ts` scopes cache hints. Keep review preference global. Add focused unit and browser regressions.
3. Add `lib/agent-plugin/connectors/` contracts and bounded reference readers. Explicit local text files and user-configured read-only MCP resources share source snapshots and disconnect invalidation. Remote contents remain reference data, never tool instructions. No automatic tool execution or connection.
4. Add optional `functions/api/connectors/google/` authorization and Drive read routes, with server-only credentials, state/PKCE, encrypted HttpOnly session, same-origin mutation checks, bounded reads and safe errors. Add deployment documentation and deterministic handler tests. Static deployments report unavailability and retain local features.
5. Add artifact domain/storage under `lib/agent-plugin/artifacts/`: explicit save, editable versioned text, provenance, atomic conflict detection and deletion. Separate database from optional conversation history. No generated code execution.
6. Add focused source/artifact UI owners and integrate through panel composition, context capture and generic result actions. All seven locales. Present flat lists, one input boundary and one primary action. Restore/apply always requires fresh document review.
7. Review architecture and end-to-end flows; full type/lint/format/coverage/build plus real-browser narrow/light/dark recovery/source/artifact tests. Push commits to #274 and inspect every remote check.

## Scope lock

May touch the assistant UI/domain, shared seven-locale messages, generic chat action extension points, related CSS/tests/docs, optional Cloudflare functions and their deployment configuration, and the service-worker bypass for authenticated connector routes. No vendor runtime, converter behavior or document format changes. No automatic merge or deployment; no account requirement; no frontend secrets; no weakening COOP/COEP; no provider requests before explicit action; no automatic mutation from remote resources; no silent resends; immutable queued reference snapshots and stale-source invalidation; preserve bounded request envelopes and host review/Undo.

## Simplest alternatives

- Keep existing provider lifecycle and review owners rather than introducing another agent framework.
- Start MCP with read-only resource discovery/read rather than arbitrary tools or a universal OAuth client.
- Start local references with explicitly supported text formats and visible size limits rather than treating binaries as text.
- Use Cloudflare Pages Functions and encrypted short-lived session cookies rather than site accounts or a separate application server.
- Persist text artifacts and versions locally on explicit save rather than executing generated applications or creating a second office editor.
- Keep existing native document canvas as the application destination; artifact editing is text/version work, applying to a document goes through fresh review.

## Acceptance

Every active mode shows only relevant configuration. Selecting cloud never displays local cache/runtime guidance. No connector activity without explicit action. Google tokens never reach JavaScript, URLs, logs or localStorage. Missing server configuration produces understandable setup status. Reference reads are bounded, cancellable and invalidated after disconnect; queued snapshots cannot silently change. Artifact changes persist and conflict safely; prior versions remain available; applying cannot bypass review. New UI is keyboard-accessible, flat and compact. Unit, browser and CI checks pass before reporting completion. Live Google authorization requires deployed credentials and is reported separately from deterministic test coverage.

## Implementation and local verification

Implemented the source-specific settings, compact composer/queue/result feedback, safe service error recovery and transparent tab icons. Added local/MCP and optional Drive sources, bounded context across native/structured/read/writing/draft paths, per-conversation snapshots and deletion/disconnect invalidation. Added explicitly saved artifact versions with atomic conflicts and fresh native document review. Kept connector, artifact, queue, settings and review owners separate. MCP credentials remain behind a disclosure and no disconnected action is presented as active.

Full local coverage run: 5,988 tests across 213 files passed, meeting coverage thresholds (88.6% lines, 82.37% branches). Subsequent focused regressions cover conversation-source deletion, human-readable provenance after locale changes, existing settings listener/disclosure behavior and cloud cache-hint visibility. Sixteen final assistant/PDF browser scenarios passed; theme/icon scenarios and the two queue scenarios passed in dedicated runs. Type/lint, format and production build passed. Inspected source, artifact and cloud settings screenshots in narrow/light/dark states.

Google handler verification uses mocked Google endpoints. Real consent and token exchange on the deployed host remain a deployment check requiring the documented OAuth configuration; no live Google authorization is claimed. Final remote CI verdict is tracked in PR #274.

## Offline follow-up

Implemented connectivity-aware progressive disclosure: hide network-only Drive and model-download controls while retaining local files, attached snapshots, saved artifacts, cached models, GGUF files and local/LAN endpoints. Preserve drafts and configuration across connectivity changes without automatic requests. Regression coverage includes real browser offline artifact version saves and restoration without connector calls. Full coverage: 5,997 tests across 213 files; thresholds passed. Type checking, formatting and production build passed.

## Review recovery fixes

Four review findings now have regression coverage: expired Drive/MCP authorization restores explicit connection controls; discarding version edits restores both title and text; artifact count/text/version capacity errors are distinct with save-as-new recovery at the version cap; attachment overflow explains the five-source limit and removal unblocks retry. Canceling a version switch preserves the previously selected version and draft. No automatic reconnect, source removal or overwrite of existing artifact history is introduced.

Final review additionally found that an obsolete source read retained the busy lock after a conversation switch. Each operation now owns its own validity guard and busy settlement; switching or disconnecting releases obsolete UI ownership immediately, while late results cannot attach or alter the newer status. Regression coverage includes both settlement orders and a real-browser delayed Drive read across a new conversation.
