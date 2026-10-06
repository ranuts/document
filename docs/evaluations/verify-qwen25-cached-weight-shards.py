import hashlib,json,pathlib
root=pathlib.Path(__file__).parent
report=json.loads((root/'2026-10-04-qwen25-cached-weight-shards.json').read_text())
assert report['status']=='matched' and not report['errors']
assert report['probeSHA256']==hashlib.sha256((root/'probe-qwen25-cached-weight-shards.mjs').read_bytes()).hexdigest()
manifest=json.loads((root/'2026-10-04-qwen25-cached-manifests.json').read_text())
from urllib.parse import urljoin
expected={urljoin(a['url'],r['dataPath']):(r['nbytes'],r['md5sum']) for a in manifest['observed']['assets'] if 'tensorCache' in a for r in a['tensorCache']['manifest']['records']}
assert len(expected)==124
actual={a['url']:a for a in report['assets']}
assert len(actual)==len(report['assets']) and actual.keys()==expected.keys()
for url,(size,md5) in expected.items():
 a=actual[url]
 assert a['match'] and a['bytes']==a['expectedBytes']==size and a['md5']==a['expectedMD5']==md5
assert all(a['sameParsedContent'] for a in json.loads((root/'2026-10-04-qwen25-pinned-manifest-structural.json').read_text())['assets'])
print(f'{len(actual)} cached weight shards match pinned-equivalent manifest sizes and MD5; {sum(a["bytes"] for a in actual.values())} bytes read. No runtime or quality certification.')
