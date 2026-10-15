import type { LLMResponse } from '@ranuts/agent-core/llm/types';

export type TimingStatus = 'success' | 'stopped' | 'failed' | 'limited' | 'review-pending' | 'superseded';
export interface RequestTimingRecord {
  status?: TimingStatus;
  durationMs?: number;
  routingDurationMs?: number;
  /** Host elapsed to the current LLMProvider.chatStream boundary, not a raw model token. */
  firstProviderTextMs?: number;
  firstFilteredTextMs?: number;
  /** Visible DOM observation, not compositor paint. */
  firstPresentedTextMs?: number;
  providerContextPreparationDurationMs?: number;
  providerTimeToFirstTextMs?: number;
  providerResponseDurationMs?: number;
}
const clock = (): number | undefined => {
  try {
    const value = globalThis.performance?.now();
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
};
let diagnosticSlot = 0;

/** Volatile, content-free numeric observations owned by one host execution. */
export function createRequestTiming(options: { isCurrent?: () => boolean } = {}) {
  const started = clock();
  const record: RequestTimingRecord = {};
  let open = true;
  const current = () => open && (options.isCurrent?.() ?? true);
  const elapsed = (from = started) => {
    const now = clock();
    return from !== undefined && now !== undefined ? Math.max(0, now - from) : undefined;
  };
  const first = (key: 'firstProviderTextMs' | 'firstFilteredTextMs' | 'firstPresentedTextMs') => {
    if (current() && record[key] === undefined) {
      const duration = elapsed();
      if (duration !== undefined) record[key] = duration;
    }
  };
  const finish = (status: TimingStatus): RequestTimingRecord => {
    if (!open) return { ...record };
    open = false;
    record.status = (options.isCurrent?.() ?? true) ? status : 'superseded';
    const duration = elapsed();
    if (duration !== undefined) record.durationMs = duration;
    try {
      // Fixed ring names bound local entries and never identify requests or content.
      const name = `document.assistant.request.${diagnosticSlot++ % 8}`;
      globalThis.performance?.clearMeasures?.(name);
      if (started !== undefined && duration !== undefined)
        globalThis.performance?.measure?.(name, { start: started, duration, detail: { ...record } });
    } catch {
      /* Diagnostics cannot prevent chat execution. */
    }
    return { ...record };
  };
  return {
    providerText: () => first('firstProviderTextMs'),
    filteredText: () => first('firstFilteredTextMs'),
    presented: () => first('firstPresentedTextMs'),
    routing: () => {
      const start = clock();
      let ended = false;
      return () => {
        if (ended || !current()) return;
        ended = true;
        const duration = elapsed(start);
        if (duration !== undefined) record.routingDurationMs = duration;
      };
    },
    usage: (usage: NonNullable<LLMResponse['usage']>) => {
      if (!current()) return;
      const valid = (value: number | undefined): value is number =>
        value !== undefined && Number.isFinite(value) && value >= 0;
      if (valid(usage.contextPreparationDurationMs))
        record.providerContextPreparationDurationMs =
          (record.providerContextPreparationDurationMs ?? 0) + usage.contextPreparationDurationMs;
      if (valid(usage.responseDurationMs))
        record.providerResponseDurationMs = (record.providerResponseDurationMs ?? 0) + usage.responseDurationMs;
      if (valid(usage.timeToFirstTextMs) && record.providerTimeToFirstTextMs === undefined)
        record.providerTimeToFirstTextMs = usage.timeToFirstTextMs;
    },
    finish,
    cancel: finish,
  };
}
export type RequestTiming = ReturnType<typeof createRequestTiming>;
