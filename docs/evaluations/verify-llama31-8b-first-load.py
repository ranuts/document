import hashlib
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/'2026-10-04-llama31-8b-seven-language-writing.json').read_text())
assert r['status']=='failed' and r['results']==[] and not r['errors'] and r['bundleBytesUnchanged']
assert r['engine']=='CPU · Qwen_Qwen3-0.6B-Q4_K_M.gguf'
assert r['probeSHA256']==hashlib.sha256((root/'probe-llama31-8b-seven-language-writing.mjs').read_bytes()).hexdigest()
assert len(r['workerFailures'])==1
assert r['workerFailures'][0]['content']=='Error: Failed to store https://huggingface.co/mlc-ai/Llama-3.1-8B-Instruct-q4f16_1-MLC/resolve/main/params_shard_40.bin with error: TypeError: Failed to fetch'
print('Terminal Llama 8B shard fetch/storage failure and CPU fallback verified; zero writing results')
