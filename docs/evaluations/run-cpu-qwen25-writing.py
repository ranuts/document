from pathlib import Path
import subprocess, os, hashlib

# Run from the repository root against its existing preview server on port 5193.
# This changes only generated assets and restores their exact bytes in finally.
paths=list(Path('dist/assets').glob('agent-plugin-*.js'))
assert len(paths)==1, 'Build must contain exactly one agent-plugin bundle'
p=paths[0]
original=p.read_bytes()
body=original.decode()
marker='if(n.throwIfAborted(),a.toolCalls.length'
assert body.count(marker)==1, 'Response diagnostic boundary changed'
body=body.replace(marker,'(window.__writingRaw??=[]).push({text:a.text,stopReason:a.stopReason,usage:a.usage});'+marker)
print('baselineBundleSha256',hashlib.sha256(original).hexdigest(),flush=True)
try:
    p.write_text(body)
    subprocess.run(['node','docs/evaluations/probe-cpu-qwen25-writing.mjs'],check=True)
finally:
    p.write_bytes(original)
    assert p.read_bytes()==original
