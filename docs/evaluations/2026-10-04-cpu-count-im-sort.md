# Actual CPU Chinese IM numeric row sorting

The current Excel IM CPU fallback accepted explicit Chinese ascending and descending requests for A1:B4, sorting numeric B values while moving complete rows and keeping row 1 as the header. Native editor paste seeded Cora/30, Davi/10, Mira/20, plus OUTSIDE in C1.

Ascending produced Davi/10, Mira/20, Cora/30. Descending produced Cora/30, Mira/20, Davi/10. Names remained paired with values; the header and inspected outside column C remained unchanged. Native Undo restored the ascending state and Redo restored descending. Both requests used count_chat before completion, displayed verified-result status, and showed no errors or preview cards. The verifier checks exact table snapshots and native history.

The normal model and loader were used without output substitution; only GPU capability was forced off. These requests benefit from the existing explicit-sort schema constraints. This proves two explicit numeric sorting operations, not unconstrained model planning, arbitrary sort semantics, all outside cells, or writing fidelity. No product code changed.
