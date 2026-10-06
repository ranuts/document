import copy
import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-writing-json-format-consistency.json').read_text())
cases=[x for x in json.loads((root/'2026-10-04-seven-language-writing-cases.json').read_text()) if x['task']!='translate' and x['language']!='en']
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases']==cases and len(r['results'])==24
assert r['probeSHA256']==hashlib.sha256((root/'probe-writing-json-format-consistency.mjs').read_bytes()).hexdigest()
assert r['engine']=='WebGPU · Qwen3-1.7B-q4f16_1-MLC'
for c in cases:
    pair=[x for x in r['results'] if x['id']==c['id']]
    assert [x['variant'] for x in pair]==['current','consistent-json']
    for x in pair:
        assert all(x[k]==c[k] for k in c)
        assert x['selected']==c['source']+'\r\n' and x['isolated'] and x['previewCount']==0
        assert len(x['raw'])==len(x['inputs'])==1
        assert x['inputs'][0]['modelId']==[r['modelId']]
        q=x['inputs'][0]['request']
        assert q['temperature']==0 and q['max_tokens']==512 and q['response_format']['schema']
        assert q['extra_body']['enable_thinking'] is False
        data=json.loads(q['messages'][-1]['content'].split('\n')[-1])
        assert data['text']==x['selected'].replace('\r\n','\n') and data['targetLanguage']=='source'
        if x['documentUnchanged']: assert x['errors'] and x['output']==x['selected']
        else: assert not x['errors'] and x['undoExact'] and x['redoExact'] and x['undoText']==x['selected'] and x['redoText']==x['output']
    baseline,candidate=[copy.deepcopy(x['inputs'][0]) for x in pair]
    oldRule='Return only the requested text, without commentary, reasoning, Markdown fences or claims of editing a document.'
    newRule='Return only a JSON object with one field, text, containing the requested body, without commentary, reasoning, Markdown fences or claims of editing a document.'
    user=candidate['request']['messages'][-1]
    original=baseline['request']['messages'][-1]['content']
    assert original.count(oldRule)==1 and user['content']==original.replace(oldRule,newRule)
    user['content']=user['content'].replace(newRule,oldRule)
    assert candidate==baseline
print('24 paired browser cases: only declared output-format sentence differs; native mechanics verified, not semantic quality')
