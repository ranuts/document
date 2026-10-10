"""Verify actual browser replay of the unchanged translation guard."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).parent
r = json.loads((root / '2026-10-04-translation-unchanged-guard.json').read_text())
assert r['status'] == 'completed' and not r['errors'] and r['bundleBytesUnchanged']
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-translation-unchanged-guard.mjs').read_bytes()).hexdigest()
assert r['engine'] == 'WebGPU · Llama-3.2-1B-Instruct-q4f16_1-MLC'
assert [x['id'] for x in r['results']] == ['translate-ja', 'translate-de']
for x in r['results']:
    assert x['documentUnchanged'] and x['output'] == x['selected']
    assert x['isolated'] and x['previewCount'] == 0
    assert x['errors'] == ['The model returned the original text. Try a clearer instruction or another model.Restore request']
    assert len(x['raw']) == len(x['inputs']) == 1
    assert x['raw'][0]['stopReason'] == 'stop'
    assert json.loads(x['raw'][0]['text'])['text'].strip() == x['source']
    q = x['inputs'][0]['request']
    assert x['inputs'][0]['modelId'] == [r['modelId']]
    assert q['temperature'] == 0 and q['max_tokens'] == 512 and q['response_format']['schema']
    data = json.loads(q['messages'][-1]['content'].split('\n')[-1])
    assert data['targetLanguage'] == x['language'] and data['text'] == x['selected'].replace('\r\n', '\n')
print('Two real Llama unchanged translations refused with native source preserved and existing localized guidance')
