"""Check captured loading failure; no Gemma writing quality claim."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).parent
for stem, probe in [('gemma3-1b-seven-language-writing', 'probe-gemma3-1b-seven-language-writing.mjs'), ('gemma3-1b-load-diagnostic', 'probe-gemma3-1b-load-diagnostic.mjs')]:
    r = json.loads((root / ('2026-10-04-' + stem + '.json')).read_text())
    assert r['status'] == 'failed' and r['results'] == [] and r['bundleBytesUnchanged']
    assert r['probeSHA256'] == hashlib.sha256((root / probe).read_bytes()).hexdigest()
    assert r['modelId'] == 'gemma3-1b-it-q4f16_1-MLC'
    assert r['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
    assert r['error'] == 'Error: Unexpected model: ' + r['engine']
r = json.loads((root / '2026-10-04-gemma3-1b-load-diagnostic.json').read_text())
assert len(r['workerFailures']) == 1
error = r['workerFailures'][0]
assert error['kind'] == 'throw'
assert error['content'].startswith('WindowSizeConfigurationError: Only one of context_window_size and sliding_window_size can be positive. Got: context_window_size: 4096, sliding_window_size: 512')
print('Gemma loading conflict and CPU fallback verified; zero Gemma writing cases executed')

r = json.loads((root / '2026-10-04-gemma3-1b-window-override-writing.json').read_text())
assert r['status'] == 'failed' and r['results'] == [] and r['bundleBytesUnchanged']
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-gemma3-1b-window-override-writing.mjs').read_bytes()).hexdigest()
assert r['engine'] == 'CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert len(r['workerFailures']) == 1
assert r['workerFailures'][0]['content'] == 'AttentionSinkSizeError: Need to specify non-negative attention_sink_size if using sliding window. Consider modifying ModelRecord.overrides. Use `attention_sink_size=0` for default sliding window.'
print('Window-only diagnostic advances to missing attention sink configuration; no Gemma writing claim')
