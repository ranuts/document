"""Verify exact schema-bound text and native history on two blank-slide samples."""
import hashlib,json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-ppt-plain-long-text-im.json').read_text())
assert r['status']=='completed' and not r['errors'] and len(r['rows'])==2
assert r['probeSHA256']==hashlib.sha256((root/'probe-ppt-plain-long-text-im.mjs').read_bytes()).hexdigest()
assert r['cases']==json.loads((root/'2026-10-04-ppt-long-text-cases.json').read_text())
for c,x in zip(r['cases'],r['rows']):
 assert x['id']==c['id'] and x['text']==c['text'] and x['setup']['type']==0 and x['setup']['count']==0
 assert not x['before']['shapes'] and x['applied'] and len(x['after']['shapes'])==1
 assert not x['visibleErrors'] and x['previews']==0 and x['boxInside'] and x['contentHeightFits']
 assert x['literalExact'] and x['after']['shapes'][0]['text'].replace('\r\n','\n')==c['text']+'\n'
 assert x['undoExact'] and x['redoExact'] and x['undo']==x['before'] and x['redo']==x['after']
 assert len(x['inputs'])==1 and x['inputs'][0]['modelId']==['Qwen3-1.7B-q4f16_1-MLC']
 q=x['inputs'][0]['request'];assert q['temperature']==0 and q['max_tokens']==512
 schema=json.loads(q['response_format']['schema'])
 operations=schema['anyOf'];assert len(operations)==2
 op=next(o for o in operations if o['properties']['tool']['enum']==['add_slide_text'])
 assert op['properties']['input']['properties']['text']['enum']==[c['text']]
 assert hashlib.sha256(Path(x['screenshotPath']).read_bytes()).hexdigest()==x['screenshotSHA256']
print('Two actual schema-bound literal writes, complete native text and exact Undo/Redo verified; no general model-quality acceptance')
