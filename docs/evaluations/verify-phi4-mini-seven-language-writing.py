"""Validate captured native mechanics; semantic assessment remains manual."""
import json
import hashlib
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-phi4-mini-seven-language-writing.json').read_text())
cases=json.loads((p/'2026-10-04-seven-language-writing-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases']==cases and len(cases)==len(r['results'])==21
assert r['probeSHA256']==hashlib.sha256((p/'probe-phi4-mini-seven-language-writing.mjs').read_bytes()).hexdigest()
assert r['engine']=='WebGPU · Phi-4-mini-instruct-q4f16_1-MLC' and r['exactModelId']==r['modelId']=='Phi-4-mini-instruct-q4f16_1-MLC'
for c,x in zip(cases,r['results']):
 assert all(x[k]==v for k,v in c.items())
 assert x['variant']=='current' and x['selected']==c['source']+'\r\n'
 assert x['isolated'] and x['previewCount']==0 and len(x['inputs'])==len(x['raw'])==1
 assert x['inputs'][0]['modelId']==[r['modelId']]
 q=x['inputs'][0]['request']
 assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema']
 assert 'extra_body' not in q
 d=json.loads(q['messages'][-1]['content'].split('\n')[-1])
 assert d==dict(task=c['task'],targetLanguage=c.get('targetLanguage','source'),text=x['selected'].replace('\r\n','\n'),instruction=c['instruction'])
 if x['documentUnchanged']:assert x['errors'] and x['output']==x['selected']
 else:assert not x['errors'] and x['undoExact'] and x['redoExact'] and x['undoText']==x['selected'] and x['redoText']==x['output']
print('21 Phi-4 mini cases: exact model/request identity and native mechanics verified; semantic quality not scored')

assert not r['workerThrows']
