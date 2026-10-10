# Role-preserving rewrite prompt contrast: neither accepted

Eight fresh fixtures and the driver were committed in `0e43812` before inference:
payer/recipient reversal in English, authorization granted/not yet granted in
Chinese, confirmation required/not required in Spanish, and proposed/completed
shipment in French. Each variant receives identical source/instruction data.
Current Qwen3-1.7B executes both through actual Word IM, temperature 0, unchanged
bounded JSON schema, thinking controls and product guards. The minimal prompt
is a route-local experiment; production prompts/defaults are unchanged.

One fixed-order sample per fixture and variant yields 16 requests. The current
prompt applies three results and refuses five; minimal applies seven and refuses
one. These counts describe execution, not writing correctness.

| Contrast | Current prompt observations | Minimal prompt observations |
| --- | --- | --- |
| Nora pays Ethan | Changes USD to `$`, refused; native source preserved | Applied, but omits recipient Ethan and adds “as stated” |
| Ethan pays Nora | Changes USD to `$`, refused; native source preserved | Applied formal sentence preserves the stated payment direction |
| 叶舟 already authorized | Applied; retains approver and authorization status | Applied; retains basic approver/status |
| 叶舟 not yet authorized | Applied “叶舟尚未获得授权…” makes 叶舟 a recipient of authorization instead of the authorizer | Applied “叶舟尚未授权…” retains authorizer and negative status |
| Eva can release only after Luis confirms | Unchanged source, refused | Applied; prerequisite remains, but `puede liberar` becomes stronger future `liberará` |
| Eva can release without Luis confirming | Unchanged source, refused | Applied; absence of prerequisite remains, but future assertion replaces permission/possibility and casual `¿vale?` remains |
| Camille proposes shipment | Applied after changing only apostrophe typography; casual wording remains | Unchanged source, refused |
| Camille already sent shipment | Changes November ISO date into an October date, refused | Applied; past shipment remains but unsupported “comme il est prévu” and casual “Bon” are added/retained |

The minimal prompt improves this specific Chinese negative-authorizer example
and one English formal sentence. It does not reliably preserve all requested
participants, modal strength or unsupported status, so it is not adopted.
Numeric/currency guards still cannot prove roles or modality. Changing an
apostrophe is also insufficient evidence of performing the requested formal
rewrite. No aggregate semantic accuracy score is assigned by the verifier.

Every applied edit has exact native Undo/Redo snapshots; every refusal preserves
the selected source. No preview cards or page errors. The context closes after
completion. `verify-writing-role-holdout.py` binds the committed fixtures/driver,
actual model ID, identical source payloads, generation settings, current bundle
hash, refusals and native history. Semantic judgments above are manual; the
verifier does not convert them into automatic proof.

Limits: fresh relative to previous fixtures, not a representative heldout
benchmark or controlled model ranking; fixed order, one sample each, four
languages, warm desktop GPU, route-local isolation headers. No CPU/mobile,
Save/offline/privacy certification or new model-default decision. The initial
launch encountered a stopped preview server; only the completed 16-request run
is accepted. Next work needs explicit tests for retention of all participants,
modality and event/date binding rather than rewarding more applied edits.
