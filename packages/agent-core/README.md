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
