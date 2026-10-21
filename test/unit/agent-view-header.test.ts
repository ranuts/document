import { expect, it, vi } from 'vitest';
import { createViewHeader, labelViewBack } from '../../lib/agent-plugin/ui/view-header';

it('composes the owned heading and action without replacing their identity or callbacks', () => {
  const heading = document.createElement('h2');
  const back = document.createElement('button');
  const close = vi.fn();
  back.addEventListener('click', close);
  const header = createViewHeader(heading, back);
  labelViewBack(back, 'Back to conversation');
  expect(header.querySelector('h2')).toBe(heading);
  expect(header.querySelector('button')).toBe(back);
  expect(back.getAttribute('aria-label')).toBe('Back to conversation');
  expect(back.title).toBe('Back to conversation');
  expect(back.querySelector('span')?.textContent).toBe('Back to conversation');
  expect(back.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  labelViewBack(back, '返回成果');
  expect(back.querySelectorAll('svg')).toHaveLength(1);
  expect(back.getAttribute('aria-label')).toBe('返回成果');
  expect(back.querySelector('span')?.textContent).toBe('返回成果');
  back.click();
  expect(close).toHaveBeenCalledTimes(1);
});
