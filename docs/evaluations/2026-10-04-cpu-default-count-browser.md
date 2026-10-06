# Default memory64/JSPI CPU native count verification

The isolated Emscripten 4.0.20 default CPU build completed with terminal exit 0 and Built target wllama. A source copy embeds that exact generated JS wrapper, then tsup builds its browser ESM client successfully. The generated/client native binding is recorded separately; the original SDK checkout and installed product dependencies are not replaced.

Actual Chromium execution completes without page errors or capability overrides. crossOriginIsolated=true, JSPI is available and the real memory64 module validates. getWorkerResources selects compat=false and no inline compatibility worker. The paired default native WASM loads the Qwen3 0.6B model in a one-thread diagnostic with context 2048.

Four repeated counts match actual generation prompt usage: 16 ASCII, 25 Chinese, 45 mixed and 30 multi-turn. The 3821-token system overflow is detected against capacity 2048. Unsupported content parts raise a readable error, followed by successful deterministic recovery. No generation occurs within the repeated count intervals. This is count/usage acceptance, not output-quality certification; the mixed-text generation deliberately limits output to 16 tokens.

This establishes the first actual default CPU native-count scenario. Multi-thread execution, provider Stop/default reload, paired default/compat package production loading and IM/offline integration remain required. GGML_WEBGPU=OFF is intentional for CPU fallback and does not validate GGUF GPU inference or WebLLM parity.

Verification: `python3 docs/evaluations/verify-cpu-default-count-browser.py`.
