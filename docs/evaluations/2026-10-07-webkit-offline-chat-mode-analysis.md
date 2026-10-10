# WebKit offline insertion observer correction

The observer completed with a 90-second document assertion timeout. Native Word text remained blank, the input was enabled, and the assistant returned `WEBKIT_OFFLINE_WRITE_20261007` without a chat error.

The driver did not select `.agent-writing-task` value `tools`. In `lib/agent-plugin/ui/panel.ts`, document tool planning is entered only in that mode. This run exercised chat and cannot establish an offline tool failure. The earlier record without failure snapshots remains inconclusive; this fresh run does not retroactively supply its missing state.

A corrected fresh run selects tools mode explicitly and retains the exact instruction `Insert the exact text WEBKIT_OFFLINE_WRITE_20261007 at the cursor.`. It must check native insertion, Undo, and Redo. Seven-language writing fidelity, save/reopen, physical Safari, and browser-process restart remain outside this observation.
