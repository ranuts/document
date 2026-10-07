"""Validate native pinned GPU writing mechanics separately from language judgments."""
import argparse
import hashlib
import json
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--partial',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent
workspace=root.parents[1]
prefix='2026-10-07-qwen25-7b-gpu-native'
fixtures=json.loads((root/'2026-10-07-qwen3-instruct2507-seven-language-cases.json').read_text())
artifact=json.loads((root/'2026-10-07-qwen25-7b-gpu-artifact.json').read_text())
if args.partial:
 initial=json.loads((workspace/'.scratch'/(prefix+'-initial-bindings.json')).read_text())
 for name,digest in initial['sha256'].items():assert hashlib.sha256((workspace/name).read_bytes()).hexdigest()==digest,name
 report=json.loads((workspace/'.scratch'/(prefix+'.json')).read_text())
 assert 0<len(report['cases'])<=21
else:
 bindings=json.loads((root/(prefix+'-bindings.json')).read_text())
 for name,digest in bindings['evidenceSHA256'].items():assert hashlib.sha256((root/name).read_bytes()).hexdigest()==digest,name
 assert bindings['processExitCode']==0
 report=json.loads((root/(prefix+'.json')).read_text())
 assert report['finished'] and report['contextClosed'] and not report.get('error')
 assert len(report['cases'])==21 and report['libraryResponses']>0
assert report['artifact']==artifact
for fixture,row in zip(fixtures,report['cases']):
 assert row['prompt']==fixture and row['finished'] and row['pageClosed'] and not row.get('error')
 assert not row['errors'] and not row['crashed'] and row['previewCount']==0
 assert any(s.endswith('/assets/editor-a29E5U4S.js') for s in row['scripts'])
 assert row['adapter']['vendor']=='apple' and not row['adapter']['isFallbackAdapter']
 assert row['loads'][0]['finished'] and row['loads'][0]['vendor']=='apple'
 assert row['loads'][0]['args'][0]=='Qwen2.5-7B-Instruct-q4f16_1-MLC'
 assert row['selected']==row['documentBefore']==fixture['source']+'\r\n'
 assert len(row['sdk'])==1
 probe=row['sdk'][0];assert not probe.get('error')
 request=probe['request'];assert request['temperature']==0 and request['top_p']==.8 and request['max_tokens']==512
 assert request['messages'][0]=={'role':'system','content':'Return only JSON matching the supplied schema. Follow the bounded task instructions. /no_think'}
 assert len(request['messages'])==2 and request['messages'][1]['role']=='user'
 task=json.loads(request['messages'][1]['content'].splitlines()[-1])
 assert task=={'task':fixture['task'],'targetLanguage':fixture['targetLanguage'],'text':fixture['source']+'\n','instruction':fixture['instruction']}
 assert request['response_format']['type']=='json_object'
 assert probe['completion']['model']=='Qwen2.5-7B-Instruct-q4f16_1-MLC'
 if row['documentUnchanged']:
  assert row['documentAfter']==row['documentBefore']
 else:
  assert not row['chatErrors'] and row['afterUndo']==row['documentBefore'] and row['afterRedo']==row['documentAfter']
  body=json.loads(probe['completion']['choices'][0]['message']['content'])['text']
  assert row['documentAfter'].replace('\r\n','\n')==body.replace('\r\n','\n').rstrip('\n')+'\n'
print(('PARTIAL ONLY' if args.partial else 'Completed native mechanics')+f": {len(report['cases'])}/21 rows; no semantic or full device acceptance.")
