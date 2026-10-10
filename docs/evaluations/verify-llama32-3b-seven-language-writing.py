"""Check real seven-language task controls/mechanics, not writing semantics."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-llama32-3b-seven-language-writing.json').read_text())
cases=json.loads((root/'2026-10-04-seven-language-writing-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256']==hashlib.sha256((root/'probe-llama32-3b-seven-language-writing.mjs').read_bytes()).hexdigest()
assert r['cases']==cases and len(cases)==len(r['results'])==21 and r['variants']==['current'] and r['repetitions']==1
assert r['modelId']=='Llama-3.2-3B-Instruct-q4f16_1-MLC'
assert {(c['language'],c['task']) for c in cases}=={(l,t) for l in ('zh-CN','en','ja','ko','de','es','pt') for t in ('summarize','rewrite','translate')}
assert {x['id'] for x in r['results']}=={c['id'] for c in cases}
for x in r['results']:
 c=next(c for c in cases if c['id']==x['id'])
 assert x['source']==c['source'] and x['instruction']==c['instruction'] and x['rubric']==c['rubric']
 assert x['selected'].removesuffix('\r\n')==c['source']
 assert len(x['inputs'])==len(x['raw'])==1 and x['isolated'] and x['previewCount']==0
 assert x['inputs'][0]['modelId']==[r['modelId']]
 q=x['inputs'][0]['request']
 assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema']
 data=json.loads(q['messages'][-1]['content'].split('\n')[-1])
 assert data['task']==c['task'] and data['text']==x['selected'].replace('\r\n','\n') and data['instruction']==c['instruction']
 assert data['targetLanguage']==(c['targetLanguage'] if c['task']=='translate' else 'source')
 assert x['raw'][0]['stopReason'] in ('stop','length')
 if x['documentUnchanged']:
  assert x['output']==x['selected']
  assert x['errors']
 else:
  assert not x['errors'] and x['undoExact'] and x['redoExact']
  assert x['undoText']==x['selected'] and x['redoText']==x['output']
print('21 Llama 3B tasks: captured requests and native Undo/Redo verified; no semantic acceptance claim')
