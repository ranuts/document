import copy
import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-writing-source-language-rule.json').read_text())
cases=[x for x in json.loads((root/'2026-10-04-seven-language-writing-cases.json').read_text()) if x['task']!='translate' and x['language']!='en']
assert r['status']=='completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['cases']==cases and len(r['results'])==24
assert r['probeSHA256']==hashlib.sha256((root/'probe-writing-source-language-rule.mjs').read_bytes()).hexdigest()
assert r['engine']=='WebGPU · Qwen3-1.7B-q4f16_1-MLC'
for c in cases:
    pair=[x for x in r['results'] if x['id']==c['id']]
    assert [x['variant'] for x in pair]==['current','source-language-rule']
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
    prefix="For rewrite and summarize, write in the language of the source text field, never the language of the instruction field or these directions. Preserve intentional mixed-language passages, original personal-name spellings and numeric literals.\n"
    user=candidate['request']['messages'][-1]
    assert user['content']==prefix+baseline['request']['messages'][-1]['content']
    user['content']=user['content'][len(prefix):]
    assert candidate==baseline
print('24 paired browser cases: only declared generic source-language prefix differs; native mechanics verified, not semantic quality')
