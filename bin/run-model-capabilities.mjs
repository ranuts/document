/** Import in an isolated localhost Vite browser page; only public test text. */
import { WebLLMProvider } from '../packages/agent-core/src/llm/webllm.ts';
import { WRITING_SYSTEM_PROMPT, buildWritingMessages } from '../packages/agent-core/src/llm/writing-task.ts';

export async function runModelCapabilities(models, cases, checkpoint, onState = () => {}, afterCases) {
  const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
  const adapter = await navigator.gpu?.requestAdapter();
  for (const model of models) {
    const record = {
      model,
      startedAt: new Date().toISOString(),
      browser: navigator.userAgent,
      gpu: adapter?.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture } : null,
      parameters: { temperature: 0.7, top_p: 0.8, max_tokens: 512, enable_thinking: false },
      prompt: WRITING_SYSTEM_PROMPT,
      status: 'loading',
      results: [],
    };
    let lastProgress;
    const provider = new WebLLMProvider({
      model,
      chatOnly: true,
      systemPrompt: WRITING_SYSTEM_PROMPT,
      onProgress: (progress) => {
        lastProgress = progress;
        onState({ model, status: 'loading', progress });
      },
    });
    try {
      await checkpoint(record);
      const started = performance.now();
      await provider.preload();
      record.loadMs = performance.now() - started;
      record.status = 'running';
      await checkpoint(record);
      for (let repetition = 1; repetition <= 3; repetition++) {
        for (const testCase of cases) {
          const started = performance.now();
          let firstMs;
          const signal = AbortSignal.timeout(120000);
          const result = { id: testCase.id, locale: testCase.locale, repetition, request: testCase.request };
          try {
            const response = await provider.chatStream(
              buildWritingMessages(testCase.request),
              [],
              () => {
                firstMs ??= performance.now() - started;
              },
              signal,
            );
            Object.assign(result, {
              output: response.text,
              firstMs,
              totalMs: performance.now() - started,
              stopReason: response.stopReason,
              thinkingMarkup: /<\/?think>/.test(response.text),
              literalsPreserved: ['1,250', 'EUR', '2026-10-08', 'Alex'].every((value) => response.text.includes(value)),
            });
          } catch (error) {
            result.error = String(error);
            result.totalMs = performance.now() - started;
          }
          record.results.push(result);
          await checkpoint(record);
          onState({ model, status: 'running', completed: record.results.length, total: cases.length * 3 });
          if (!provider.isReady()) throw new Error('Engine became unavailable during evaluation');
        }
      }
      record.status = 'done';
      if (afterCases) await afterCases(provider);
    } catch (error) {
      record.status = 'error';
      record.error = String(error);
      record.lastProgress = lastProgress;
    } finally {
      await provider.dispose();
      record.finishedAt = new Date().toISOString();
      await checkpoint(record);
      // This runner is used only in an isolated evaluation context, never a user tab.
      await deleteModelAllInfoInCache(model).catch(() => {});
    }
    onState({ model, status: record.status, completed: record.results.length });
  }
}
