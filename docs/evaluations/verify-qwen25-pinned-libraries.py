import hashlib,json,pathlib,re
root=pathlib.Path(__file__).parent
report=json.loads((root/'2026-10-04-qwen25-pinned-libraries.json').read_text())
assert report['status']=='matched'
assert re.fullmatch('[0-9a-f]{40}',report['revision'])
assert report['repository']=='mlc-ai/binary-mlc-llm-libs'
assert report['probeSHA256']==hashlib.sha256((root/'compare-qwen25-pinned-libraries.py').read_bytes()).hexdigest()
cache=json.loads((root/'2026-10-04-qwen25-cached-metadata.json').read_text())
expected={a['url']:a for a in cache['observed']['assets'] if a['url'].endswith('.wasm')}
actual={a['cachedURL']:a for a in report['assets']}
assert len(actual)==len(report['assets'])==len(expected)==2 and actual.keys()==expected.keys()
for url,a in actual.items():
 assert a['match'] and a['bytes']==a['cachedBytes']==expected[url]['bytes']
 assert a['sha256']==a['cachedSHA256']==expected[url]['sha256']
 assert a['pinnedURL']==url.replace('/main/','/'+report['revision']+'/')
print('Both cached Qwen2.5 3B compiled libraries match fixed upstream bytes; no inference correctness claim.')
