# WebKit27 default URL model file-read failure

The natural CPU default URL diagnostic reached Wllama loadModelFromUrl and nested loadModel, both rejected with RuntimeError: File read failed: NotReadableError: The I/O read operation failed. The console also reports excess multipart buffering and fileReadResponse worker termination. The provider invoked exit successfully. Panel reports load failure; context/browser closed and the diagnostic process exited 0. Finished here means observation completed, not model availability.

The installed SDK fileReadResponse takes a model Blob slice and awaits its arrayBuffer before transferring it to the worker. This directly locates the observed exception at model-file read rather than a generic unsupported-WASM claim. It does not prove the backing storage kind or root browser cause. The separate local-file startup/chat control passes.

This run blocks service workers to isolate CPU loading and differs from the earlier PWA-enabled failure. Both fail URL-path availability, but their exact causes must not be assumed identical. Next measurement should inspect model Blob backing and cache-storage selection, and test a bounded read-path correction while preserving streaming memory limits and ordinary cached/offline loading. No product defaults or runtime selection are changed.
