# Native completion protocol for literal text

The previous text-format strategy used a fixed observation wait. A new native probe directly invokes `asc_PasteData` with the SDK Text clipboard format and restores the original cell number format / ends the history transaction inside its completion callback. No fixed paste-completion wait is used. Observation waits remain only around fixture setup and Undo/Redo snapshots.

Seven literal texts were exercised in each of General and 0.00 formats, fourteen cases total. Every callback reported true. Display/raw/edit text matched the original input, cell type was string, original number format was restored, and one Undo / Redo restored exact before / after snapshots. No page errors occurred.

Local SDK source also confirms that pluginMethod_PasteText delegates to asc_PasteData's completion callback through executeGroupActions, rather than supplying a generic completion promise to this application. Existing `native-paste.ts` demonstrates an owned pre_Paste wrapper that guards delayed insertion; its Excel compatibility has not yet been proven by this probe.

This is native strategy evidence, not IM acceptance. Failure and cancellation ownership, protection / merged ranges, capturing the original format, other cell styles, interrupted history transactions, save/reopen and schema/planner integration remain required. The probe's timeout cleanup is defensive; these successful cases do not prove a timeout path. Do not copy isolated-fixture transaction ownership into production without guards.
