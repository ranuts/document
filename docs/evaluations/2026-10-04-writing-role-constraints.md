# Role and modality constraint development experiment

This experiment does not justify a production prompt change. It reuses the eight previously evaluated English, Chinese, Spanish and French development fixtures, with a prompt informed by earlier failures. There is one fixed-order sample per variant and case; these are not fresh heldout accuracy measurements.

## Method and provenance

Driver preregistered in `a2f0c92`, before execution. Compare `minimal` against `roles`, which adds participant, recipient, modal strength, authorization direction, proposal/completion and date-attachment constraints. Qwen3-1.7B-q4f16_1-MLC, actual WebGPU Worker inference, temperature 0, top_p 0.8, 512 output tokens, JSON schema and thinking disabled. Requests are modified only by a diagnostic browser route; generated responses and native editor API results are not substituted. The served diagnostic response instruments request/output recording; the distribution bundle files remain unchanged.

The raw report scope contains inherited wording “current prompt vs route-local minimal” and “Selected translation target”; the actual recorded variants and requests are **minimal versus roles, rewrite only**, as checked by the verifier. No production configuration changed.

## Observed outcomes and manual review

| Cases | Minimal | Roles |
| --- | --- | --- |
| English, Nora pays Ethan | Applies rewrite but omits Ethan, adds “as stated” | Returns unchanged source; refused |
| English, Ethan pays Nora | Applies formal rewrite retaining both parties | Returns unchanged source; refused |
| Chinese, authorized / not authorized | Both apply; preserve authorization subject and status in these fixtures | Same outputs as minimal |
| Spanish, prerequisite / without prerequisite | Both apply but strengthen “can” to “will”; second retains casual tag | Both retain “can” and respective condition, but retain casual “¿vale?” |
| French, proposed shipment | Unchanged; refused | Unchanged; refused |
| French, completed shipment | Applies, retains past shipment but adds unsupported planning claim and casual “Bon” | Unchanged; refused |

Minimal applies 7 and refuses 1; roles applies 4 and refuses 4. These counts describe execution, not correctness. Extra constraints repair the observed Spanish modal changes while reducing successful rewriting elsewhere. No semantic acceptance score is assigned.

## Verification and limits

`python3 docs/evaluations/verify-writing-role-constraints.py` checks all 16 actual model requests, exact paired source/instruction identity, driver and current bundle hashes, model/settings, no preview cards, source preservation on refusal, and exact native Word Undo/Redo for every applied output. Raw report has no harness errors or recorded external requests. This is one warm desktop GPU diagnostic run; it does not establish offline/privacy certification, CPU or mobile quality, native Save behavior, or general semantic fidelity. Manual semantic/style review remains necessary. Production prompt and default model remain unchanged.
