# Source-built SDK CPU compatibility verification

The same source-built client and native artifact hashes as the failed run now complete successfully after correcting the harness capability simulation. The original harness intercepted the installed SDK's 13-byte WebAssembly.validate probe, but source uses a WebAssembly.Memory constructor probe. That constructor was not intercepted, selecting the default runtime wrapper while the supplied WASM was the CPU compatibility artifact. The native import error occurred before model load.

The corrected driver also rejects the memory64 constructor in this isolated page. It asserts and logs compat=true, the local WASM path, and an inline compatibility worker before loading. No SDK source or native artifact was changed between the failed and successful browser executions. Four actual prompt-usage comparisons match at 16, 25, 45 and 30 tokens; repeated counts, overflow detection, unsupported-content rejection and subsequent deterministic recovery pass. No page errors occur. A 120-second diagnostic deadline was added but did not fire.

This corrects the prior report's unproven suggestion that generated worker material caused incompatibility: comparison found the installed and source generated llama worker strings identical. The observed compatibility selection mismatch explains the controlled diagnostic failure, and its correction restores operation. The separate upstream error-handling defect remains: non-string abort messages can throw message.replace errors and leave work pending. Installed SDK lifecycle fixes must be ported before using this source SDK in production.

Source typechecking and browser execution of the compiled bundle are now established for this Chromium CPU compatibility case. This is not IM integration, native JSPI/memory64 verification, all-browser acceptance, or writing-quality certification. Root product dependencies remain unchanged.

Verification: `python3 docs/evaluations/verify-cpu-public-count-source-compat.py`.
