"""Check verbatim placement contrast integrity; no semantic acceptance."""
import argparse
import hashlib
import json
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--partial',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent
workspace=root.parents[1]
prefix='2026-10-07-qwen25-7b-policy-placement'
requests=json.loads((root/(prefix+'-requests.json')).read_text())
native=json.loads((root/'2026-10-07-qwen25-7b-gpu-native.json').read_text())
ids=['zh-CN-summarize','zh-CN-translate','en-translate','ko-rewrite','ko-translate','de-translate']
original=[r for r in native['cases'] if r['prompt']['id'] in ids]
assert len(requests)==12 and len(original)==6
for source,pair in zip(original,[requests[i:i+2] for i in range(0,12,2)]):
 q=source['sdk'][0]['request'];policy,task=q['messages'][1]['content'].rsplit('\n',1)
 for row,variant in zip(pair,['product','policy-system']):
  assert row['id']==source['prompt']['id'] and row['variant']==variant and row['originalRequest']==q
  expected=json.loads(json.dumps(q))
  if variant=='policy-system':expected['messages']=[{'role':'system','content':policy},{'role':'user','content':task}]
  assert row['request']==expected
if args.partial:
 initial=json.loads((workspace/'.scratch'/(prefix+'-initial-bindings.json')).read_text())
 for name,digest in initial['sha256'].items():assert hashlib.sha256((workspace/name).read_bytes()).hexdigest()==digest,name
 report=json.loads((workspace/'.scratch'/(prefix+'-native.json')).read_text())
else:
 binding=json.loads((root/(prefix+'-bindings.json')).read_text())
 for name,digest in binding['evidenceSHA256'].items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
 assert binding['processExitCode']==0
 report=json.loads((root/(prefix+'-native.json')).read_text())
 assert report['finished'] and report['contextClosed'] and not report.get('error') and not report['errors']
 assert len(report['outputs'])==12 and report['libraryResponses']>0
assert report['artifact']==json.loads((root/'2026-10-07-qwen25-7b-gpu-artifact.json').read_text())
assert report['requests']==requests and len(report['outputs'])<=12
if report.get('loaded'):
 assert report['adapter']['vendor']=='apple' and not report['adapter']['isFallbackAdapter']
 assert report['modelRecord']['model']==report['artifact']['modelURL']
 assert report['modelRecord']['model_lib']==report['artifact']['library']['url']
for observed,expected in zip(report['outputs'],requests):
 assert report['loaded'] and not observed['error']
 assert {k:observed[k] for k in ['id','variant','originalRequest','request']}==expected
 assert observed['completion']['model']=='Qwen2.5-7B-Instruct-q4f16_1-MLC'
print(('PARTIAL ONLY' if args.partial else 'Completed contrast mechanics')+f": {len(report['outputs'])}/12 outputs; no native or semantic acceptance.")
