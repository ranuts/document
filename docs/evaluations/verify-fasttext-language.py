"""Validate classifier evidence without asserting semantic or deployment readiness."""
import hashlib
import json
from pathlib import Path

root=Path(__file__).parent
native_path=root/'2026-10-04-fasttext-language-native.json'
n=json.loads(native_path.read_text())
b=json.loads((root/'2026-10-04-fasttext-language-browser.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert n['driverSHA256']==sha(root/'probe-fasttext-language-native.py')
assert b['driverSHA256']==sha(root/'probe-fasttext-language-browser.mjs')
assert b['bindingSHA256']==sha(root/'fasttext-language-probe.cc')
assert b['nativeReportSHA256']==sha(native_path)
assert n['modelSHA256']==b['artifacts']['lid.176.ftz']['sha256']=='8f3472cfe8738a7b6099e8e999c3cbfae0dcd15696aac7d7738a8039db603e83'
assert n['modelBytes']==b['artifacts']['lid.176.ftz']['bytes']==938013
assert n['sourceRevision']=='5b5943c118b0ec5fb9cd8d20587de2b2d3966dfe' and n['adopted'] is False
assert len(n['pairs'])==24 and len(n['controls'])==13
expected=[pred for p in n['pairs'] for pred in (p['sourcePredictions'],p['outputPredictions'])]+[c['predictions'] for c in n['controls']]
assert len(expected)==len(b['result']['predictions'])==61
assert len(n['rawStdout'].splitlines())==61
for native,wasm in zip(expected,b['result']['predictions']):
    assert len(native)==len(wasm)==3
    assert all(x['language']==y['language'] and abs(x['score']-y['score'])<1e-5 for x,y in zip(native,wasm))
assert b['passed'] and b['nativeParity'] and b['offline']
assert not b['requestsAfterOffline'] and not b['errors']
assert all(url.startswith('http://127.0.0.1:5193/language-probe/') for url in b['requests'])
assert {c['id'] for c in n['controls'] if '\n' in c['text']}=={'multiline-en','multiline-zh'}
assert b['ready']['linearMemoryBytes'] is None and b['result']['linearMemoryBytes'] is None
for sweep in n['thresholdSweep']:
    threshold=sweep['confidence']
    rejected=[p['id'] for p in n['pairs'] if p['sourcePredictions'][0]['language']!=p['outputPredictions'][0]['language'] and min(p['sourcePredictions'][0]['score'],p['outputPredictions'][0]['score'])>=threshold]
    assert sweep['rejected']==rejected
    assert sweep['falseRejections']==[p['id'] for p in n['pairs'] if p['id'] in rejected and not p['reject']]
    assert sweep['missedMismatches']==[p['id'] for p in n['pairs'] if p['id'] not in rejected and p['reject']]
assert next(x for x in n['thresholdSweep'] if x['confidence']==.8)['falseRejections']==['zh-quoted-english']
print('61 actual native/Worker classifier predictions, parity, warm offline run, bindings and declared threshold sweep verified')
