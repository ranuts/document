"""Check real seven-language task controls/mechanics, not writing semantics."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-gemma3-1b-sliding-window-writing.json').read_text())
cases=json.loads((root/'2026-10-04-seven-language-writing-cases.json').read_text())
assert r['status']=='failed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256']==hashlib.sha256((root/'probe-gemma3-1b-sliding-window-writing.mjs').read_bytes()).hexdigest()
assert r['cases']==cases and len(cases)==21 and len(r['results'])==15 and r['variants']==['current'] and r['repetitions']==1
assert r['modelId']=='gemma3-1b-it-q4f16_1-MLC'
assert {(c['language'],c['task']) for c in cases}=={(l,t) for l in ('zh-CN','en','ja','ko','de','es','pt') for t in ('summarize','rewrite','translate')}
assert {x['id'] for x in r['results']}=={c['id'] for c in cases[:15]}
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
  if not x['errors']:
   assert x['task']=='translate' and x['language'] in ('ja','de')
 else:
  assert not x['errors'] and x['undoExact'] and x['redoExact']
  assert x['undoText']==x['selected'] and x['redoText']==x['output']
assert sum(x['documentUnchanged'] for x in r['results'])==11
assert sum(bool(x['errors']) for x in r['results'])==11
assert all(x['method']=='GET' and x['bodyBytes']==0 for x in r['externalRequests'])
assert r['error']=='Error: Missing native inference'
assert r['engine']=='WebGPU · gemma3-1b-it-q4f16_1-MLC' and not r['workerFailures']
for x in r['results']:
 assert x['inputs'][0]['chatOpts']==[{'context_window_size':-1,'sliding_window_size':512,'attention_sink_size':0}]
print('15 completed Gemma diagnostic cases: four edits, 11 refusals; partial run only, no semantic certification')
