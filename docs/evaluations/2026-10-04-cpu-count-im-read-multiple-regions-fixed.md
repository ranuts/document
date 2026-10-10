# Complete multi-region reads

Added read-only get_ranges using existing native get_range execution. Comma-separated regions are validated before reading, with at most 10 regions/5000 cells in aggregate and 80000 characters in the combined result. Each region retains its own address header; all cells, including blanks, are returned. Failures return no partial result and abort signals are checked during execution. The existing flat tool schema registry remains compatible.

The reproduced complete Chinese/English two-region read commands now preserve both regions through bounded recognition before model planning. This is one read operation, with ordinary literal tool-message output and no preview cards. More arbitrary phrasing still depends on planning and is not certified.

Both regressions failed before implementation. Full suite passed 118 files/4294 tests; TypeScript, scoped lint and production build passed. Existing asynchronous rejection warnings remain in the suite. Actual current CPU IM returned all eight cells in A1:B2 and A3:B4 for both languages, with no inference actions and unchanged inspected snapshots. The read-then-write request remained rejected by the prior explicit-destination validation, with no modifications. The verifier checks all requested addresses/values, both headers and the composite rejection.

Full read-then-write sequencing remains required and is not claimed complete. General language/tool fidelity and mobile/device acceptance remain open.
