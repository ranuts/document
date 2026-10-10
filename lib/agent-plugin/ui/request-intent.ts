import type { WritingLanguage } from '@ranuts/agent-core/llm/writing-task';
export interface RequestIntent {
  task: 'chat' | 'tools' | 'rewrite' | 'summarize' | 'translate';
  language: WritingLanguage;
}
/** Conservative routing: questions stay conversational; each message starts fresh. */
export function classifyRequest(input: string): RequestIntent {
  const text = input.trim().replace(/^(?:请帮我|帮我|请|麻烦|please\s+)/i, '');
  let task: RequestIntent['task'] = 'chat';
  if (!/^(?:如何|怎么|为什么|什么|解释|how\b|what\b|why\b|explain\b)/i.test(text)) {
    if (
      /^(?:改写|润色|重写|rewrite\b|polish\b|simplify\b|rephrase\b|shorten\b|paraphrase\b)|^(?:把|将).{0,60}(?:改写|润色|重写|改成|改为|缩短)/i.test(
        text,
      )
    )
      task = 'rewrite';
    else if (/^(?:总结|摘要|概括|summari[sz]e\b)/i.test(text)) task = 'summarize';
    else if (/^(?:翻译|translate\b)|^(?:把|将).{0,60}翻译/i.test(text)) task = 'translate';
    else if (
      /^(?:新增|添加|复制|切换|删除|排序|加粗|对齐|计算|求|设置|读取|整理|调整|修改|插入|将选区|将\s*[A-Z]+\d)|^(?:sort|sum|add|duplicate|set|read|insert|create)\b/i.test(
        text,
      )
    )
      task = 'tools';
  }
  const languages: Array<[RegExp, WritingLanguage]> = [
    [/日语|日文|Japanese/i, 'ja'],
    [/韩语|韩文|Korean/i, 'ko'],
    [/中文|汉语|Chinese/i, 'zh-CN'],
    [/德语|German/i, 'de'],
    [/西班牙语|Spanish/i, 'es'],
    [/葡萄牙语|Portuguese/i, 'pt'],
  ];
  const destination = text.match(/(?:翻译(?:成|为|到)|译成|translate[\s\S]*?\b(?:into|to)\s+)(.*)$/i)?.[1] ?? text;
  return { task, language: languages.find(([pattern]) => pattern.test(destination))?.[1] ?? 'en' };
}
