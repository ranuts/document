# JSON schema decoding pressure diagnostic

No production change is justified by this run. Removing JSON-schema decoding does not resolve the observed Spanish modal strengthening or unsupported French planning claim. One English output preserves the missing payment recipient, but violates the flat response contract and is refused.

## Controlled question and provenance

Question: under the same minimal preservation prompt, is JSON-schema decoding responsible for the previously observed role/style failures? Eight already-seen four-language development fixtures, one fixed-order sample per variant; no fresh heldout or general accuracy claim. Driver preregistered in `9228ee6`; its inherited schema-required assertion stopped the first run during the first free variant, after one recorded schema result. Preserve that failed/incomplete report separately. It cannot support a full comparison, and the unrecorded free result is excluded. Corrected assertion preregistered in `a1702da`, then the accepted full 16-request run executed.

`schema` uses the existing response_format; `free` removes only response_format. Exact paired system/user messages, temperature 0, top_p 0.8, max_tokens 512, thinking disabled, model Qwen3-1.7B-q4f16_1-MLC and all production parse/document guards otherwise unchanged. Actual Worker inference and actual native Word IM rewrite route; route-local request mutation and response recording, not substituted model output or editor results. Bundle files unchanged. Diagnostic script remains outside product code.

## Manual output review

| Cases | Schema versus free |
| --- | --- |
| English, Nora pays Ethan | Schema omits Ethan and adds “as stated”; free returns faithful formal text but adds task/targetLanguage fields, so strict flat-response parsing refuses it and retains source |
| English, Ethan pays Nora | Identical faithful text |
| Chinese, authorized / not authorized | Identical text retaining authorization subject/status on these cases |
| Spanish, prerequisite / without prerequisite | Identical text; both strengthen “can” to “will”; without-prerequisite text retains casual tag |
| French, proposed shipment | Both return unchanged text; free also adds task/targetLanguage fields; both refused |
| French, completed shipment | Identical text retains completed shipment but adds unsupported “comme il est prévu” and keeps casual “Bon” |

Schema applies 7/refuses 1; free applies 6/refuses 2. These are execution counts, not correctness. Six of eight paired raw responses are identical. The other two include extra fields without schema; one improves recipient preservation, the other does not perform a formal rewrite. Evidence contradicts treating schema removal alone as a general solution. Keep schema, strict parsing and production prompt unchanged.

## Verification and remaining work

`python3 docs/evaluations/verify-writing-schema-pressure.py` passes: all 16 actual requests, exact model/settings/system messages, paired source/instruction, only response_format differing, driver/current bundle hashes, no previews, source preservation on refusals, and exact native Undo/Redo for every applied output. A temporary report with altered top_p is rejected. No harness errors or recorded external requests in the completed report. Single warm desktop GPU run does not certify offline/privacy, Save, CPU/mobile, broader languages or general role fidelity.

Next work should investigate reliable task conditioning and instruction-following independently of JSON syntax, then test candidate improvements on new heldout roles/conditions. Relaxing parsing to accept extra fields would not fix the remaining semantic/style failures and is not adopted.
