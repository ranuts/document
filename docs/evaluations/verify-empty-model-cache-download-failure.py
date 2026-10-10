import hashlib,json
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-empty-model-cache-download-failure.json').read_text())
assert r['status']=='completed' and not r['errors']
assert r['probeSHA256']==hashlib.sha256((p/'probe-empty-model-cache-download-failure.mjs').read_bytes()).hexdigest()
assert r['first']['provider']=='webllm' and r['first']['loadEnabled']
assert 'Model loading failed' in r['first']['note'] and len(r['retry']['errors'])==2
assert r['retry']['newRequests']>0 and r['external']
assert all(x['method']=='HEAD' and x['bodyBytes']==0 and x['url'].startswith('https://huggingface.co/bartowski/Qwen_Qwen3-0.6B-GGUF/resolve/') and x['url'].endswith('.gguf') for x in r['external'])
print('Fresh model-cache download failure and manual retry verified; only static model HEAD requests observed')
