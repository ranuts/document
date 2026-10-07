# WebKit offline office initial observation

The native process exited 1. Receipt SHA-256: `3489c08ba7352e7d8a4b03fb041e3eb974f7413810b2d9d969db2bf556b44e67`. The exact executed driver is retained unchanged, including two no-unused-expressions lint warnings in its history loops. Those warnings were not resolved before execution; no lint-pass claim is made. Any corrected driver must have a new identity.

Both editors warmed online with the expected default CPU model and stamped worker version. The first browser process disconnected and closed. After relaunch, offline mode was enabled before navigation. Excel loaded through the service worker, restored the CPU model, generated a nonempty actual SDK chat response, and left B2 unchanged during chat.

The instruction `Set B2 to "00123".` resulted in B2 `123`, with a document-verification error. This is a literal-preservation failure, not a successful edit. The run stopped before Excel Undo/Redo, Save/reopen and before offline PPT execution. PPT only has online seed evidence. Final context/browser closure is recorded, and page errors are empty. Request failures for worker/spelling assets remain recorded separately.

The existing tool supports valueType=text, but this receipt does not capture the edit plan. It cannot yet distinguish a planner omission from a native text-write defect. Next inspect the deterministic single-cell action path and reproduce its dispatched value type before changing the writer. Desktop WebKit is not physical Safari/mobile or installed-PWA acceptance; inherited model cache is not cold-cache isolation.
