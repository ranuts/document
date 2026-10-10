import json
from pathlib import Path
p = Path(__file__).parent
package = json.loads((p / '2026-10-04-cpu-count-dual-package.json').read_text())
for filename, variant in [('cpu-default-count-multithread', 'default'), ('cpu-default-provider-stop-cache-reload', 'default'), ('cpu-dual-client-compat-count', 'compat')]:
    r = json.loads((p / f'2026-10-04-{filename}.json').read_text())
    assert r['status'] == 'completed' and not r['errors']
    assert r['clientSHA256'] == package['entries']['client/index.js']
    for ext in ['js', 'wasm']:
        assert r['files'][ext] == package['entries'][f'native/{variant}/wllama.{ext}']
print('One client and both packaged native pairs match terminal browser evidence')
