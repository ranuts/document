# Synthetic authentication-like URL in SDK cache

A fresh isolated browser downloads a synthetic 32-byte payload through the shipped SDK model-manager cache path, without loading a model or generating text. A second page/SDK instance reads the same cache entry. The public test token appears verbatim in both originalURL metadata and the cache entry name, even though the name also has a hash prefix. Hashing a prefix does not remove the appended query value. This confirms a broader persistence issue than settings-only storage. No real credential is used.

The original probe exits 1 because it expects one request and observes two identical synthetic-source requests. Its raw receipt retains this condition and `observationPassed=false`; it is not rewritten into a passing test. Separate inspection confirms persisted=true, identical source metadata/entry names on both pages and loaded=false for both instances. This is evidence of undesired persistence, not a passed privacy gate.

The storage/cache policy still awaits user choice. A fix must consider entry names, metadata and settings, plus offline/cache lifecycle. No real user cache or product storage behavior is changed by this isolated probe. Full deployed egress/device/offline/privacy acceptance remains open.
