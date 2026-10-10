# CPU Chinese IM SUM operation

Actual current Excel IM CPU fallback processed two Chinese requests against A1:A3 values 10, 20, -5 (seeded through native editor paste): 求和 A1:A3。 and 求和 A1:A3，写入 A4。

The first displayed A1:A3: 25 and left all four inspected cells unchanged. The second wrote SUM(A1:A3) to the explicit destination A4 with evaluated value 25 and displayed the verified-result status. Source cells remained intact. Native Undo restored the initial snapshot and Redo restored the formula/value. Both requests counted before generating, with no preview cards or page errors. No model output or request was replaced.

The initial probe used a nonexistent tool-message selector, so its empty messages array does not establish visible feedback. The history probe captures actual visible body text and native history; its verifier checks the displayed sum, formula/value and exact snapshots. Both reports are retained. The build hash stayed unchanged during both runs.

This establishes one explicit read-only and one explicit destination SUM request on desktop Chromium CPU. It does not certify ambiguous ranges, all sorting operations, arbitrary instructions or model writing fidelity.
