import hashlib,json
from pathlib import Path
p=Path(__file__).parent
r=json.loads((p/'2026-10-04-cpu-system-prompt-context-diagnostic.json').read_text())
assert r['status']=='completed' and not r['errors'] and len(r['rows'])==1
assert r['probeSHA256']==hashlib.sha256((p/'probe-cpu-system-prompt-context-diagnostic.mjs').read_bytes()).hexdigest()
x=r['rows'][0]
assert x['systemPromptCharacters']==1900 and x['systemPromptUtf8Bytes']==5700
assert x['engine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert len(x['errors'])==1 and 'request is too long' in x['errors'][0]
assert not x['replies'] and not x['stats'] and not x['previews']
assert x['before']==x['after']==x['undo']==x['redo']
assert any(s.endswith('/assets/'+r['currentPlugin']) for s in r['seedResources'])
print('Valid-length system prompt + short user request exceeds real CPU context; native source preserved')
