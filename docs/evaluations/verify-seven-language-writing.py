"""Check real seven-language task controls/mechanics, not writing semantics."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-seven-language-writing-current.json').read_text())
cases=json.loads((root/'2026-10-04-seven-language-writing-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256']==hashlib.sha256((root/'probe-gpu-seven-language-writing.mjs').read_bytes()).hexdigest()
assert r['cases']==cases and len(cases)==len(r['results'])==21 and r['variants']==['current'] and r['repetitions']==1
assert r['modelId']=='Qwen3-1.7B-q4f16_1-MLC'
assert {(c['language'],c['task']) for c in cases}=={(l,t) for l in ('zh-CN','en','ja','ko','de','es','pt') for t in ('summarize','rewrite','translate')}
assert {x['id'] for x in r['results']}=={c['id'] for c in cases}
for x in r['results']:
 c=next(c for c in cases if c['id']==x['id'])
 assert x['source']==c['source'] and x['instruction']==c['instruction'] and x['rubric']==c['rubric']
 assert x['selected'].removesuffix('\r\n')==c['source']
 assert len(x['inputs'])==len(x['raw'])==1 and x['isolated'] and x['previewCount']==0
 assert x['inputs'][0]['modelId']==[r['modelId']]
 q=x['inputs'][0]['request']
 assert q['temperature']==0 and q['max_tokens']==512 and q['extra_body']['enable_thinking'] is False and q['response_format']['schema']
 data=json.loads(q['messages'][-1]['content'].split('\n')[-1])
 assert data['task']==c['task'] and data['text']==x['selected'].replace('\r\n','\n') and data['instruction']==c['instruction']
 assert data['targetLanguage']==(c['targetLanguage'] if c['task']=='translate' else 'source')
 assert x['raw'][0]['stopReason']=='stop'
 if x['documentUnchanged']:
  assert x['errors'] and x['output']==x['selected']
 else:
  assert not x['errors'] and x['undoExact'] and x['redoExact']
  assert x['undoText']==x['selected'] and x['redoText']==x['output']
assert sum(x['documentUnchanged'] for x in r['results'])==9
assert not r['externalRequests']
print('21 native writing tasks, all seven actual translation targets, 12 exact Undo/Redo edits and nine preserved refusals verified')
