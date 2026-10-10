# Explicit cell destination validation

The existing planner extracts standalone addresses excluding range endpoints, but used them only to validate SUM destinations. set_cell had structural/bounds validation without checking the requested destination. Added the same explicit-address constraint to set_cell: when standalone addresses exist, the chosen cell must be among them. Thus the reproduced request containing source A1:B4 and destination B2 cannot write A1.

Regression failed before implementation because the wrong-target plan was accepted; a correct B2 write still passes. Full suite: 118 files/4292 tests passed; TypeScript, lint and production build passed. Existing async rejection warnings remain in the suite. Actual current CPU IM replay now rejects the wrong-target plan with actionable no-operation guidance and leaves the inspected table unchanged.

This prevents the reproduced wrong-target write. It does not fulfill read-then-write sequencing, disambiguate multiple standalone addresses, or fix omitted second ranges. Those broader features remain required. The replay includes unchanged multiple-region failure evidence; no full composite acceptance claim is made.
