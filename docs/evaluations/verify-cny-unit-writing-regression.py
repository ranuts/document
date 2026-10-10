"""Validate captured native mechanics; semantic assessment remains manual."""
import json
import hashlib
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-cny-unit-writing-regression.json').read_text())
cases=json.loads((p/'2026-10-04-native-language-writing-cases.json').read_text())
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases']==cases and len(cases)==len(r['results'])==8
assert r['probeSHA256']==hashlib.sha256((p/'probe-cny-unit-writing-regression.mjs').read_bytes()).hexdigest()
assert r['engine']=='WebGPU · Qwen3-1.7B-q4f16_1-MLC'
for c,x in zip(cases,r['results']):
 assert all(x[k]==v for k,v in c.items())
 assert x['variant']=='current' and x['selected']==c['source']+'\r\n'
 assert x['isolated'] and x['previewCount']==0 and len(x['inputs'])==len(x['raw'])==1
 assert x['inputs'][0]['modelId']==[r['modelId']]
 q=x['inputs'][0]['request']
 assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema'] and q['extra_body']['enable_thinking'] is False
 d=json.loads(q['messages'][-1]['content'].split('\n')[-1])
 assert d==dict(task=c['task'],targetLanguage='source',text=x['selected'].replace('\r\n','\n'),instruction=c['instruction'])
 if x['documentUnchanged']:assert x['errors'] and x['output']==x['selected']
 else:assert not x['errors'] and x['undoExact'] and x['redoExact'] and x['undoText']==x['selected'] and x['redoText']==x['output']
assert sum(not x['documentUnchanged'] for x in r['results'])==6
print('Eight known regression inputs: six native edits and two refusals; mechanics verified, not quality acceptance')

old=json.loads((p/'2026-10-04-native-language-writing-current.json').read_text())
for previous,current in zip(old['results'],r['results']):
 assert previous['inputs']==current['inputs'] and previous['raw'][0]['text']==current['raw'][0]['text']
 if current['id']!='approval-granted': assert previous['documentUnchanged']==current['documentUnchanged']
assert old['results'][0]['documentUnchanged'] and not r['results'][0]['documentUnchanged']
