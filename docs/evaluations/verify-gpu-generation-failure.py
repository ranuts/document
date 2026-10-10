"""Verify bounded failure recovery evidence, not physical GPU resource behavior."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-gpu-generation-failure.json').read_text())
assert r['status'] == 'passed' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-gpu-generation-failure.mjs').read_bytes()).hexdigest()
assert 'WebGPU' in r['engine'] and 'Qwen3-1.7B' in r['engine']
assert r['workerSHA256'] != r['injectedWorkerSHA256']
before = r['beforeFailure']
assert before['constructed'] == 1 and before['terminated'] == before['cpu'] == 0
assert before['requests'] == ['chatCompletionStreamInit']
for key in ('afterFailure', 'afterWait'):
    state = r[key]
    assert state['constructed'] == 1 and state['terminated'] >= 1 and state['cpu'] == 0
    assert state['requests'] == before['requests']
assert len(r['visibleErrors']) == 1 and 'Controlled generation' not in r['visibleErrors'][0]
assert r['before'] == r['after'] == r['retryDocument']
assert 'hello' in r['reply'].lower()
assert r['afterRetry']['constructed'] == 2 and r['afterRetry']['cpu'] == 0
assert r['afterRetry']['requests'] == ['chatCompletionStreamInit'] * 2
gpu_events = [e['event'] for e in r['workerEvents'] if 'webllm.worker' in e['url']]
assert gpu_events == ['created', 'closed', 'created']
print('Actual GPU stream failure terminates Worker, preserves Word, avoids CPU replay and allows explicit fresh GPU retry')
