import { describe, expect, it } from 'vitest';
import { classifyRequest } from '../../lib/agent-plugin/ui/request-intent';
describe('natural request routing', () => {
  it('recognizes instructions but keeps questions in chat', () => {
    expect(classifyRequest('请把选中文字润色得更专业').task).toBe('rewrite');
    expect(classifyRequest('总结选中的内容').task).toBe('summarize');
    expect(classifyRequest('翻译成日语').language).toBe('ja');
    expect(classifyRequest('怎么翻译这句话？').task).toBe('chat');
    expect(classifyRequest('解释一下改写和总结的区别').task).toBe('chat');
  });
  it('uses the translation destination rather than the source language', () => {
    expect(classifyRequest('把日语翻译成中文').language).toBe('zh-CN');
    expect(classifyRequest('Translate Japanese into German').language).toBe('de');
    expect(classifyRequest('把中文翻译成英文').language).toBe('en');
  });
  it('routes document commands and never carries a previous mode', () => {
    expect(classifyRequest('将选区按 B 列升序排序，首行为表头').task).toBe('tools');
    expect(classifyRequest('Explain this formula').task).toBe('chat');
    expect(classifyRequest('Rewrite the selected text concisely').task).toBe('rewrite');
  });
});
