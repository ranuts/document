# Ordinary range-read wording fix

Before the fix, actual CPU IM 读取 A1:B4 的内容。 still returned only A1/Name despite the new get_range capability. Show the values in A1:B4. and 请读取 a1:b4，不要修改任何单元格。 returned all eight requested cells through model planning. This showed the capability alone did not guarantee complete coverage.

Expanded the bounded whole-command Chinese recognizer to ordinary range reads with optional 的内容/的值 and optional explicit keep-unchanged suffixes. It preserves the literal region, normalizes case via existing plan validation, and excludes trailing extra operations. English phrasing in this probe remains on normal model planning.

The new regression failed before implementation. Full suite passed 118 files/4290 tests; TypeScript, lint and production build passed. The actual post-build CPU replay returned all eight cells for all three phrases, with unchanged inspected snapshots, no errors or preview cards. Chinese explicit variants emitted no inference actions. Before/after raw reports and verifier are retained. The full suite retains existing asynchronous rejection warnings.

Other languages and arbitrary phrasing, multiple regions, generated-writing fidelity and device acceptance remain open. This is a bounded repair, not general intent understanding.
