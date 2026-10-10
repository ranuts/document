# Cancellation reaches in-flight agent tools

The general agent runtime checked cancellation before and after a tool exchange, but omitted its AbortSignal when calling AgentTool.execute. A cooperative Word, Excel or presentation tool could therefore finish delayed native work after Stop even though its implementation already supported cancellation. This runtime is also exported for other integrations; the local browser panel's bounded document-operation route already forwarded its signal and is not claimed as newly repaired here.

Forward the run signal through executeToolCall to the tool. Preserve the existing single-argument call when no signal was supplied. Update the misleading options comment: inference and cooperative tools receive cancellation, while arbitrary tools that ignore the signal cannot be forcibly undone.

A regression models an operation waiting for readiness before writing. With the original compiled runtime it wrote the unwanted text after abort (RED: one failed / eighteen passed). After rebuilding the package and forwarding cancellation it returns an error tool result, writes nothing, makes no further model call and reports aborted rather than iteration-limited. Test both the final permitted iteration and a normal multi-iteration run. This is a deterministic runtime contract test, not a new native-browser paste certificate.

Verification: four targeted files passed 108 tests before the extra iteration-limit row; final full suite passed 141 files / 4,532 tests. Root TypeScript check and lint on the changed runtime/test passed; diff whitespace passed. Full repository lint still has the previously recorded diagnostic-script issues. Existing asynchronous rejection warnings remain. A previous synchronized-main preview-wait fixture failure did not recur in these two full runs; no preview workflow or fixture code changed in this fix.

Independent scoped review found no critical or important issues. It inspected the signal plumbing and cooperative native callers, but did not rerun the suite or certify native editor cleanup.

The broader model-quality, offline and physical-device acceptance remains open.
