import hashlib
import json
from pathlib import Path
base = Path(__file__).parent
r = json.loads((base / '2026-10-05-native-pwa-install.json').read_text())
assert r['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-install.mjs').read_bytes()).hexdigest()
assert r['status'] == 'completed' and not r['errors']
assert r['install'] == {} and r['displaySetting'] == {}
assert isinstance(r['osState']['badgeCount'], int)
assert r['launch']['targetId'] and r['offlineLaunch']['targetId']
assert r['seedContextClosed'] and r['contextClosed'] and r['uninstalled']
assert any(s['phase'] == 'launch' and s['state'].get('standalone') for s in r['steps'])
assert any(s['url'] == 'http://127.0.0.1:5193/' and s['state'].get('standalone') and s['state']['online'] is False and s['state'].get('controller') for s in r['offlinePages'])
assert any(s['url'] == 'http://127.0.0.1:5193/' and s['status'] == 200 and s['fromServiceWorker'] for s in r['offlineResponses'])
before = json.loads((base / '2026-10-05-native-pwa-install-before.json').read_text())
assert before['probeSHA256'] == hashlib.sha256((base / 'probe-native-pwa-install-before.mjs').read_bytes()).hexdigest()
assert not any(s.get('state', {}).get('standalone') for s in before['steps'])
assert before['uninstalled'] and before['contextClosed']
print('Native installation, standalone simulated-offline restart, provenance and cleanup verified; physical offline/model acceptance remains open.')
