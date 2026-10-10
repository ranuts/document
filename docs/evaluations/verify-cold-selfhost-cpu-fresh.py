import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlparse

directory = Path(__file__).resolve().parent
for suffix in ('', '-before'):
    report = json.loads((directory / f'2026-10-04-cold-selfhost-cpu-fresh{suffix}.json').read_text())
    driver = directory / f'probe-cold-selfhost-cpu-fresh{suffix}.mjs'
    assert hashlib.sha256(driver.read_bytes()).hexdigest() == report['probeSHA256']
    if suffix:
        assert not report['passed'] and 'locator.fill' in report['error']
        continue
    assert report['passed'] and not report['errors'] and not report['visibleErrors']
    assert report['initial']['cacheNames'] == []
    assert report['engine'] == 'CPU · qwen2.5-0.5b-instruct-q4_k_m.gguf'
    assert report['reply'] and report['stats']
    assert report['downloadRequestCount'] == len(report['serverRequests']) == 2
    assert [r['method'] for r in report['serverRequests']] == ['HEAD', 'GET']
    assert len(report['requests']) == 95
    prefix = report['marker'].split('_中文')[0]
    for request in report['requests']:
        assert request['method'] in ('GET', 'HEAD') and request['body'] is None
        assert prefix not in unquote(json.dumps(request, ensure_ascii=False))
    for request in report['serverRequests']:
        assert request['url'] == '/qwen2.5-0.5b-instruct-q4_k_m.gguf'
        assert request['body'] == '' and prefix not in json.dumps(request)
    plugin = Path(urlparse(report['currentPlugin']).path).name
    assert (directory.parents[1] / 'dist/assets' / plugin).is_file()
print('PASS: fresh-context self-hosted download and observed request-content boundary')
