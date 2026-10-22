# Dependency patches

`ranui@0.5.0.patch` carries upstream corrections in the ES modules consumed by
this application. The reasoning owner is
`chaxus/ran:packages/ranui/components/reasoning/index.ts`: an open reasoning body
already displays its text, so the header summary appears only while collapsed.
It preserves native disclosure ownership, streaming state and public APIs.

The select owner is `chaxus/ran:packages/ranui/components/select/index.ts`.
Keyboard reopening uses the public `open` state, so a closing animation cannot
consume the next Arrow, Enter, Home/End or typeahead action as if the menu were
still open. Visual exit frames do not own interaction state.

The matching source change, component regression tests and browser verification
are maintained in the ran PR. Keep this patch until a ranui release includes these
corrections; then upgrade the dependency and remove this patch and its
`patchedDependencies` entry together. Do not recreate the behavior with host
shadow-DOM queries or CSS overrides. Install with the lockfile before acceptance
so screenshots exercise the same patched module as CI.

The existing WebLLM and wllama patches retain their separately documented source
comments and purposes in their patch files.
