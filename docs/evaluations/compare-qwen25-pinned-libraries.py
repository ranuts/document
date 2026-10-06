"""Read public pinned compiled libraries; no document data or model inference."""
import hashlib,json,pathlib,urllib.request
root=pathlib.Path(__file__).parent
cache=json.loads((root/'2026-10-04-qwen25-cached-metadata.json').read_text())
repository='mlc-ai/binary-mlc-llm-libs'
headers={'User-Agent':'document-local-model-diagnostic','Accept':'application/vnd.github+json'}
with urllib.request.urlopen(urllib.request.Request(f'https://api.github.com/repos/{repository}/commits/main',headers=headers),timeout=30) as response:
 revision=json.load(response)['sha']
report={'scope':'Public pinned upstream compiled-library SHA256 compared to saved owned-profile bytes; no inference or document upload.','repository':repository,'revision':revision,'probeSHA256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'assets':[]}
for asset in cache['observed']['assets']:
 if not asset['url'].endswith('.wasm'):continue
 path=asset['url'].split('/main/',1)[1]
 url=f'https://raw.githubusercontent.com/{repository}/{revision}/{path}'
 digest=hashlib.sha256();size=0
 with urllib.request.urlopen(url,timeout=30) as response:
  while chunk:=response.read(1024*1024):digest.update(chunk);size+=len(chunk)
 sha=digest.hexdigest()
 report['assets'].append({'cachedURL':asset['url'],'pinnedURL':url,'bytes':size,'sha256':sha,'cachedBytes':asset['bytes'],'cachedSHA256':asset['sha256'],'match':size==asset['bytes'] and sha==asset['sha256']})
report['status']='matched' if len(report['assets'])==2 and all(a['match'] for a in report['assets']) else 'mismatch'
(root/'2026-10-04-qwen25-pinned-libraries.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
