import { expect, it } from 'vitest';
import { parseDirectDocumentIntent } from '../../lib/agent-plugin/direct-intent';

it.each(['加粗', '请把选中的文字加粗', 'bold selection', 'make selected text bold'])(
  'routes an explicit selection command: %s',
  (text) => {
    expect(parseDirectDocumentIntent(text)).toEqual({ kind: 'bold', enabled: true });
  },
);
it('routes writing an existing answer and explicit paragraph alignment', () => {
  expect(parseDirectDocumentIntent('写到当前的文档上')).toEqual({ kind: 'write_reply', requireSelection: false });
  expect(parseDirectDocumentIntent('把上一条回答替换选区')).toEqual({ kind: 'write_reply', requireSelection: true });
  expect(parseDirectDocumentIntent('请将当前段落居中')).toEqual({ kind: 'align', alignment: 'center' });
  expect(parseDirectDocumentIntent('取消加粗')).toEqual({ kind: 'bold', enabled: false });
});
it.each([
  '怎么加粗？',
  '解释一下居中是什么',
  '不要加粗',
  '“加粗”是什么意思',
  'write an article about autumn',
  '正文：\n加粗',
])('does not treat discussion or source text as a command: %s', (text) => {
  expect(parseDirectDocumentIntent(text)).toBeNull();
});
it.each(['把全文加粗', '加粗并居中', '整篇排版一下'])(
  'asks for scope instead of silently reducing a broader command: %s',
  (text) => {
    expect(parseDirectDocumentIntent(text)).toEqual({ kind: 'clarify' });
  },
);
