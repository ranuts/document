/** Browser-side smoke evaluation. Import from the local Vite server. */
export async function evaluateLocalWriting(provider, samples, buildWritingMessages, onResult = () => {}, signal) {
  const results = [];
  await provider.preload();
  for (const [locale, text] of samples) {
    signal?.throwIfAborted();
    const started = performance.now();
    let firstMs;
    const response = await provider.chatStream(
      buildWritingMessages({ task: 'rewrite', text }),
      [],
      () => {
        firstMs ??= performance.now() - started;
      },
      signal,
    );
    const result = {
      locale,
      text,
      output: response.text,
      firstMs,
      totalMs: performance.now() - started,
      // Literal checks are not semantic quality scores or language detection.
      literalsPreserved: ['1,250', 'EUR', '2026-10-08', 'Alex'].every((value) => response.text.includes(value)),
    };
    results.push(result);
    onResult(result);
  }
  return results;
}
