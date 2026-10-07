"""Check pinned GPU diagnostic receipts; never certify writing semantics."""
import argparse
import hashlib
import json
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--partial',action='store_true')
a=p.parse_args()
root=Path(__file__).resolve().parent
workspace=root.parents[1]
prefix='2026-10-07-qwen25-7b-gpu'
artifact=json.loads((root/(prefix+'-artifact.json')).read_text())
requests=json.loads((root/(prefix+'-requests.json')).read_text())
fixtures=json.loads((root/'2026-10-07-qwen3-instruct2507-seven-language-cases.json').read_text())
fixtures=[f for f in fixtures if f['id'] in ['zh-CN-summarize','ja-translate','de-rewrite','es-rewrite']]
assert [r['id'] for r in requests]==[f['id'] for f in fixtures]
for row,f in zip(requests,fixtures):
 q=row['request'];assert q['temperature']==0 and q['top_p']==.8 and q['max_tokens']==512
 assert q['messages'][0]=={'role':'system','content':'Return only JSON matching the supplied schema. Follow the bounded task instructions. /no_think'}
 assert len(q['messages'])==2 and q['messages'][1]['role']=='user'
 task=json.loads(q['messages'][1]['content'].splitlines()[-1])
 assert task=={'task':f['task'],'targetLanguage':f['targetLanguage'],'text':f['source']+'\n','instruction':f['instruction']}
 assert q['response_format']['type']=='json_object'
 assert json.loads(q['response_format']['schema'])=={'type':'object','additionalProperties':False,'required':['text'],'properties':{'text':{'type':'string'}}}
if a.partial:
 initial=json.loads((workspace/'.scratch'/(prefix+'-initial-bindings.json')).read_text())
 for name,digest in initial['sha256'].items():assert hashlib.sha256((workspace/name).read_bytes()).hexdigest()==digest,name
 report=json.loads((workspace/'.scratch'/(prefix+'-screen.json')).read_text())
else:
 binding=json.loads((root/(prefix+'-bindings.json')).read_text())
 for name,digest in binding['evidenceSHA256'].items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
 assert binding['processExitCode']==0
 report=json.loads((root/(prefix+'-screen.json')).read_text())
 assert report['finished'] and report['contextClosed'] and not report.get('error') and not report['errors']
 assert len(report['outputs'])==4
assert report['artifact']==artifact and report['requests']==requests
assert len(report['outputs'])<=4
if report.get('loaded'):
 assert report['modelRecord']['model']==artifact['modelURL']
 assert report['modelRecord']['model_lib']==artifact['library']['url']
 assert report['adapter']['vendor']=='apple' and not report['adapter']['isFallbackAdapter']
 assert report['libraryResponses']>0
for observed,expected in zip(report['outputs'],requests):
 assert report['loaded'] and observed['id']==expected['id'] and observed['request']==expected['request']
 assert not observed['error'] and observed['completion']['choices']
print(('PARTIAL ONLY' if a.partial else 'Completed SDK receipt mechanics')+f": {len(report['outputs'])}/4 outputs; no semantic or native-document acceptance.")
