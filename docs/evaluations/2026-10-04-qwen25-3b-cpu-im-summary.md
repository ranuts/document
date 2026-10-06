# Qwen2.5 3B GGUF: native browser CPU IM summary screen

The full IM summary route is mechanically functional but this model/settings combination is not accepted for default use. Simple date-copy success did not transfer to reliable multilingual summaries: Chinese produces German with a reformatted date; other outputs have grammar, sentence-count or valuation-wording issues. Six applied results are not six proven-correct summaries.

Seven known development summary fixtures, one fixed-order sample each. Driver preregistered in `7e84cc3`, explicit provider selection corrected before successful inference in `7ef6143`. Current production writing prompts and schema/guards remain unchanged. Native Word selected text and real sidebar submission; route-local raw capture plus a non-mutating wrapper around the shipped CPU SDK's createChatCompletion record actual request fields. The wrapper forwards the original object and returns the original completion without substituting text or native results. Current distribution files remain unchanged.

The model is loaded through the existing GGUF file settings as `qwen2.5-3b-instruct-q4_k_m.gguf`, CPU only. Independent read-only identity evidence confirms the selected local path remains 2,104,932,768 bytes with SHA256 `626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d`, identical to the earlier native/browser CPU reference. UI generation controls set temperature 0, top_p 0.8 and max_tokens 512; captured SDK requests confirm these actual values and logical JSON schema. This is not the earlier minimal date-copy prompt. The CPU writing route uses its production chat-only system prompt and full writing user body; it is not a single-variable comparison to WebLLM.

| Language | Captured observation |
| --- | --- |
| Chinese | Unrequested German output with 23.09.2044 date reformat; refused, source preserved |
| English | One sentence retains proposal, valuation, prerequisite and pending inspection/authorization; applies |
| Japanese | Awkward 提出しました wording and several sentences; shipment expressed as 発送します rather than clearly keeping the whole action proposed; applies, not semantic acceptance |
| Korean | Fragmented multiple sentences retain proposal/pending status and explicit filter valuation; applies |
| German | Ungrammatical Rika vorschlug main clause and two sentences; literals/status retained; applies |
| Spanish | One sentence with proposal/status, but enviar 11 filtros por 430 PLN leaves what the amount values less precise than the source's explicit filter valuation; applies, valuation fidelity not established |
| Portuguese | Proposal and explicit valuation/status retained, but two sentences instead of requested one; applies |

The screen does not certify the Japanese modal interpretation or resolve Spanish valuation ambiguity; do not count literal preservation as semantic equivalence. It also does not justify promoting a model based on applied/refused counts. Each source asks for one concise sentence. All seven finish normally; six outputs apply directly without previews and have exact native Undo/Redo. The one refusal preserves original selected text. No harness page errors or observed external HTTP requests occur in this warm-cache desktop run. No Save, Stop/Retry, cold offline/PWA, mobile or general privacy certificate follows.

Response time ranges 17.3–56.8 seconds. Chinese first call reports 44.7 seconds prompt processing plus 12.1 seconds decoding; later requests can reuse prefix work. One fixed-order session is not a portable benchmark, but this observed latency is insufficient for claiming a responsive default IM experience. A 3B CPU model remains a heavy optional diagnostic, not the lightweight mobile fallback.

One zero-inference harness failure is preserved: before explicit UI provider selection, the GGUF load button was not visible and timed out. No model output was produced. The subsequent run explicitly selects wllama through the settings UI before selecting the same local file. This is a harness correction, not a production fix.

`python3 docs/evaluations/verify-qwen25-3b-cpu-im-summary.py` validates exact fixture coverage, source/instruction capture, current bundle/driver hashes, model identity sidecar, actual generation/schema fields, refusal source protection and native Undo/Redo. It does not approve summary semantics. Keep production model/default settings unchanged; date-copy tests establish a narrower capability than full document writing. Further quality work needs independent unused sources, explicit factual-relation scoring and suitable latency, not fixture-specific repair rules.
