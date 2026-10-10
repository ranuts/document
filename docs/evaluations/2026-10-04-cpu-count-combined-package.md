# Combined CPU count SDK candidate

The source SDK now includes the public count method, generated count-response schema, worker lifecycle fixes, strict-typed download cancellation fixes and actual memory64 module validation. The capability diagnostic reproduces false-positive constructor detection before the port and correct supported/unsupported results after it. TypeScript 5.4.5 checking and tsup bundling pass.

The combined client passes the native CPU provider budget scenario (436 to 24 tokens after whole-turn trim, oversized system 419 rejected, recovery 24). The browser harness now needs only the original validate-module override to force compatibility; constructor interception was removed. The same client passes mocked metadata/cache HEAD/model HEAD cancellation. This does not prove real offline/download behavior or writing fidelity.

The candidate ZIP listed in the package JSON contains the exact tested ESM client, paired CPU compatibility native JS/WASM, combined client-source patch, native-source patch, license files and an entry-hash manifest. Every ZIP entry was read back and compared to its source bytes. The archive is isolated in /private/tmp, not added to product dependencies or published. It does not include native JSPI/memory64 variants, model weights or a full source tree. Source revisions plus patches identify how to reconstruct the extension; this is not a complete reproducible build certification.

The combined source patch includes earlier lifecycle/native-count changes and the new capability/cache fixes. Installed application SDK remains unchanged. A production loader must choose the paired runtime explicitly, retain normal caching/privacy behavior, and verify UI Stop/trim notices/offline usage before activation.

Verification: `python3 docs/evaluations/verify-cpu-provider-combined-sdk.py` and `python3 docs/evaluations/verify-cpu-source-download-cancellation.py`.
