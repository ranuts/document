# Fresh-context CPU self-hosted download privacy

A newly launched Chromium browser and fresh nonpersistent context loaded the
current built Word IM. No existing browser profile was reused and service
workers were blocked. Initial Cache API names were empty; the application had
already initialized its document-history and WebLLM database names, so the
record is not a claim that no database existed at inspection time.

The actual local GGUF (491 MB rounded; exact byte size is in the raw report)
was served from an owned ephemeral loopback HTTP server. Its local file
SHA-256, inspected after the run, was
`74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db`.
This is file identity evidence, not independently verified publisher provenance.
The configured CPU provider performed an actual download and inference without
substituted output. The model server recorded exactly HEAD and GET for the GGUF,
with empty request bodies and no conversation marker in URLs or headers.
All 95 observed browser-context requests were GET/HEAD without bodies, with no
plaintext marker prefix in decoded URLs or recorded headers. Model server
observations strengthen the previous page-associated warm-cache audit.

The model simply echoed the privacy marker; this establishes no useful answer
quality. Automatic default-model loading could initialize before the CPU
provider was selected; the report preserves all observed requests. This is not
a general privacy certificate: other processes, encoded covert channels,
arbitrary redirects, malicious custom runtimes, deployed policy enforcement,
physical mobile devices and service-worker paths remain outside scope.

The first harness attempt selected a hidden CPU URL control before explicitly
switching providers, and ran no configured download or inference. Its exact
driver and failure report are preserved. The successful driver selects the
provider through its normal change handler. Both attempts closed their owned
browser and HTTP server in `finally`. No product code changed. Executed drivers
are copied byte-for-byte; their output path remains the original scratch path.
Run `python3 docs/evaluations/verify-cold-selfhost-cpu-fresh.py` for assertions.
