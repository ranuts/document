"""Verify synthetic SDK abort-message reproduction, not real payload attribution."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-wllama-abort-message.json').read_text())
assert r['status'] == 'reproduced' and len(r['rows']) == 2
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-wllama-abort-message.mjs').read_bytes()).hexdigest()
for x in r['rows']:
    sdk = root.parent.parent / 'packages/agent-core/node_modules/@wllama/wllama/esm' / x['entry']
    assert x['sdkSHA256'] == hashlib.sha256(sdk.read_bytes()).hexdigest()
    assert x['failure']['name'] == 'TypeError' and 'replace is not a function' in x['failure']['message']
for kind in ['offline', 'controlled-wasm']:
    report = json.loads((root / f'2026-10-04-cpu-{kind}-error-stack.json').read_text())
    assert report['status'] == 'completed' and not report['errors']
    driver = root / f'probe-cpu-{kind}-error-stack.mjs'
    assert report['probeSHA256'] == hashlib.sha256(driver.read_bytes()).hexdigest()
    assert report['rows'][0]['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
print('Non-string SDK abort handler TypeError reproduced in both entries; later browser attempts did not reproduce failure.')
