export type DirectDocumentIntent =
  | { kind: 'write_reply'; requireSelection: boolean }
  | { kind: 'bold'; enabled: boolean }
  | { kind: 'align'; alignment: 'left' | 'center' | 'right' | 'justify' }
  | { kind: 'sort_range'; range: string; column: string; descending: boolean; header: boolean }
  | { kind: 'sum_range'; range: string; target?: string }
  | { kind: 'slide'; action: 'add' | 'duplicate' | 'navigate'; page?: number }
  | { kind: 'clarify' };

/** Closed command grammar. Discussion, quoted data and broader scopes never execute. */
export function parseDirectDocumentIntent(input: string): DirectDocumentIntent | null {
  let text = input.trim().toLowerCase();
  if (
    /[\n\r"“”‘’`?？]/.test(text) ||
    /^(?:怎么|如何|为什么|解释|不要|别|how\b|why\b|what\b|explain\b|do not\b|don't\b)/.test(text)
  )
    return null;
  text = text
    .replace(/^(?:请|麻烦|帮我|please\s+)/, '')
    .replace(/[。.!！]+$/, '')
    .trim();
  const sort =
    /^(?:把|将)?\s*([a-z]{1,3}\d+:[a-z]{1,3}\d+)\s*按\s*([a-z]{1,3})\s*列(升序|降序)排序[，,]?\s*(首行为表头|无表头)$/.exec(
      text,
    );
  const englishSort =
    /^sort ([a-z]{1,3}\d+:[a-z]{1,3}\d+) by ([a-z]{1,3}) (ascending|descending) (with|without) header$/.exec(text);
  if (sort || englishSort) {
    const match = (sort || englishSort)!;
    return {
      kind: 'sort_range',
      range: match[1].toUpperCase(),
      column: match[2].toUpperCase(),
      descending: ['降序', 'descending'].includes(match[3]),
      header: ['首行为表头', 'with'].includes(match[4]),
    };
  }
  const sum =
    /^(?:计算|求)?\s*([a-z]{1,3}\d+:[a-z]{1,3}\d+)\s*的?(?:总和|求和|累加)$/.exec(text) ||
    /^sum ([a-z]{1,3}\d+:[a-z]{1,3}\d+)$/.exec(text);
  if (sum) return { kind: 'sum_range', range: sum[1].toUpperCase() };
  const sumWrite =
    /^(?:把|将)\s*([a-z]{1,3}\d+:[a-z]{1,3}\d+)\s*的?(?:总和|求和结果)写入\s*([a-z]{1,3}\d+)$/.exec(text) ||
    /^sum ([a-z]{1,3}\d+:[a-z]{1,3}\d+) into ([a-z]{1,3}\d+)$/.exec(text);
  if (sumWrite) return { kind: 'sum_range', range: sumWrite[1].toUpperCase(), target: sumWrite[2].toUpperCase() };
  if (/^(?:新增|添加)(?:一页|一张)?幻灯片$/.test(text) || /^add (?:a |one )?slide$/.test(text))
    return { kind: 'slide', action: 'add' };
  if (/^复制当前幻灯片$/.test(text) || /^duplicate (?:the )?current slide$/.test(text))
    return { kind: 'slide', action: 'duplicate' };
  const slide = /^(?:切换到|跳转到)第\s*(\d+)\s*页幻灯片$/.exec(text) || /^go to slide (\d+)$/.exec(text);
  if (slide) return { kind: 'slide', action: 'navigate', page: Number(slide[1]) };
  if (
    /^(?:(?:把|将)(?:上面的?(?:文章|回答|内容)|上一条(?:回答|内容)))?(?:写入到?|写到|插入到?)(?:当前的?)?文档(?:上|中)?$/.test(
      text,
    ) ||
    /^(?:write|insert) (?:the )?(?:last |previous )?(?:answer|response) (?:in|into|to) (?:the )?(?:current )?document$/.test(
      text,
    )
  )
    return { kind: 'write_reply', requireSelection: false };
  if (
    /^(?:把|将)(?:上一条|上面的?)(?:回答|内容)(?:替换选区|替换选中的?(?:文字|文本|内容))$/.test(text) ||
    /^replace (?:the )?(?:selection|selected text) with (?:the )?(?:last|previous) (?:answer|response)$/.test(text)
  )
    return { kind: 'write_reply', requireSelection: true };
  const bold =
    /^(?:把|将)?(?:选中的?(?:文字|文本|内容)|选区|这段(?:文字|文本|内容)?|当前选区)?(?:设为|设置为)?(取消加粗|加粗)$/.exec(
      text,
    );
  if (bold) return { kind: 'bold', enabled: bold[1] === '加粗' };
  if (
    /^(?:bold (?:the )?(?:selection|selected text)|(?:make |set )?(?:the )?(?:selection|selected text) bold)$/.test(
      text,
    )
  )
    return { kind: 'bold', enabled: true };
  if (
    /^(?:unbold (?:the )?(?:selection|selected text)|remove bold (?:from )?(?:the )?(?:selection|selected text))$/.test(
      text,
    )
  )
    return { kind: 'bold', enabled: false };
  const align = /^(?:把|将)?(?:当前段落|这段|选区|选中的段落)?(?:设置为|设为|改为)?(左对齐|右对齐|居中|两端对齐)$/.exec(
    text,
  );
  if (align)
    return {
      kind: 'align',
      alignment: ({ 左对齐: 'left', 右对齐: 'right', 居中: 'center', 两端对齐: 'justify' } as const)[
        align[1] as '左对齐'
      ],
    };
  const english =
    /^(?:align (?:the )?(?:current paragraph|selection) (left|right|center)|(?:center|justify) (?:the )?(?:current paragraph|selection))$/.exec(
      text,
    );
  if (english)
    return {
      kind: 'align',
      alignment: (english[1] as 'left' | 'right' | 'center') || (text.startsWith('justify') ? 'justify' : 'center'),
    };
  if (
    /排序|求和|累加|幻灯片|\bsort\b|\bsum\b|\bslide\b|加粗|排版|左对齐|右对齐|居中|两端对齐|\bbold\b|\balign\b|\bformat\b/.test(
      text,
    )
  )
    return { kind: 'clarify' };
  return null;
}
