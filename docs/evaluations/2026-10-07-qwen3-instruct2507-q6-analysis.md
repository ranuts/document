# Frozen Q4/Q6 known-source contrast

The process completed with exit code 0, eight inference rows, closed per-case contexts and a closed browser. Both complete model artifacts were verified before loading. Four known failed source requests were replayed once for each quantization with the same original product messages, schema, sampler and four-thread CPU configuration.

Q4 failed all four known-source checks. Q6 narrowly passed the German rewrite: it retained grammatical `schlug ... vor` and the checked facts. Q6 still failed Chinese summary (English output and omitted delivery-team actor), Japanese-to-Korean translation (changed original name and omitted Ken Sato), and Spanish rewrite (English output). Q6 corrected the Korean translation's malformed ISO date without repairing the actor/name requirements. Applied output and successful native Undo/Redo are not semantic acceptance.

The separate metadata comparison found equal parsed metadata except general.file_type, including tokenizer and chat-template identities. This does not establish identical pre-quantization weights or prove a pure causal effect of quantization. These are selected development failures, not a representative quality estimate, seven-language gate or native-speaker review. No candidate/default change is justified.

The strict receipt verifier checks frozen requests, artifact identities and native application/history mechanics separately from this semantic review. Runtime hashes are preserved before and after the run; no build was replaced during inference.
