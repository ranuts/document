import { WRITING_LANGUAGES, type WritingLanguage } from './writing-task';

export type ModelTask = 'chat' | 'tools' | 'translate' | 'summarize' | 'rewrite';
export interface TaskModelBinding {
  backend: 'webllm' | 'wllama' | 'loopback';
  /** Runtime model identity, not a display label. */
  model: string;
}
export interface TaskModelRequest {
  task: ModelTask;
  targetLanguage?: WritingLanguage;
}
export interface TaskModelPreferences {
  tasks?: Partial<Record<ModelTask, TaskModelBinding>>;
  translations?: Partial<Record<WritingLanguage, TaskModelBinding>>;
}
export interface ResolvedTaskModel {
  binding: TaskModelBinding;
  source: 'default' | 'task' | 'language';
  /** Configuration alone cannot establish semantic acceptance. */
  quality: 'experimental';
}

export function resolveTaskModel(
  request: TaskModelRequest,
  preferences: TaskModelPreferences,
  fallback: TaskModelBinding,
): ResolvedTaskModel {
  if (!['chat', 'tools', 'translate', 'summarize', 'rewrite'].includes(request.task))
    throw new Error('Unsupported model task');
  if (request.task === 'translate' && !WRITING_LANGUAGES.includes(request.targetLanguage as WritingLanguage))
    throw new Error('Translation requires a supported target language');
  const languageBinding =
    request.task === 'translate' ? preferences.translations?.[request.targetLanguage!] : undefined;
  const taskBinding = preferences.tasks?.[request.task];
  const selected = languageBinding ?? taskBinding ?? fallback;
  if (!['webllm', 'wllama', 'loopback'].includes(selected.backend) || !selected.model.trim())
    throw new Error('Invalid task model binding');
  return {
    binding: { backend: selected.backend, model: selected.model },
    source: languageBinding ? 'language' : taskBinding ? 'task' : 'default',
    quality: 'experimental',
  };
}
