import { afterEach, expect, it, vi } from 'vitest';
import { renderMarkdown } from '../../packages/chat-ui/src/markdown';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function render(source: string) {
  const target = document.createElement('div');
  document.body.append(target);
  renderMarkdown(target, source);
  return target;
}
it('honors declared column alignment in a named, keyboard-scrollable table', () => {
  const target = render('| Name | Status | Cost |\n| :--- | :---: | ---: |\n| One | Ready | 1234 |');
  const region = target.querySelector('.cui-table')!;
  expect(region.getAttribute('role')).toBe('region');
  expect(region.getAttribute('aria-label')).toBeTruthy();
  expect((region as HTMLElement).tabIndex).toBe(0);
  expect(Array.from(target.querySelectorAll('th'), (cell) => cell.style.textAlign)).toEqual([
    'left',
    'center',
    'right',
  ]);
  expect(Array.from(target.querySelectorAll('td'), (cell) => cell.style.textAlign)).toEqual([
    'left',
    'center',
    'right',
  ]);
});
it('keeps exact literal code and exposes language and actual copy feedback', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const source = '<script>\n  const value = "安全";\n\treturn value;\n</script>';
  const target = render('```html\n' + source + '\n```');
  expect(target.querySelector('.cui-code-language')?.textContent).toBe('HTML');
  expect(target.querySelector('pre code')?.textContent).toBe(source);
  expect(target.querySelector('script')).toBeNull();
  const copy = target.querySelector<HTMLButtonElement>('.cui-code-copy')!;
  expect(copy).not.toBeNull();
  copy.click();
  await Promise.resolve();
  expect(writeText).toHaveBeenCalledWith(source);
  expect(copy.textContent).toContain('Copied');
  writeText.mockRejectedValueOnce(new Error('denied'));
  copy.click();
  await Promise.resolve();
  expect(copy.textContent).toContain('Could not copy');
});
