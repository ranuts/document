# Actual sequence read-failure boundary

The first fixture attempted to place 80001 characters in B2, but actual Excel native paste limited the cell to 32767. It therefore did not exceed the range-read output cap, and the sequence executed normally. This report is retained as a fixture diagnostic and is not treated as failure-path acceptance.

The corrected fixture seeded three native cells with 32767 characters each (98301 total). The same actual read-before-write request failed during reading. The inspected A1:C4 snapshot stayed unchanged; B2 was not overwritten with 99. No partial read activity, final success status, inference action or preview card appeared. Thus a genuine first-step error prevented the subsequent native mutation. The normal product path was used without tool/output substitution. The corrected probe excludes inherited Undo/Redo of seed history.

The UI displayed a generic could-not-complete error, despite the underlying tool having an actionable smaller-range message. This feedback mapping gap remains unresolved. The verifier confirms actual fixture lengths, unchanged data and absence of success/partial results; it does not certify cancellation or conversation switching during execution. No product code changed.
