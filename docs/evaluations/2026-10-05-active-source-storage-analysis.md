# Active-source storage feasibility

Real production origin5193, fresh independent Chromium/WebKit contexts per attempt, exact25,849-byte saved Word fixture SHA256 c04e1bb1b80379ab00a2c301de927453647bed51be9974db3e547a6f228b45a3. These throwaway probes do not edit product code or substitute inference.

Cache API: synthetic Response from File with metadata header, then raw ArrayBuffer Response, failed after WebKit page reload while Chromium retained metadata/bytes. An additional raw-buffer attempt with service workers allowed confirmed immediate cache.keys/match success in both engines, but after reload WebKit keys were empty despite the same sessionStorage key surviving. Final report preserves that failure and returns nonzero. No causal claim about all WebKit caches, response-body encoding or browser eviction; app-independent reproduction has not been done. The rejected prototype must not be used as cross-engine product storage evidence.

IndexedDB: committed a record containing raw Uint8Array/name/type/lastModified, retained only an opaque key in sessionStorage, reloaded and rebuilt a File. Both engines returned the exact SHA256,25,849-byte size, Unicode filename and modification time. Records were deleted in a completed transaction and contexts/browsers closed. Independent report checks confirm both rows pass. No document import, source-recovery integration, large-file memory, quota, expiry, concurrency, physical devices or privacy/network certification follows from this small storage test. It only supports the selected IndexedDB primitive for the next implementation.

The design/implementation checks are in docs/plans/2026-10-05-active-local-source-recovery.md. Product source recovery remains unimplemented; no completion claimed.
