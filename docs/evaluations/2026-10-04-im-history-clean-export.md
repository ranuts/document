# Remove empty reasoning prefixes from conversation downloads

The preceding actual download contained `<think>\n\n</think>\n\nHello!`, although the IM displayed Hello. Export now cleans a leading empty think protocol region from assistant strings or an assistant's first text block in the detached exported snapshot. The authoritative memory, saved history and model-facing messages are unchanged. User text, later text blocks, tool blocks, embedded examples and nonempty reasoning regions are not processed by this cleanup.

This follows the UI's existing leading-protocol convention. A literal assistant example beginning with exactly an empty think region is indistinguishable from that protocol, so this is not a claim that arbitrary leading literal markup is lossless. Nonempty reasoning is deliberately retained in exports; this change does not make exports reasoning-free.

The new unit regression failed before the fix on the observed empty-prefix case. It covers string/first-block cleanup, user and later-block preservation, embedded examples, nonempty reasoning and unchanged in-memory history. Build, 116 test files / 4202 tests and lint passed. Independent review found no Important issue and identified the literal-prefix ambiguity documented above.

Actual owned warm Chromium WebGPU Qwen3-1.7B IM chat produced a browser download with one user message and an assistant text block containing exactly Hello, without the empty prefix. Canceling deletion preserves the visible reply, confirmed current-conversation deletion clears it, and native Word text remains empty. The verifier checks exact download structure, reply and snapshots, and binds the report to executed driver SHA-256. The earlier negative report remains unchanged.

Only in-memory conversation saving is used in this sample; persistence is explicitly disabled. Saved IndexedDB export/deletion, multi-session content, arbitrary literal markup, CPU, cold offline, physical devices and network privacy are outside this browser evidence. Inherited empty-document Undo/Redo fields are ignored. No model default or interface step changed.
