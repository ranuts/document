# Offline Excel plan boundary observation

The unchanged stamped product reproduces the leading-zero failure. The process exits 1; final context is closed and browser disconnected. Original receipt SHA-256: `7d1ff339b3d7dcd5d0c9371ab0eeca2b45b87317e1b756aa395331f9b9510706`.

The actual CPU completion is `{"tool":"set_cell","input":{"cell":"B2","value":"00123"}}`. It retains the string bytes but omits valueType=text. The tool then uses native automatic value parsing, producing B2 `123`; document verification rejects the mismatch. This locates the loss after model content generation and before verified success. It does not establish a defect in the existing explicit text writer, which was not selected.

The corrected observation driver captures non-stream completions without changing requests. It has a new identity and passed changed-file lint before execution; the original driver and failed observation remain intact. This run stops before history/Save/reopen and provides no PPT offline result. Next enforce the explicit quoted assignment's text type without changing ordinary unquoted numeric parsing, test model mismatches before dispatch, and repeat native history/save/reopen checks.
