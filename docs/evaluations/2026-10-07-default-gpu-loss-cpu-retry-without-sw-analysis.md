# Default GPU loss and explicit CPU retry

Current production editor-BRhW6Vt0.js, core 1791364456, default Qwen3-1.7B loads on WebGPU. The test temporarily unregisters the existing Service Worker in its owned profile and opens an uncontrolled page; an explicit diagnostic Worker startup packet and intercepted production headers establish that the fault hook ran. One actual GPUDevice is destroyed while idle.

After loss: status clears, Load model appears, native blank document is unchanged, zero WebLLM stream requests and zero CPU load/completion calls. All observed top-frame Worker construction remains the original single WebLLM Worker. No automatic CPU replay is observed before explicit retry.

The test then hides navigator.gpu for this page and clicks the existing Load button. The actual CPU fallback status is Qwen3 0.6B; native Wllama loadModel is called once and createChatCompletion once. A greeting completes with no chat/page errors. This is simulated capability unavailability with genuine CPU inference, not physical GPU hardware disappearance or Windows/mobile validation. Process exits 0, browser closes and prelaunch-bound runtime files remain unchanged. It is not seven-language quality or offline acceptance.

Two earlier interception failures remain preserved. serviceWorkers:block did not remove this profile's already active controller; any future offline test must register/seed its current shell again. No product cache, prompt, model default or operation policy is changed.
