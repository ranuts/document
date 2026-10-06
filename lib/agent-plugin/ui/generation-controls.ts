import { normalizeGenerationOptions, type GenerationSettings } from '@ranuts/agent-core/llm/generation';
import { t, type I18nMessages } from '@ranuts/shared/i18n';

/** Advanced request settings are page-local, including any user-written system prompt. */
export function createGenerationControls(onChange: (settings: GenerationSettings) => void) {
  const el = document.createElement('details');
  el.className = 'agent-generation-options';
  const summary = document.createElement('summary');
  el.append(summary);
  const fields: Array<{ label: HTMLSpanElement; key: keyof I18nMessages }> = [];
  const row = (input: HTMLInputElement | HTMLTextAreaElement, key: keyof I18nMessages) => {
    const label = document.createElement('label');
    const text = document.createElement('span');
    label.append(text, input);
    el.append(label);
    fields.push({ label: text, key });
  };
  const prompt = document.createElement('textarea');
  prompt.name = 'systemPrompt';
  prompt.rows = 3;
  prompt.maxLength = 2000;
  row(prompt, 'agentSystemPrompt');
  const numeric = (name: string, key: keyof I18nMessages, min: number, max: number, step: number | 'any') => {
    const input = document.createElement('input');
    input.type = 'number';
    input.name = name;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    row(input, key);
    return input;
  };
  const temperature = numeric('temperature', 'agentTemperature', 0, 2, 'any');
  const topP = numeric('topP', 'agentTopP', 0, 1, 'any');
  const maxTokens = numeric('maxTokens', 'agentMaxTokens', 32, 1024, 1);
  const status = document.createElement('p');
  status.className = 'agent-generation-status';
  status.setAttribute('role', 'status');
  el.append(status);
  let value = normalizeGenerationOptions();
  temperature.value = String(value.temperature);
  topP.value = String(value.topP);
  maxTokens.value = String(value.maxTokens);
  let invalid = false;
  const sync = () => {
    summary.textContent = t('agentGenerationSettings');
    for (const field of fields)
      field.label.textContent = t(field.key) + (field.key === 'agentMaxTokens' ? ` (${maxTokens.min}–${maxTokens.max})` : '');
    prompt.placeholder = t('agentSystemPromptDefault');
    status.textContent = t(invalid ? 'agentGenerationInvalid' : 'agentGenerationLocal');
    for (const input of [prompt, temperature, topP, maxTokens])
      input.setCustomValidity(input.getAttribute('aria-invalid') === 'true' ? t('agentGenerationInvalid') : '');
  };
  const update = () => {
    const draft = {
      systemPrompt: prompt.value,
      temperature: temperature.valueAsNumber,
      topP: topP.valueAsNumber,
      maxTokens: maxTokens.valueAsNumber,
    };
    for (const input of [prompt, temperature, topP, maxTokens]) {
      let fieldInvalid = false;
      try {
        // Use the same ranges as generation requests, independently for each field.
        normalizeGenerationOptions({ [input.name]: draft[input.name as keyof GenerationSettings] });
      } catch {
        fieldInvalid = true;
      }
      input.setAttribute('aria-invalid', String(fieldInvalid));
    }
    try {
      const next = normalizeGenerationOptions(draft);
      onChange(next);
      value = next;
      invalid = false;
    } catch {
      invalid = true;
    }
    sync();
  };
  for (const input of [prompt, temperature, topP, maxTokens]) input.addEventListener('change', update);
  sync();
  return { el, sync, value: () => ({ ...value }) };
}
