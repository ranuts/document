# @ranuts/agent-core

Editor-agnostic agent core: a provider-neutral LLM layer and a tool-use runtime
loop. No UI, no editor, no DOM assumptions beyond `localStorage` (for optional
API-key storage). Bring your own tools and your own interface.

## Layers

- **`@ranuts/agent-core/llm`** — a neutral `LLMProvider` interface
  (message / tool / response shapes) with concrete providers behind a factory:
  Anthropic Claude, OpenAI, Gemini, Ollama, and in-browser WebLLM.
- **`@ranuts/agent-core/runtime`** — `runAgent(provider, message, { tools })`:
  the chat ⇄ tool-call loop. Streams text deltas, executes requested tools,
  feeds results back, and stops on a normal turn or the iteration cap.

## Usage

```ts
import { runAgent } from '@ranuts/agent-core/runtime';
import { createProvider } from '@ranuts/agent-core/llm';
import type { AgentTool } from '@ranuts/agent-core/types';

const tools: Record<string, AgentTool> = {
  echo: {
    name: 'echo',
    description: 'Echo text back',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: async ({ text }) => ({ echoed: text }),
  },
};

const provider = createProvider('anthropic', { apiKey: '…' });
const result = await runAgent(provider, 'echo hello', { tools, onEvent: console.log });
console.log(result.text);
```

The runtime is fully unit-testable with a scripted provider and mock tools — it
only knows the `LLMProvider` interface and the `AgentTool` registry.

The document product uses a default-off assistant switch. Opening the panel never downloads a model or connects a service. Runtime configuration is reached through the usage settings; generated selection edits require explicit review and confirmation. Browser-agent tools are documented separately in the developer reference.

## Fetch provider request bounds

OpenAI-compatible, Gemini, Ollama and Loopback providers use a five-minute total deadline
per request, covering headers and complete JSON or incremental response reads. Set `timeoutMs`
in their constructor options or `createProvider` options to override it. The
duration must be positive, finite and at most 2,147,483,647 milliseconds.
Caller cancellation retains its original reason; deadline expiry rejects with
`TimeoutError`. Both paths abort the transport and settle the provider call even
when an injected transport ignores cancellation. A late response cannot become
a successful result. Timers and caller subscriptions are released on settlement.

HTTP failures carry a numeric `status` and a safe provider/status message.
Upstream error bodies are cancelled without being read or included in errors.
Hosts can classify structured errors directly; serialized messages retain the
same provider/status category. No request is retried automatically. These bounds
do not alter the Anthropic SDK or browser-local inference lifetimes.

`maxResponseBytes` bounds actual response bytes, including streaming frames, to
8 MiB by default. It must be a positive safe integer. Declared oversized bodies
are rejected before reading; actual bytes are checked even if Content-Length is
missing or incorrect. Native response readers are cancelled on overflow, Stop,
timeout or consumer failure. Host transports exposing only `json()` retain a
post-materialization byte check and the same deadline.

Tool-free `chatStream` uses SSE for OpenAI-compatible/Gemini/Ollama endpoints and
NDJSON for Loopback. It emits text as it arrives and resolves to the same neutral
response shape. Compatible endpoints returning complete JSON remain supported.
A disconnected stream without a terminal finish marker fails; it is never a
complete answer. Tool-bearing requests use complete JSON, and schema-constrained
generation remains complete and validated by its caller before document writes.

Browser-local provider hosts may supply `prepareRuntimeAssets(capability)` to
persist the runtime actually being activated. This advisory callback never
starts model inference or changes the destination; persistence failures cannot
block online use. The app stores build-owned capability lists and restores
previously prepared capabilities across updates. Cloud setup prepares no local
inference or PDF runtime.

## Optional timing observations

`runAgent` accepts `onFirstProviderText?: () => void`, called once for the first
nonempty `chatStream` delta after abort checks and before runtime buffering. This
is the current `LLMProvider` boundary; schema/answer-only adapters may already
filter backend text. It is not a raw model-token timestamp, and blocking `chat`
calls do not fabricate it.

Local provider usage may include `contextPreparationDurationMs` (host request
construction and exact budgeting), `timeToFirstTextMs` and `responseDurationMs`.
Their monotonic execution basis excludes provider queue wait and model loading.
WebLLM includes its internal stream even for nonstream callers; its context field
does not measure Worker tokenization or GPU prefill. Wllama's exact-budget token
counting is included, while nonstream first-text time remains absent. Backend
first-token/prefill statistics retain their separate fields.
