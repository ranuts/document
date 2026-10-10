# CPU negated/conflicting sort diagnostic — partial failure

Three actual current Excel IM CPU requests used the seeded table from the positive sort probe. All three left the inspected A1:C4 snapshot unchanged and produced no preview cards.

1. 不要将 A1:B4 按 B 列升序排序，保持所有单元格不变。 unexpectedly displayed C1: 0. No error was shown. This is a semantic failure: the user requested no operation, but received an unrelated read/calculation result. No mutation is insufficient for acceptance.
2. 请将 A1:B4 按 B 列升序和降序排序，第 1 行是表头。 was rejected with actionable clarification guidance and no edits.
3. 不要排序 A1:B4，只读取 B2 的值。 correctly displayed B2 and 30 without edits.

The normal CPU loader/model was used; worker actions show token counting and actual generation for each request. No request/output substitution. The verifier confirms the observed failure as well as the two expected outcomes; it is not a semantic acceptance gate. The inherited final Undo/Redo relates to seeded editor history and is not used to validate these non-mutating requests.

Next implementation work should prevent tool selection from inventing an operation for an explicit no-op request while retaining valid read-only requests that mention negated edits. A broad ban on every request containing negation would break case 3. This is one desktop Chromium/Excel CPU diagnostic, not model-wide certification.
