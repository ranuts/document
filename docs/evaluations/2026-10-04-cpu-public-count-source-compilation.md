# Public count SDK source compilation

The modified SDK passes its unmodified tsconfig.build.json using TypeScript 5.4.5, within its declared compiler range. The workspace compiler rejects removed configuration options before checking source; that failed log is preserved. No upstream configuration was changed.

An isolated tsup 8.4.0 invocation initially failed because its TypeScript peer was absent. Supplying both pinned packages succeeded and generated an ESM bundle directly from src/index.ts, including generated count protocol metadata and the public method. All source hashes, bundle hash and complete terminal logs are recorded in the JSON evidence. The build reports the existing BigInt literal versus ES2015 target warning; this is not an all-browser compatibility claim.

A separate browser driver serves this actual source-built bundle, replacing the previously manually assembled client. Browser verification is recorded separately when terminal. Typecheck and bundling alone do not establish runtime acceptance or production integration. The upstream checkout was not committed or published, and installed product dependencies were not modified.
