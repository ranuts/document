# Assistant workspace owners

The panel composes existing inference and document-review lifecycles with two independent features. A model service is an execution destination, a connector is a reference source, and an artifact is an explicitly saved result. None creates a site account.

## Sources

`connectors/reference-sources.ts` owns immutable reference snapshots, per-conversation attachment sets and a read-only MCP client. Local references support `.txt`, `.md`, `.csv`, `.tsv` and `.json` up to 256 KiB; binary Office/PDF files must first be exported as text. Up to five attachments are selected explicitly. Attachments remain in memory and are not silently restored from disk.

The MCP client supports the 2025-11-25 Streamable HTTP resource protocol with JSON and SSE responses. It lists the first 100 resources and reads selected text resources. It does not invoke tools, run server instructions, implement stdio or handle provider OAuth. Use an explicitly configured HTTPS endpoint or HTTP loopback endpoint, with browser CORS access. An optional bearer token remains in memory. This is separate from the editor's outbound WebMCP tool exposure.

`ui/sources-view.ts` owns source management and authorization completion presentation. Authorization failures restore connection controls and clear expired discovery results without silently dropping attached snapshots or retrying. Attachment capacity errors identify the five-source limit. Source reads have byte limits and deadlines; epoch checks prevent late reads from entering another conversation or reattaching after disconnect. `panel.ts` captures selected references at enqueue, guards them before execution and continuation, and cancels execution when its attachments are invalidated. Adding another attachment cannot change an already queued snapshot.

`ui/request-context.ts` creates bounded JSON excerpts with source titles, connector identity and truncation flags. Instruction and existing request-envelope headroom are reserved. Native requests, conversational requests, document drafting and dedicated writing routes receive quoted reference data through their existing owners. Remote content never adds tool definitions or bypasses host review.

Google Drive is optional and uses the [server connector](google-drive-connector.md). The service worker bypasses all `/api/connectors/` routes, including OAuth callback navigations, so authenticated responses cannot become offline assets. Cloudflare's `_routes.json` restricts function invocation to the Drive API path. Static deployments retain local/MCP references and explain unavailable cloud routes.

## Artifacts

`artifacts/store.ts` owns a separate IndexedDB database with artifact bodies and metadata-only list summaries. Saving is explicit; conversation-history opt-in does not implicitly save results. A store holds at most 50 artifacts, 20 versions each and 128 KiB UTF-8 per version. Limits reject with a visible recovery message; existing versions are never silently pruned.

Updates check the expected version inside the same read-write transaction that appends the new version. Concurrent editors cannot overwrite one another. Selecting an older version and saving creates a new version. Deletion requires an explicit UI confirmation. Failed saves preserve editable drafts. Capacity errors distinguish artifact count, text size and version history. At 20 versions, an explicit save-as-new action preserves the draft and source provenance in a separate artifact without modifying existing history.

`ui/artifacts-view.ts` owns local text editing, version selection and conflict presentation. The generic chat package provides an optional host save action with opaque, render-time provenance. It does not know IndexedDB or connectors. Source titles and conversation identity are captured with live results; old restored results with no retained source metadata do not invent source provenance.

Applying an artifact captures a fresh Word target and creates the existing `ActionPreview`; nothing writes until the user confirms that preview. Queue application leases, target freshness, host verification and native Undo remain the existing owners. The artifact editor never executes generated code or renders arbitrary HTML.

## Offline availability

Offline mode hides Google Drive authorization and browsing, the downloadable model catalog and remote model URLs. It retains attached reference snapshots, local file attachment, saved artifact editing and versions, cached model management, local GGUF files, and local or LAN services/MCP. Existing cloud configuration remains inspectable. Connectivity restoration only restores controls; it never authorizes, downloads, reconnects or resends automatically. Browser connectivity is a presentation signal; actual request failures still receive actionable recovery messages.
