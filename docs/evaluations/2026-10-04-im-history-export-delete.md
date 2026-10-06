# IM history export and current-conversation deletion

Product after `f0c37da` was exercised with an owned warm Chromium WebGPU profile, English Word IM and actual Qwen3-1.7B chat. Persistent conversation saving was explicitly disabled for this diagnostic, so only the newly generated in-memory conversation was deleted. The existing confirmation for irreversible history deletion is separate from document edits; no new confirmation was added.

After the real greeting reply, the settings export action produced an actual browser download parsed from its temporary file. It contains one session, the entered user message and the assistant text content. Top-level and session key sets exclude provider settings; the custom system prompt and generation values are absent. The filename's date matches the exportedAt UTC date, which is the previous calendar day relative to the local Asia/Shanghai date in this run.

Canceling current-conversation deletion leaves the visible reply unchanged. Confirming it subsequently leaves no assistant messages in the panel. Native Word text remains exactly empty before chat, after chat and after deletion. No recorded page or visible message errors or preview cards occurred. The verifier checks downloaded content, filename, complete snapshots and driver SHA-256.

One readability issue is preserved in the raw evidence: the exported assistant text is `<think>\n\n</think>\n\nHello!`, while the UI displays Hello. Thus functional export passed, but clean user-facing export is not fully achieved. The downloaded JSON structure has empty thinking markers, not a leaked nonempty reasoning passage. No product fix is included in this evidence commit.

This does not verify saved IndexedDB deletion/restoration, multi-session export, imported JSON validation, reload persistence, CPU history, physical devices, cold offline or network privacy. The profile is warm, service workers are blocked and network is available. Empty-document Undo/Redo values are ignored. No model default or product code changed.
