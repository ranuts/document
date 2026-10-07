import type {
  ModelTask,
  TaskModelBinding,
  TaskModelPreferences,
  TaskModelRequest,
} from '@ranuts/agent-core/llm/task-model';
import { WRITING_LANGUAGES } from '@ranuts/agent-core/llm/writing-task';

const tasks: ModelTask[] = ['chat', 'tools', 'rewrite', 'summarize', 'translate'];
function binding(value: unknown, models: readonly string[]): TaskModelBinding | undefined {
  if (!value || typeof value !== 'object') return;
  const candidate = value as Record<string, unknown>;
  if (candidate.backend !== 'webllm' || typeof candidate.model !== 'string' || !models.includes(candidate.model))
    return;
  return { backend: 'webllm', model: candidate.model };
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
/** Only known preset identities are persisted; artifact URLs and credentials are excluded. */
export function readTaskModelPreferences(raw: string | null, models: readonly string[]): TaskModelPreferences {
  try {
    const value = record(JSON.parse(raw ?? '{}'));
    if (value.version !== 1) return {};
    const result: TaskModelPreferences = {};
    for (const task of tasks) {
      const selected = binding(record(value.tasks)[task], models);
      if (selected) (result.tasks ??= {})[task] = selected;
    }
    for (const language of WRITING_LANGUAGES) {
      const selected = binding(record(value.translations)[language], models);
      if (selected) (result.translations ??= {})[language] = selected;
    }
    return result;
  } catch {
    return {};
  }
}
export function writeTaskModelPreference(
  current: TaskModelPreferences,
  request: TaskModelRequest,
  model: string,
  models: readonly string[],
): TaskModelPreferences {
  if (
    !tasks.includes(request.task) ||
    (request.task === 'translate' && !WRITING_LANGUAGES.includes(request.targetLanguage!))
  )
    throw new Error('Invalid task preference');
  if (model && !models.includes(model)) throw new Error('Unknown task model');
  const next = readTaskModelPreferences(JSON.stringify({ version: 1, ...current }), models);
  const selected: TaskModelBinding = { backend: 'webllm', model };
  if (request.task === 'translate') {
    if (model) (next.translations ??= {})[request.targetLanguage!] = selected;
    else if (next.translations) delete next.translations[request.targetLanguage!];
  } else {
    if (model) (next.tasks ??= {})[request.task] = selected;
    else if (next.tasks) delete next.tasks[request.task];
  }
  return next;
}
