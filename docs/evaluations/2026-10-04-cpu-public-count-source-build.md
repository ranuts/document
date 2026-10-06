# Source-built SDK runtime failure

The browser driver did not finish naturally. After confirmed live polls and a one-second sample showing the dedicated worker waiting for messages, the owned Chromium process was explicitly terminated to recover buffered evidence. The resulting target-closed terminal error is operator-induced, not the original cause.

The preserved console reveals the earlier failure: WebAssembly.instantiate reports Import #0 "a": module is not an object or function, in both streaming and ArrayBuffer paths. A page error then reports message.replace is not a function. No model-loaded or successful count results are recorded. Thus successful TypeScript checking and bundling do not establish a working source-built SDK.

The manually assembled installed-client prototype worked with the same native artifact hashes. The newly built source bundle uses different generated worker material; compatibility of the wrapper, injected runtime and error handling needs investigation. No exact cause or fix is established here. The driver needs live phase logging and a bounded diagnostic deadline before the next execution. No product dependencies were changed.

Raw runtime errors and served-file identities are preserved in the accompanying JSON. The separate process sample remains at /private/tmp/document-count-sdk-renderer-sample.txt. An attempted inspector start on the owned Node process failed because the default port was occupied; no debugger attached.
