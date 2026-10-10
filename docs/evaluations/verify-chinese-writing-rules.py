import copy
import hashlib
import json
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-chinese-writing-rules.json').read_text())
cases=[c for c in json.loads((p/'2026-10-04-native-language-writing-cases.json').read_text()) if c['language']=='zh-CN']
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases']==cases and len(r['results'])==10
assert r['probeSHA256']==hashlib.sha256((p/'probe-chinese-writing-rules.mjs').read_bytes()).hexdigest()
assert r['engine']=='WebGPU · Qwen3-1.7B-q4f16_1-MLC'
for c in cases:
 pair=[x for x in r['results'] if x['id']==c['id']]
 assert [x['variant'] for x in pair]==['current','zh-rules']
 for x in pair:
  assert all(x[k]==v for k,v in c.items())
  assert x['selected']==c['source']+'\r\n' and x['isolated'] and x['previewCount']==0
  assert len(x['raw'])==len(x['inputs'])==1 and x['inputs'][0]['modelId']==[r['modelId']]
  q=x['inputs'][0]['request']
  assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema'] and q['extra_body']['enable_thinking'] is False
  d=json.loads(q['messages'][-1]['content'].split('\n')[-1])
  assert d==dict(task=c['task'],targetLanguage='source',text=x['selected'].replace('\r\n','\n'),instruction=c['instruction'])
  if x['documentUnchanged']:assert x['errors'] and x['output']==x['selected']
  else:assert not x['errors'] and x['undoExact'] and x['redoExact'] and x['undoText']==x['selected'] and x['redoText']==x['output']
 a,b=[copy.deepcopy(x['inputs'][0]) for x in pair]
 ua=a['request']['messages'][-1].pop('content');ub=b['request']['messages'][-1].pop('content')
 assert a==b and ua!=ub and ua.split('\n')[-1]==ub.split('\n')[-1]
 assert '你是多语言写作助手。' in ub and '本次仅返回含一个 text 字段的 JSON 对象' in ub
print('Ten paired requests: only user instructions differ, JSON data/native mechanics preserved; not semantic acceptance')
