"""Reference two already-built immutable artifacts from before/after the product fix."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path('/private/tmp/document-two-build-prefetch-migration')
assert not root.exists(), 'Never overwrite an existing migration lab'
sources = {'baseline': Path('/private/tmp/document-two-build-csp'),
           'candidate': Path('/private/tmp/document-two-build-prefetch-fix')}
manifest = {'sourceCommit': None, 'root': str(root), 'sourceCommits': {},
            'artifactOriginRoots': {k: str(v) for k, v in sources.items()},
            'scope': 'Before/after source revisions; references to two genuine previously built artifacts; shared dependencies; no artifact rewriting or deployed delivery proof'}
for variant, source in sources.items():
    recorded = json.loads((source / 'build-manifest.json').read_text())
    directory = source / variant
    build = recorded[variant].copy()
    digest = hashlib.sha256(subprocess.check_output([
        'sh', '-c', 'find sdkjs web-apps fonts -type f -exec shasum -a 256 {} + | LC_ALL=C sort'
    ], cwd=directory)).hexdigest()
    assert digest == build['fullVendorDigest'] and digest[:12] == build['vendor']
    for filename, field in [('sw.js', 'swSha256'), ('_headers', 'headersSha256')]:
        assert hashlib.sha256((directory / filename).read_bytes()).hexdigest() == build[field]
    for entry in build['entries']:
        assert hashlib.sha256((directory / entry['path']).read_bytes()).hexdigest() == entry['sha256']
    prefetch = (directory / 'landing-prefetch.js').read_bytes()
    commit = recorded['sourceCommit']
    assert prefetch == subprocess.check_output(['git', 'show', commit + ':public/landing-prefetch.js'])
    build['prefetchSha256'] = hashlib.sha256(prefetch).hexdigest()
    manifest['sourceCommits'][variant] = commit
    manifest[variant] = build
assert manifest['sourceCommits']['baseline'].startswith('75b6551')
assert manifest['sourceCommits']['candidate'].startswith('87cf58f')
assert manifest['baseline']['prefetchSha256'] != manifest['candidate']['prefetchSha256']
assert manifest['baseline']['core'] != manifest['candidate']['core']
assert manifest['baseline']['vendor'] != manifest['candidate']['vendor']
root.mkdir()
for variant, source in sources.items():
    (root / variant).symlink_to(source / variant, target_is_directory=True)
(root / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'root': str(root), 'sourceCommits': manifest['sourceCommits']}))
