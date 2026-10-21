# Dependency patches

`ranui@0.5.0.patch` carries the upstream `r-reasoning` summary correction in the
ES module consumed by this application. The owner is
`chaxus/ran:packages/ranui/components/reasoning/index.ts`: an open reasoning body
already displays its text, so the header summary appears only while collapsed.
It preserves native disclosure ownership, streaming state and public APIs.

The matching source change, component regression tests and browser verification
are maintained in the ran PR. Keep this patch until a ranui release includes that
correction; then upgrade the dependency and remove this patch and its
`patchedDependencies` entry together. Do not recreate the behavior with host
shadow-DOM queries or CSS overrides. Install with the lockfile before acceptance
so screenshots exercise the same patched module as CI.

The existing WebLLM and wllama patches retain their separately documented source
comments and purposes in their patch files.
