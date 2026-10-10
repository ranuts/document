# Matched CPU WASM memory ceiling

The exact default artifact imports shared memory64 with minimum 2,048 pages and maximum 65,536 pages; at 65,536 bytes/page the maximum linear memory is 4,294,967,296 bytes (4 GiB). The compatibility artifact imports shared memory32 with the same maximum. Artifact SHA256 identities match the existing paired-runtime manifest. Memory64 addressing alone does not prove a larger configured limit.

The preceding verified official 7B run requests a single CPU model buffer of 4,677,120,000 bytes, larger than this entire permitted linear memory before other allocations. It cannot fit the current runtime irrespective of physical host capacity. Native failure logs are therefore consistent with an artifact ceiling; they do not establish that the physical machine lacks RAM. A larger runtime has not been built, loaded or validated here.

The startup preflight fix correctly rejects this unusable runtime state and releases it once. The generic UI failure remains separately recorded. This is artifact/initialization evidence, not model semantic quality or physical-device acceptance. Browser CPU candidates must fit the runtime including model buffers, context and other allocation overhead; file size alone is insufficient to certify fit.
