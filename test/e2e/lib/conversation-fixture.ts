interface ConversationFixture {
  mode: string;
  requests: unknown[];
  completed: boolean;
  autoFirst: boolean;
  streams: number;
  advance(): void;
}
declare global {
  interface Window {
    __conversationFixture: ConversationFixture;
  }
}
/** Deterministic public provider events for UI acceptance; no model-quality claims. */
export function installConversationFixture() {
  localStorage.setItem('document-assistant-enabled', 'true');
  localStorage.setItem(
    'agent-writing-endpoint',
    JSON.stringify({
      version: 1,
      kind: 'loopback',
      baseUrl: 'http://localhost:11434',
      model: 'craft-fixture',
      preference: 'device-first',
      localWritingConsent: false,
    }),
  );
  const state = {
    mode: 'reasoning',
    requests: [] as unknown[],
    completed: false,
    autoFirst: true,
    streams: 0,
    advance: () => {},
  };
  window.__conversationFixture = state;
  const nativeFetch = window.fetch.bind(window);
  const encoder = new TextEncoder();
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('localhost:11434/api/')) return nativeFetch(input, init);
    if (url.endsWith('/tags')) return Response.json({ models: [{ name: 'craft-fixture' }] });
    const body = JSON.parse(String(init?.body ?? '{}'));
    state.requests.push(body);
    if (body.format?.properties?.task)
      return Response.json({ done: true, message: { content: JSON.stringify({ task: 'chat', language: 'en' }) } });
    if (state.mode === 'failure') return new Response('Fixture service failure', { status: 400 });
    state.completed = false;
    const steps: Array<{ thinking?: string; content?: string }> =
      state.mode === 'artifact'
        ? [
            { content: '## Project update\n\nThe migration is on track.\n\n' },
            { content: '- Confirm pilot owners before Friday.\n- Publish the release notes.\n' },
          ]
        : [
            ...(state.mode === 'answer-only'
              ? []
              : [
                  { thinking: 'I’m checking the supplied project notes. ' },
                  { thinking: 'I’ll separate progress, risks and the next action.' },
                ]),
            { content: '## Project update\n\n' },
            { content: 'The migration is **on track**. The next milestone is the pilot release.\n\n' },
            { content: '| Area | Status |\n| --- | --- |\n| Build | Complete |\n| Pilot | In progress |\n\n' },
            { content: '### Next action\n\n- Confirm the pilot owners.\n- Review the release notes.\n\n' },
            { content: '```ts\nconst status = "ready";\n```\n' },
          ];
    return new Response(
      new ReadableStream({
        start(controller) {
          state.streams++;
          let index = 0;
          state.advance = () => {
            try {
              if (index < steps.length) {
                controller.enqueue(encoder.encode(JSON.stringify({ done: false, message: steps[index++] }) + '\n'));
              } else {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ done: true, done_reason: 'stop', message: { content: '' } }) + '\n'),
                );
                state.completed = true;
                controller.close();
                state.advance = () => {};
              }
            } catch {
              state.advance = () => {};
            }
          };
          if (state.autoFirst) state.advance();
        },
      }),
      { headers: { 'Content-Type': 'application/x-ndjson' } },
    );
  };
}
