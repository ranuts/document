# Actual range result literal rendering

Source inspection found tool results already use text nodes in ChatView; Markdown rendering applies to assistant replies. Existing chat-view tests cover literal/hostile tool messages, so no product change was necessary.

Actual current CPU Excel IM read A1:B4 with A3 containing **Cora** [Davi](https://example.invalid) `Mira` <b>raw</b>. The activity-result DOM preserved every requested cell/address and the literal syntax. Within that actual result, no links, bold/strong, code, images or script elements were generated. Native formula 10+20 and the inspected values remained unchanged; no preview cards or errors appeared.

The probe uses normal editor APIs and the real document-operation route, without output substitution. The verifier inspects actual result DOM, not just page text. This demonstrates literal rendering for this fixture; it does not certify deployed CSP, all XSS payloads, or model semantics. Raw evidence and probe are retained.
