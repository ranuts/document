# Embedded first upgrade

The embedded editor now shares one bounded same-origin HEAD policy check between application Worker registration and native editor readiness. The canonical `/editor` request omits document query parameters. Actual isolation capability still determines CPU threading; an ancestor that prevents isolation does not gain multithreading through this policy check.

A real HTTP proxy warmed the old plain Worker and native Word cache, then enabled COOP/COEP while the editor remained inside a cross-origin, nonisolated parent. The supported parent open-buffer protocol loaded a DOCX on the first upgrade navigation. The controller became `/sw.js?isolation=1`, reported the current build, and native full API/document readiness both succeeded without another reload or cache rewriting. Parent and embedded capability remained false. Two HEAD requests reported ERR_ABORTED; no native iframe request failed. This probe covers the tested same-site cross-origin Chromium embedding, not all storage partitions or inference.

Validation: build succeeded; 116 test files / 4100 tests passed; root lint and diff checks passed. Read-only review found no Important/Critical issues.
