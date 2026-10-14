# Asking again after stopping a local assistant

## Scope

Repair the WebLLM cancellation-to-next-request path. Preserve conversation
storage, explicit Send, the model queue, schema constraints, tool exchanges and
usage reporting. History and speech presentation are separate changes.

## Cause and decision

The installed WebLLM 0.2.85 engine keeps `interruptSignal` after
`interruptGenerate()`. Its non-streaming `chatCompletion()` checks that flag
before calling `_generate()`, which would normally clear it. Consequently,
stopping an answer or routing request makes subsequent non-streaming JSON
routing return empty content. The panel reports a generic request failure.

Use the SDK streaming entry for every WebLLM inference, including callers that
only need a complete `chat()` or `generateJSON()` result. That entry clears the
interrupt flag before generation. The provider accumulates the response and
keeps consuming the interrupted stream tail to release the worker model lock;
it does not expose internal JSON deltas to chat callers or replay a cancelled
request. This uses public SDK APIs rather than changing its private flag.

Hermes tool streams supply `index` without `id`, whereas the non-streaming SDK
supplies numeric string IDs. The WebLLM adapter fills missing IDs from the index
and keeps explicit IDs across later argument fragments. Generic OpenAI stream
conversion is unchanged.

## Evidence

- `webllm-stop-resume.test.ts` runs the installed SDK's real `chatCompletion`,
  `asyncGenerate` and `interruptGenerate`. Only the GPU pipeline boundary is
  synthetic. Stopping answer and routing generation is followed by two complete
  JSON-routing/chat turns.
- Reverse verification: restoring the original provider makes both cases fail
  with `Unexpected end of JSON input`; restoring the fix passes both.
- SDK-shaped dual-tool regression fails before ID adaptation (`['', '']`
  instead of `['0', '1']`) and passes afterwards. Explicit IDs remain intact.
- `agent-stop-resume.spec.ts` runs the real Word and PowerPoint editor panels
  with controlled loopback responses. Four cases stop during routing or an
  answer, preserve the draft, then receive two fresh replies without reload.
  Cancelled late content does not appear and no error message is shown.

These checks validate SDK lifecycle and application interaction separately.
They do not measure physical WebGPU inference, GPU memory loss, actual browser
worker latency or microphone transcription quality. The CPU provider's existing
runtime retirement and explicit reload policy is unchanged.
