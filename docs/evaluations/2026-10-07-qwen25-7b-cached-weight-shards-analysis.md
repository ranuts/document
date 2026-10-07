# Larger GPU cached weight audit

The owned-profile read-only audit exits 0 and closes Chromium. All 88 cached tensor shards match the fixed revision manifest in byte size and upstream MD5, totaling 4,284,263,424 bytes. The verifier checks full ordered coverage, exact revision URLs, individual expected/observed hashes, total bytes, raw evidence bindings and process closure.

This post-inference cache inspection rules out a current cached-shard mismatch against that pinned manifest. It does not prove which exact bytes were consumed by every earlier request, cryptographically authenticate the upstream model, or certify model quality. The seven-language failures remain valid observed failures; correct current weight bytes are no reason to adopt the model or prompt variants. No model download, document edit or product change occurs in this audit.
