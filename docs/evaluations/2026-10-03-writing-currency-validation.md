# Writing currency validation — 2026-10-03

The archived CPU numeric-placeholder experiment preserved `1,250` but changed EUR to 元 and passed the old numeric guard. This change validates recognized adjacent amount/currency pairs before a writing result can become a document action. It adds no preview, confirmation, or new IM controls.

Rewrite/translation retain the pair multiset. Summaries may omit complete money facts but may not retain their bare amounts without currency, beyond original non-money occurrences. Supported localized names can resolve to the same currency; ambiguous symbols remain literal identities. ISO currency codes require uppercase so ordinary Try/All do not consume adjacent amounts.

Vocabulary uses common fallback codes and available Intl currency names in seven UI languages. Name availability depends on host locale data; see [ECMA-402](https://tc39.es/ecma402/). This is a literal guard, not a full financial parser or semantic verifier. Non-adjacent expressions, inflections, general entity/negation associations and all numeric formats remain outside its proof.

Validation:

- Initial six negative cases failed before integration, demonstrating the old false acceptances.
- Replays include the exact archived Chinese EUR→元 response, pair swaps, dropped summary units, invented currency, duplicate counts, signs and symbol preservation.
- Review found ordinary Try/All false positives and a post-filter consumption bug; both were corrected at matching time with positive/negative regressions.
- Final related tests: 87 passed; final full suite: 116 files / 4,151 tests passed.
- Build, root lint and git diff --check passed. Existing converter PromiseRejectionHandledWarnings remain.
- Read-only review found no remaining definite Important issue within this narrow scope.

No new real-model quality claim is made: the archived bad response is replayed through mocked provider output. No defaults, model prompts, native Undo/Save or IM layout changed.
