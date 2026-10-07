# Fixed WebKit product offline-page failure

The actual current editor loaded in isolated WebKit 27.2, but the initial natural CPU model did not reach ready state. The panel reported model load failure; the observer then timed out after 240 seconds. The driver itself exits 0 even for this captured failure, so exit code is not an acceptance verdict. Context and browser closed. Offline page closure/reload/inference were not reached.

WebGPU was absent, isolation true, memory64 true and WebAssembly.Suspending/promising present. The runtime requested the ordinary wllama assets rather than the old compatibility assets. There were no requestfailed events; one opaque page-error string was captured. This does not distinguish successful download from WASM/model initialization failure or identify the exception cause.

The separate minimal service-worker offline controls pass on this runner, but they do not establish product CPU model compatibility. Next diagnosis must capture actual Wllama load errors and compare native/compat runtime selection without changing product defaults. Physical Safari/mobile and full offline acceptance remain open. Network query strings are omitted in the archived receipt; raw receipt SHA-256 binds the ignored original.
