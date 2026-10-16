import { expect, it } from 'vitest';
import { createTaskReceipt } from '../../lib/agent-plugin/ui/task-receipt';
it('counts only settled actual writes and discloses partial outcomes without promoting sent to verified', () => {
  const receipt = createTaskReceipt();
  receipt.observe({ type: 'tool_result', name: 'get_document', content: '{}', isError: false, readOnlyHint: true });
  expect(receipt.el.hidden).toBe(true);
  for (const status of ['verified', 'sent', 'failed', 'cancelled'])
    receipt.observe({
      type: 'tool_result',
      name: 'insert_text',
      content: JSON.stringify({ status, target: 'Current document' }),
      isError: status === 'failed',
      readOnlyHint: false,
    });
  expect(receipt.el.hidden).toBe(false);
  expect(receipt.el.open).toBe(false);
  expect(receipt.el.querySelector('summary')?.textContent).toContain('1 verified');
  expect(receipt.el.querySelector('summary')?.textContent).toContain('1 unverified');
  expect(receipt.el.querySelectorAll('li')).toHaveLength(4);
  expect(receipt.el.querySelectorAll('button')).toHaveLength(0);
  receipt.dispose();
});
it('bounds task detail and ignores non-results and ambiguous successful payloads', () => {
  const receipt = createTaskReceipt();
  receipt.observe({ type: 'tool_call', name: 'insert_text', input: {} });
  receipt.observe({ type: 'tool_result', name: 'insert_text', content: '{}', isError: false, readOnlyHint: false });
  expect(receipt.el.hidden).toBe(true);
  receipt.dispose();
});
it('retains all outcome counts while bounding the detail list to 16 rows', () => {
  const receipt = createTaskReceipt();
  for (let i = 0; i < 17; i++)
    receipt.observe({
      type: 'tool_result',
      name: 'insert_text',
      content: JSON.stringify({ status: 'verified' }),
      isError: false,
      readOnlyHint: false,
    });
  expect(receipt.el.querySelector('summary')?.textContent).toContain('17 verified');
  expect(receipt.el.querySelectorAll('li')).toHaveLength(16);
  expect(receipt.el.querySelector('.agent-task-receipt-limit')?.textContent).toContain('16');
  receipt.dispose();
});
it('never promotes an error payload claiming verified into a verified count', () => {
  const receipt = createTaskReceipt();
  receipt.observe({
    type: 'tool_result',
    name: 'insert_text',
    content: JSON.stringify({ status: 'verified' }),
    isError: true,
    readOnlyHint: false,
  });
  expect(receipt.el.querySelector('summary')?.textContent).toContain('1 failed');
  expect(receipt.el.querySelector('summary')?.textContent).not.toContain('1 verified');
  receipt.dispose();
});
