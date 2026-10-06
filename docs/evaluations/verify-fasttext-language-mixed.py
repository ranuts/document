"""Verify mixed-content classifier controls; never approve document semantics."""
import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
p=root/'2026-10-04-fasttext-language-mixed.json'
r=json.loads(p.read_text());b=json.loads((root/'2026-10-04-fasttext-language-mixed-browser.json').read_text())
assert not r['adopted'] and len(r['pairs'])==32 and len(r['knownMixedControls'])==8
assert r['priorReportSHA256']==sha(root/'2026-10-04-fasttext-language-native.json')
assert r['driverSHA256']==sha(root/'probe-fasttext-language-mixed.py')
assert b['driverSHA256']==sha(root/'probe-fasttext-language-mixed-browser.mjs')
assert b['nativeReportSHA256']==sha(p) and b['bindingSHA256']==sha(root/'fasttext-language-probe.cc')
assert r['modelSHA256']==b['artifacts']['lid.176.ftz']['sha256']
assert len(r['freshRawStdout'].splitlines())==16
assert all(p['semanticDefect'] is None for p in r['pairs'] if p['id'] not in ('quote-reversed-fact','copied-unsupported-action'))
assert b['passed'] and b['nativeParity'] and b['offline'] and not b['requestsAfterOffline'] and not b['errors']
expected=[pred for p in r['pairs'] for pred in (p['sourcePredictions'],p['outputPredictions'])]
assert len(expected)==len(b['result']['predictions'])==64
for native,wasm in zip(expected,b['result']['predictions']):
 assert len(native)==len(wasm)==3
 assert all(x['language']==y['language'] and abs(x['score']-y['score'])<1e-5 for x,y in zip(native,wasm))
for p in r['pairs']:
 src,out=p['sourcePredictions'][0],p['outputPredictions'][0]
 strong=min(src['score'],out['score'])>=.8
 whole='reject' if strong and src['language']!=out['language'] else 'abstain' if not strong else 'same-label'
 verdict='abstain-retained-span' if p['output'].strip() in p['source'] else whole
 assert p['wholeTextVerdict']==whole and p['candidateVerdict']==verdict
assert r['falseRejections']==['mixed-paraphrase']
assert r['missedMismatches']==['zh-to-danish','short-english-change']
for identity in ('quote-reversed-fact','copied-unsupported-action'):
 p=next(p for p in r['pairs'] if p['id']==identity)
 assert p['semanticDefect'] and not p['languageMismatch'] and p['candidateVerdict'].startswith('abstain')
print('32 mixed language pairs, 64 actual offline initialized Worker inputs, prediction parity and candidate errors verified')
