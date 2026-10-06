# Current production preview response audit

The fresh owned Vite preview served four actual GET requests: the WebLLM Worker, the dedicated IM chunk, editor HTML and native Word iframe HTML. Every response was HTTP 200 with COOP same-origin and COEP require-corp; each response body matched its current production file by SHA-256. Only the model Worker received the expected additional response CSP. The editor response contained the exact shell meta policy recorded by the preceding current-build audit.

Run `node docs/evaluations/probe-current-csp-responses.mjs` after a production build. The probe owns an ephemeral preview server and closes it before writing its report. It never injects response headers or rewrites the served artifacts. The JSON pins the executed probe and source commit.

This is local preview delivery evidence, not deployed Pages/Docker behavior, browser CSP enforcement, model inference, external-request confidentiality, offline operation or physical mobile acceptance. The preceding static audit still records broad HTTP/HTTPS connection permissions; these headers do not constitute an exfiltration barrier. Existing historical browser enforcement reports remain scoped to their recorded artifacts, not automatically to this current build.
