# Failed write verification in the actual IM

Ran the built Excel IM on the cached CPU fallback using the complete request `读取 A1:B4 的内容，然后将 B2 设置为 "00123"。`. The planner and native tools were unchanged; no execution or readback failure was injected.

The read completed with B2=30. Native Excel paste coerced the quoted text 00123 to numeric 123. Exact post-write verification detected the mismatch. IM displayed “The change could not be verified. Check the document and use Undo if needed.” and retained the completed read, with no final success or preview card. The write did occur: the observed snapshot differs only at B2=123. No page errors occurred; the plugin hash remained unchanged.

This proves the verification-failure feedback path and exposes an unresolved literal-text fidelity defect. Error reporting does not undo or prevent the native coercion. Preserving numeric-looking text (including leading zeros) needs a native text-writing strategy that respects formatting and Undo; the failure must not be hidden by relaxing the exact-value check.

A panel regression additionally checks that completed read/error messages survive returning to the original conversation without displaying success. Scoped validation: 61 tests across panel-loading and DocumentToolAction passed; TypeScript, scoped lint and diff whitespace checks passed. Product code did not change in this diagnostic turn. No claim is made about native Undo/Redo of this particular failure case or broad model semantic fidelity.
