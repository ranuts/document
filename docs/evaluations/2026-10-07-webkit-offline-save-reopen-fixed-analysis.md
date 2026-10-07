# WebKit offline save/reopen after font sprite precache repair

The font-menu component selects binary sprites by locale group and one of five pixel densities. The saved-file reopen requested a previously unused sprite, absent from the old install cache. The repair precaches all ten binary UI sprites (4,448,211 bytes) in the existing vendor-versioned runtime cache. It does not preload font outlines or model files.

The regression failed before the change, then passed. Related service-worker tests: 6 files/145 tests passed. Full suite: 142 files/4541 tests passed, with PromiseRejectionHandledWarning messages retained in the local log. TypeScript, changed-file lint/format, diff whitespace checks and production build passed. Core build is 1791372911; vendor hash remains b6864850e7b3.

Fresh isolated WebKit 27.2 observed actual 200 responses with nonzero bytes for all ten cache entries before going offline. Default CPU online load took 59,637 ms; offline readiness took 4,167 ms. The unchanged instruction in tools mode inserted exact text; native Undo/Redo passed. Native Save produced a 25,859-byte DOCX with valid ZIP CRC and exact XML text. A new offline page reopened the file with exact native Word text. Page errors were empty and context/browser closed. The original failed receipt remains archived. No browser-side fetch or cache insertion override was used.

This proves one same-context desktop page-close lifecycle. Service-worker update and spelling-script offline failures remain in the request ledger. Browser-process restart, physical Safari/mobile, all document fonts/layout, broader operation coverage, authenticated URL privacy, and seven-language writing fidelity remain incomplete.
