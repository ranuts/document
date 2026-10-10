# Fresh single-thread control reaches allocation failure

Changing only n_threads from 4 to 1 lets the fresh Emscripten 6 runtime enter native model loading. The same 4,617,129,952-byte allocation fails under its verified 4 GiB limit. SDK load resolves, but the product-equivalent count preflight rejects before generation. The process exits 1 with browser/context/server closed; zero translations complete.

This narrows the multithread initialization incompatibility but does not explain its exact thread-handshake cause or establish that all multithread requests hang. The 8 GiB candidate uses the same single-thread setting in a separately frozen screen. Its loading, generation and semantic results remain unproven until observed. No product/runtime/default change follows.
