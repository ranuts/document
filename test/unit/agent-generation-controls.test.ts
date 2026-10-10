import { expect, it, vi } from 'vitest';
import { createGenerationControls } from '../../lib/agent-plugin/ui/generation-controls';

it('shows the valid output token range beside its editable setting', () => {
  const controls = createGenerationControls(() => {});
  const input = controls.el.querySelector<HTMLInputElement>('[name="maxTokens"]')!;
  expect(input.closest('label')?.textContent).toContain(`${input.min}–${input.max}`);
  controls.sync();
  expect(input.closest('label')?.textContent).toContain('32–1024');
});
it('accepts fractional sampling values allowed by the request validator', () => {
  const update = vi.fn();
  const controls = createGenerationControls(update);
  const temperature = controls.el.querySelector<HTMLInputElement>('[name="temperature"]')!;
  const topP = controls.el.querySelector<HTMLInputElement>('[name="topP"]')!;
  temperature.value = '0.35';
  topP.value = '0.005';
  expect(temperature.checkValidity()).toBe(true);
  expect(topP.checkValidity()).toBe(true);
  topP.dispatchEvent(new Event('change'));
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ temperature: 0.35, topP: 0.005 }));
  topP.value = '0';
  topP.dispatchEvent(new Event('change'));
  expect(topP.getAttribute('aria-invalid')).toBe('true');
  expect(topP.checkValidity()).toBe(false);
  expect(controls.value().topP).toBe(0.005);
});
it('keeps custom prompts in memory and applies valid settings without reinitialization', () => {
  localStorage.clear();
  const update = vi.fn();
  const controls = createGenerationControls(update);
  const temperature = controls.el.querySelector<HTMLInputElement>('[name="temperature"]')!;
  temperature.value = '0.3';
  temperature.dispatchEvent(new Event('change'));
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ temperature: 0.3, topP: 0.8, maxTokens: 512 }));
  const prompt = controls.el.querySelector<HTMLTextAreaElement>('textarea')!;
  prompt.value = 'Private instructions';
  prompt.dispatchEvent(new Event('change'));
  expect(controls.value().systemPrompt).toBe('Private instructions');
  expect(localStorage.length).toBe(0);
});
it('rejects invalid fields while keeping the last working configuration', () => {
  const update = vi.fn();
  const controls = createGenerationControls(update);
  const tokens = controls.el.querySelector<HTMLInputElement>('[name="maxTokens"]')!;
  tokens.value = '99999';
  tokens.dispatchEvent(new Event('change'));
  expect(update).not.toHaveBeenCalled();
  expect(controls.value().maxTokens).toBe(512);
  expect(controls.el.querySelector('[role="status"]')?.textContent).toBeTruthy();
});

it('marks only invalid fields and clears their errors after correction', () => {
  const update = vi.fn();
  const controls = createGenerationControls(update);
  const tokens = controls.el.querySelector<HTMLInputElement>('[name="maxTokens"]')!;
  const temperature = controls.el.querySelector<HTMLInputElement>('[name="temperature"]')!;
  const prompt = controls.el.querySelector<HTMLTextAreaElement>('textarea')!;
  tokens.value = '99999';
  temperature.value = '3';
  tokens.dispatchEvent(new Event('change'));
  expect(tokens.getAttribute('aria-invalid')).toBe('true');
  expect(temperature.getAttribute('aria-invalid')).toBe('true');
  expect(prompt.getAttribute('aria-invalid')).toBe('false');
  expect(controls.el.querySelector('[name="topP"]')?.getAttribute('aria-invalid')).toBe('false');
  temperature.value = '0.35';
  temperature.dispatchEvent(new Event('change'));
  expect(temperature.getAttribute('aria-invalid')).toBe('false');
  expect(tokens.getAttribute('aria-invalid')).toBe('true');
  expect(update).not.toHaveBeenCalled();
  tokens.value = '96';
  tokens.dispatchEvent(new Event('change'));
  expect(tokens.getAttribute('aria-invalid')).toBe('false');
  expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ temperature: 0.35, maxTokens: 96 }));
});
