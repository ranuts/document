# GPU unavailable feedback scope

The authorized local-assistant specification requires a retryable state after GPU loss. This repair carries that existing requirement through the provider lifecycle; it introduces no new product policy.

## Evidence

- Runtime fact: the native device-loss receipt preserves interrupted text, an unlocked input and successful explicit retry, but still displays the loaded note/status immediately after loss.
- Code fact: `WebLLMProvider.isReady()` reads its engine failure signal; the Worker sends its unload notification asynchronously. Panel request finalization samples readiness once. No later invalidation subscription updates panel feedback.
- Hypothesis to verify: readiness invalidation after request finalization leaves loaded feedback stale. A behavior test must reproduce that ordering before implementation.

## Change boundary

Allowed: WebLLM provider options/lifecycle, the existing panel WebLLM configuration, their two unit test files and this repair's browser evidence. Add an optional unavailable callback, observe the existing engine failure signal and remove obsolete listeners. Panel callbacks must be generation guarded and skip initial loading, whose existing catch owns feedback.

Untouched: model defaults, prompts, generation settings, cache/storage formats, CPU fallback policy, document operations, tool sequences and UI structure. The public lifecycle interface needs no new required member. Existing consumers and injected providers without the optional callback remain compatible.

## Verification

First reproduce a late invalidation after chat input unlocks. Cover provider failure notification, ordinary request errors retaining readiness, disposal/obsolete-engine notifications, and panel stale-generation protection. Then run the related tests, types/lint and build. Repeat actual GPUDevice destruction with current production assets; require cleared loaded feedback, preserved partial text, no automatic replay and successful explicit reload.

## Simplest alternative

A delayed readiness recheck has no guaranteed relation to Worker delivery; reject an arbitrary timeout. Polling creates an avoidable timer. Observe the existing failure signal and forward one optional callback, with explicit cleanup and ownership checks.
