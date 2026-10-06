export interface GenerationOptions {
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}
export interface GenerationSettings {
  systemPrompt?: string;
  temperature: number;
  topP: number;
  maxTokens: number;
}
export function normalizeGenerationOptions(options: GenerationOptions = {}): GenerationSettings {
  const temperature = options.temperature ?? 0.7;
  const topP = options.topP ?? 0.8;
  const maxTokens = options.maxTokens ?? 512;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
    throw new Error('Invalid generation temperature (0–2)');
  if (!Number.isFinite(topP) || topP <= 0 || topP > 1)
    throw new Error('Invalid generation top_p (greater than 0, up to 1)');
  if (!Number.isInteger(maxTokens) || maxTokens < 32 || maxTokens > 1024)
    throw new Error('Invalid generation token limit (32–1024)');
  if (
    options.systemPrompt !== undefined &&
    (typeof options.systemPrompt !== 'string' || options.systemPrompt.length > 2000)
  )
    throw new Error('System prompt must be at most 2000 characters');
  return { temperature, topP, maxTokens, systemPrompt: options.systemPrompt?.trim() || undefined };
}
export function generationParameters(settings: GenerationSettings) {
  return { temperature: settings.temperature, top_p: settings.topP, max_tokens: settings.maxTokens };
}
