# WebKit 27.2 local-file CPU control

The same isolated WebKit 27.2 runner completed actual native local-file Qwen3-0.6B loading and one ordinary English chat request. Startup preflight reports 14 prompt tokens, context 2048, vocabulary 151936 and four threads. No page/chat errors were observed; browser/context closed and process exited 0.

The earlier natural default-URL load failed before offline navigation. This local-file result rules out an unconditional inability to initialize the small-model CPU runtime on this browser, but it does not establish the cause of the URL failure. The paths differ in network download, cached-source handling and imported-file setup. Next work must capture the URL-load rejection and download/cache stages directly.

This is online desktop automation. The reply DOM includes action labels and is not an exact raw semantic receipt. No document mutation, offline restart, save/reopen or physical Safari/mobile acceptance is covered. Product model/runtime defaults remain unchanged.
