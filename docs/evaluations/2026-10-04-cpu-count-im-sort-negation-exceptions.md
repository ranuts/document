# English no-sort generic error traced

Two actual CPU IM diagnostic runs enabled Chromium Debugger pause-on-caught-exceptions after model readiness, recorded exception descriptions/call locations, and immediately resumed. No requests or inference outputs were replaced. Both repeated the same Chinese no-op, English no-op, and affirmative B2-read cases.

The Chinese no-op produced agentToolNotChosen; its captured parser local contained {"tool":"unsupported","input":{}}. The English no-op produced Invalid document tool parameters through the parameter validator and plan parser. This establishes that the generic UI error comes from a rejected invalid plan, not editor execution or model loading. The exact English plan parameters have not yet been captured: the top validator frame had no local variables, and remote object identifiers cannot be inspected after browser closure. Further instrumentation should inspect the parser caller frame before resume.

All inspected cells remained unchanged and the affirmative read returned B2/30. Debugger instrumentation can affect timing; these reports are diagnostic evidence, not latency acceptance. No product code changed and the English feedback gap remains open. Raw reports, executed probes and verifier are retained.
