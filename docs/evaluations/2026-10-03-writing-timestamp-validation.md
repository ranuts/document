# Writing timestamp preservation

The numeric guard previously recognized a date as one token but treated its time components as separate numbers. It accepted a swapped hour/minute pair, a lost UTC Z marker (including fractional seconds), and an exchange of times between two dates. Four mocked-provider tests reproduced those erroneous acceptances before the correction.

The date token now also includes a supported T-separated time, optional seconds and fractional seconds, and optional Z or signed timezone offset. These complete timestamp literals must match source occurrences under the existing rewrite/translation/summary multiset rules. Three positive controls preserve fractional seconds and both colon-separated and compact offsets. No prompt, model default, native editing flow, or UI control changed.

This is a literal-preservation guard for the tested formats, not complete ISO 8601 support or semantic date validation. Space-separated times, basic datetime forms, fractional minutes, and event associations across separate timestamps remain outside its scope. These tests exercise provider-response validation, not real model generation quality or browser execution.

50 writing tests and all 116 test files / 4127 tests passed after the fix. Build, root lint and diff checks passed. Read-only review found no Important/Critical issue and confirmed the coverage limits above. Existing converter rejection-handled warnings remain unrelated.
