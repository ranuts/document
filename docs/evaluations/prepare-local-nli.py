"""Fetch pinned, checksummed research assets outside the product repository."""
import hashlib
import json
import os
from pathlib import Path
import urllib.request
root = Path(__file__).parent
lab = Path(os.environ.get("NLI_LAB_ROOT", "/private/tmp/document-nli-lab"))
manifest = json.loads((root / "2026-10-03-local-nli-model-assets.json").read_text())
def digest(p):
    h = hashlib.sha256()
    with p.open("rb") as f:
        while chunk := f.read(1024*1024): h.update(chunk)
    return h.hexdigest()
for asset in manifest["files"]:
    p = lab / "models" / manifest["model"] / asset["name"]
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists() and p.stat().st_size == asset["bytes"] and digest(p) == asset["sha256"]:
        print("verified", asset["name"])
        continue
    temporary = p.with_suffix(p.suffix + ".partial")
    with urllib.request.urlopen(asset["source"], timeout=60) as response, temporary.open("wb") as out:
        size = 0
        while chunk := response.read(1024*1024):
            size += len(chunk)
            if size > asset["bytes"]: raise RuntimeError("Unexpected asset size")
            out.write(chunk)
    if temporary.stat().st_size != asset["bytes"] or digest(temporary) != asset["sha256"]:
        raise RuntimeError("Model checksum mismatch: " + asset["name"])
    temporary.replace(p)
    print("downloaded", asset["name"])
(lab / "model-assets.json").write_text(json.dumps(manifest, indent=2) + "\n")
