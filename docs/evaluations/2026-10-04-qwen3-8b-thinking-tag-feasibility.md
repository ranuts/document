# Thinking plus tagged JSON: compatible SDK format, unusable writing results

Actual Qwen3-8B completed eight predeclared requests: four known cases, each current and thinking-tag prototype. Exact Worker identity matches. Candidate enabled thinking, temperature 0.6/top_p0.95/max1536, explicit tagged-final instructions and structural_tag schema; baseline used current non-thinking/temperature0/max512. Source/task/instruction JSON payloads match. This changes multiple factors and is compatibility exploration, not an isolated quality ablation or repeated reliability benchmark.

The installed SDK accepted structural tags and returned schema-shaped JSON inside tags. However, the unchanged production writing parser refused all four candidate responses and preserved native source. No candidate output was applied or surfaced as a reasoning message. Zero previews, no harness errors, unchanged bundle and browser closed. Current variants retained their existing two native edits/two refusals and exact Undo/Redo on edits; no Save.

| Candidate task | Final-body issues |
| --- | --- |
| Chinese formal rewrite | Adds 请注意, reformats ISO date, although future payer/receiver/count/service and payment denial remain. |
| Chinese summary | Changes Lena to 莱娜 and ISO date into Chinese format; two sentences rather than requested one. Conditions/pending/unauthorized states retained. |
| Chinese translation | Two complete schema-valid final tags appear: an initial placeholder text … and a later translation. Later body changes original name spellings and ISO date despite preservation instructions. Core allegation/denial/unconfirmed status remains. Multiple triggered spans are allowed by the SDK format and are not a unique final-answer guarantee. |
| English formal rewrite | Adds Notice and changes both ordinary payment and payment denial into reimbursement wording. This fresh fixture has no pay-back wording; semantic change remains supported. |

Candidate response times were approximately 29.6–59.4 seconds versus 6.4–6.7 for current variants in this single run. These are observed request times, not a general device/mode benchmark. All candidate stop reasons were stop, not token-limit truncation. The format mechanism therefore worked, but complete output did not satisfy required fidelity/style/literal/unique-final constraints.

Do not add a tagged-output parser or switch modes on this evidence. Extracting the last tag would discard the uniqueness problem and still accept bad body text. The prototype demonstrates why enabling reasoning alone is insufficient and why source/format validation must remain. Raw reports retain actual model output for audit; this analysis deliberately reports final-body findings without quoting reasoning prose.

Run verify-qwen3-8b-thinking-tag-feasibility.py for exact SDK format, schema, identity, unchanged JSON payload and protected native source. Original [publisher instructions](https://huggingface.co/Qwen/Qwen3-8B) informed the thinking sampling choice; they do not certify this MLC app workflow. Known four examples, one sample each, not heldout or seven-language acceptance. No production UI/prompt/parser/guard/default model changed. Broad factual writing and context/device/privacy requirements remain open.
