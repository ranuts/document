# PPT exact literal text planning

The [raw-data production diagnostic](2026-10-03-ppt-unicode-im-reader-raw-diagnostic.json) reproduced a real Qwen3 1.7B planning error: the native insertion matched the model's plan, but that plan omitted two user-supplied trailing spaces. Verifying the native write alone could not detect the earlier loss of data.

`generateDocumentToolPlan` now recognizes affirmative, terminal exact-text slide additions and limits the schema to `add_slide_text` with the supplied text as its literal enum, plus `unsupported`. The returned plan is independently checked against the same data before any native write. Changed text is rejected rather than repaired; a brief localized error says no change was made. The payload's names, numbers, wording, tabs, line breaks and boundary spaces are data, not extra operations. Existing Word literal replacement uses its original contract.

Examples of supported concise commands:

- `在当前页新增文本框：项目计划`
- `Add a new text box on the current slide with exactly this text: Project plan`

The existing longer preservation prefixes are also supported. For these terminal raw formats, the complete payload is preserved, including quotes and escape characters. The English format uses one separating space after the colon; subsequent spaces belong to the payload. JSON decoding occurs **only** in the distinct explicit command `Add a new text box on the current slide with exactly this JSON string decoded as plain text: <JSON string>`. Invalid JSON, non-string values and an empty decoded string are rejected before model generation. Ordinary valid-looking JSON text is never automatically decoded.

The [earlier quoted diagnostic](2026-10-03-ppt-unicode-im-reader-quoted-diagnostic.json) assumed JSON notation without explicitly distinguishing encoded text from literal text. It remains a failed diagnostic; it is not used to justify guessing which characters should be removed. The new explicit JSON case and literal-quotation case establish separate, unambiguous contracts.

## Tests and review

The initial five planner regressions failed for unbounded raw/JSON/Chinese text schemas and acceptance of trimmed/escaped data. Review found automatic JSON decoding could delete ordinary quotes and boundary spaces. Six additional failures covered that ambiguity, the explicit JSON schema and malformed/non-string JSON input. Two concise-command schema tests also failed before implementation. Negative and quoted-instruction prefixes retain the general planning schema.

Final verification: 111 files / 4006 unit tests, production build and lint pass. Independent review found no remaining important issue after explicit JSON decoding and concise command support. There are no UI additions, preview cards or additional confirmations.

## Actual production validation

Each linked successful report uses the real local model and production IM, verifies exact native Unicode/tab/line-break/boundary-space data, preservation of the original shapes, native Undo/Redo snapshots, no visible errors and no preview card. The real read-only step also returns the existing emoji title without changing the document/history.

| Engine/model | Raw literal | Explicit JSON decoding |
| --- | --- | --- |
| WebGPU Qwen3.5 0.8B | [pass](2026-10-03-ppt-literal-im-qwen35-08-raw.json) | [pass](2026-10-03-ppt-literal-im-qwen35-08-json.json) |
| WebGPU Qwen3 1.7B | [pass](2026-10-03-ppt-literal-im-raw-fixed.json) | [pass](2026-10-03-ppt-literal-im-json-fixed.json) |
| WebGPU Qwen3.5 2B | [pass](2026-10-03-ppt-literal-im-qwen35-2-raw.json) | [pass](2026-10-03-ppt-literal-im-qwen35-2-json.json) |
| WebGPU Qwen3 4B | [pass](2026-10-03-ppt-literal-im-qwen3-4-raw.json) | [pass](2026-10-03-ppt-literal-im-qwen3-4-json.json) |
| WebKit WASM CPU Qwen3 0.6B Q4_K_M | [pass](2026-10-03-ppt-literal-im-cpu-raw.json) | [pass](2026-10-03-ppt-literal-im-cpu-json.json) |

Qwen3 1.7B additionally passes [literal quotes/escapes with boundary spaces](2026-10-03-ppt-literal-im-quoted-fixed.json), [the Chinese preservation command](2026-10-03-ppt-literal-im-zh-fixed.json), and the [concise Chinese](2026-10-03-ppt-literal-im-short-zh-fixed.json) / [concise English](2026-10-03-ppt-literal-im-short-en-fixed.json) commands. The supplied mixed-language payload is `项目 😀\tPayment\n  NOT approved  `; encoded and raw cases are checked against native character data, not the lossy SDK `GetText()` result.

Observed CPU write durations were about 21 seconds for this payload, with read planning about 42 seconds. These are recorded session observations, not controlled performance benchmarks or evidence for physical mobile devices. Model assets were cached, and these cases did not prove cold-start/offline loading, Stop during this exact operation, saved-file roundtrip or every formatting property.

This fixes data preservation for the explicitly recognized formats. General language planning, full multilingual quality, selected-text replacement integration, target/selection binding, complex shapes and physical-device verification remain part of the active broader goal.
