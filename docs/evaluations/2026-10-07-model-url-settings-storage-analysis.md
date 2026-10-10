# Synthetic model URL settings persistence

Fresh isolated Chromium on the current served build records full synthetic authentication-like query values in all three localStorage keys: CPU GGUF source, custom MLC directory and compatible model WASM URL. A second same-origin page reads exactly the stored URLs. There are no page errors or model-source requests, no actual authentication credentials and no model inference. `observationPassed` means the undesired persistence was reproduced, not a passed privacy gate.

The SDK cache originalURL metadata path is separately observed by source inspection, not certified by this settings-only browser probe. Filtering settings alone would not establish that signed URLs never persist. The proposed settings/cache policy is awaiting user choice; no product storage behavior or existing cache deletion is performed. Broader deployed parent/iframe/Worker egress, physical devices and full offline/privacy acceptance remain open.
